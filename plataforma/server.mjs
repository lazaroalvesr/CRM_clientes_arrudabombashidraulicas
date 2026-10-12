import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, randomUUID, scrypt, createHash, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { database } from './lib/database.mjs';
import { searchGooglePlaces } from './lib/google-places.mjs';
import { whatsappBridge } from './lib/whatsapp-bridge.mjs';
import { AppError, clean, companyInput, scoreCompany, STATUSES, STATES, SEGMENTS, SIZES } from './lib/domain.mjs';

const derive = promisify(scrypt), root = path.dirname(fileURLToPath(import.meta.url));
const timestamp = () => new Date().toISOString();
const hash = value => createHash('sha256').update(value).digest('hex');
const safeEqual = (a, b) => { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && timingSafeEqual(x, y); };
async function passwordHash(password) { const salt = randomBytes(16).toString('hex'); return `${salt}:${Buffer.from(await derive(password, salt, 64)).toString('hex')}`; }
async function verifyPassword(password, encoded) { const [salt, expected] = encoded.split(':'); return safeEqual(Buffer.from(await derive(password, salt, 64)).toString('hex'), expected); }
function passwordCheck(p) { if (typeof p !== 'string' || p.length < 12 || p.length > 128) throw new AppError('Use uma senha com 12 a 128 caracteres.'); return p; }
function userInput(body) { const name = clean(body.name, 100), email = clean(body.email, 254).toLowerCase(); if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new AppError('Informe um nome e um e-mail válidos.'); return { name, email, password: passwordCheck(body.password), role: body.role === 'admin' ? 'admin' : 'seller' }; }
function publicUser(u) { return { id: u.id, name: u.name, email: u.email, role: u.role, active: !!u.active, mustChange: !!u.must_change, createdAt: u.created_at }; }
async function readBody(req) { let data = ''; for await (const piece of req) { data += piece; if (Buffer.byteLength(data) > 100_000) throw new AppError('Os dados enviados excedem o limite.', 413); } try { return JSON.parse(data || '{}'); } catch { throw new AppError('Formato de dados inválido.'); } }

export function createApp(config = {}) {
  const host = config.host ?? process.env.HOST ?? '127.0.0.1';
  const port = Number(config.port ?? process.env.PORT ?? 3000);
  const origin = config.origin ?? process.env.APP_ORIGIN ?? `http://127.0.0.1:${port}`;
  const local = ['127.0.0.1', '::1', 'localhost'].includes(host);
  const secure = config.secure ?? (process.env.COOKIE_SECURE === 'true' || origin.startsWith('https:'));
  const bootstrap = config.bootstrap ?? process.env.BOOTSTRAP_TOKEN ?? '';
  if (!local && (!secure || !origin.startsWith('https://'))) throw new Error('O acesso em rede exige APP_ORIGIN HTTPS e COOKIE_SECURE=true.');
  const dataDir = config.dataDir ?? path.resolve(root, process.env.DATA_DIR ?? '.data');
  const db = database(dataDir);
  const bridge = config.whatsappBridge ?? whatsappBridge(process.env.WHATSAPP_AUTH_DIR || path.join(dataDir, 'whatsapp-auth'));
  bridge.setInboundHandler(async message => {
    const lead = db.prepare('SELECT l.company_id FROM leads l JOIN companies c ON c.id=l.company_id WHERE c.whatsapp=? LIMIT 1').get(message.phone);
    if (lead) db.prepare("INSERT OR IGNORE INTO whatsapp_messages(company_id,message_id,direction,body,user_id,created_at) VALUES(?,?,'in',?,NULL,?)").run(lead.company_id,message.messageId,message.body,message.timestamp);
  });
  const providerUrl = config.providerUrl ?? process.env.PROSPECT_API_URL ?? '';
  const providerKey = config.providerKey ?? process.env.PROSPECT_API_KEY ?? '';
  const providerFetch = config.providerFetch ?? fetch;
  if (providerUrl && !providerUrl.startsWith('https://')) throw new Error('PROSPECT_API_URL deve usar HTTPS.');
  const cookieName = secure ? '__Host-arruda_session' : 'arruda_session';
  const dummy = passwordHash(randomBytes(24).toString('hex'));
  const audit = (uid, action, target) => db.prepare('INSERT INTO audit(user_id,action,target,created_at) VALUES(?,?,?,?)').run(uid, action, target, timestamp());
  function limit(key, max = 8, duration = 900_000) {
    const now = Date.now(); db.prepare('DELETE FROM attempts WHERE expires<?').run(now);
    const r = db.prepare('SELECT * FROM attempts WHERE key=?').get(key);
    if (r && r.count >= max) throw new AppError('Muitas tentativas. Aguarde 15 minutos e tente novamente.', 429);
    db.prepare('INSERT INTO attempts(key,count,expires) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1').run(key, now + duration);
  }
  function session(req) {
    const cookie = (req.headers.cookie ?? '').split(';').map(s => s.trim()).find(s => s.startsWith(`${cookieName}=`));
    const token = cookie?.slice(cookieName.length + 1) ?? '';
    if (!/^[a-f0-9]{64}$/.test(token)) return null;
    return db.prepare('SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=? AND s.expires>? AND u.active=1').get(hash(token), Date.now()) ?? null;
  }
  function setSession(res, uid) { const token = randomBytes(32).toString('hex'); db.prepare('DELETE FROM sessions WHERE expires<?').run(Date.now()); db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(hash(token), uid, Date.now() + 8 * 3600_000); res.setHeader('Set-Cookie', `${cookieName}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=28800${secure ? '; Secure' : ''}`); }
  function shape(row) { return { ...row, sourceUrl: row.source_url, verifiedAt: row.verified_at, savedBy: row.saved_by, savedByName: row.saved_by_name, savedAt: row.saved_at, equipmentInterest: row.equipment_interest || '', contactResult: row.contact_result || '', lastContactAt: row.last_contact_at, nextContactAt: row.next_contact_at, saved: !!row.saved_at, ...scoreCompany(row) }; }
  function companies(filters = {}, onlyLeads = false, viewer = null) {
    let query = 'SELECT c.*,l.saved_by,l.saved_at,l.status,l.notes,l.equipment_interest,l.contact_result,l.last_contact_at,l.next_contact_at,l.version,u.name saved_by_name FROM companies c LEFT JOIN leads l ON l.company_id=c.id LEFT JOIN users u ON u.id=l.saved_by WHERE 1=1'; const args = [];
    if (onlyLeads) query += ' AND l.company_id IS NOT NULL';
    if (onlyLeads && viewer?.role !== 'admin') { query += ' AND l.saved_by=?'; args.push(viewer.id); }
    for (const field of ['state', 'segment', 'size']) { if (filters[field]) { query += ` AND c.${field}=?`; args.push(clean(filters[field])); } }
    if (filters.city) { query += ' AND c.city LIKE ?'; args.push(`%${clean(filters.city, 100).replace(/[\\%_]/g, '')}%`); }
    if (filters.q) { query += ' AND (c.name LIKE ? OR c.city LIKE ?)'; const q = `%${clean(filters.q).replace(/[\\%_]/g, '')}%`; args.push(q, q); }
    if (filters.status && STATUSES.includes(filters.status)) { query += ' AND l.status=?'; args.push(filters.status); }
    return db.prepare(query + ' ORDER BY c.name LIMIT 1000').all(...args).map(shape).filter(c => !filters.priority || c.priority === filters.priority).sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, 'pt-BR'));
  }
  function insertCompany(input, uid) {
    const c = companyInput(input);
    const exists = db.prepare('SELECT id FROM companies WHERE identity=? OR (? IS NOT NULL AND cnpj=?)').get(c.identity, c.cnpj, c.cnpj);
    if (exists) return { id: exists.id, duplicate: true };
    const id = randomUUID();
    db.prepare('INSERT INTO companies(id,identity,cnpj,name,city,state,segment,size,phone,whatsapp,website,source_url,structure,pumping,fleet,branches,verified_at,created_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(id, c.identity, c.cnpj, c.name, c.city, c.state, c.segment, c.size, c.phone, c.whatsapp, c.website, c.sourceUrl, c.structure, c.pumping, c.fleet, c.branches, timestamp(), uid);
    audit(uid, 'company.create', id); return { id, duplicate: false };
  }
  const json = (res, data, status = 200) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(data)); };
  const server = http.createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    if (secure) res.setHeader('Strict-Transport-Security', 'max-age=31536000');
    try {
      const parsed = new URL(req.url, origin), route = parsed.pathname;
      if (req.headers.host !== new URL(origin).host) throw new AppError('Origem não autorizada.', 403);
      if (route.startsWith('/api/')) {
        if (!['GET', 'HEAD'].includes(req.method)) {
          if (req.headers.origin !== origin || req.headers['x-arruda-request'] !== '1' || !String(req.headers['content-type']).startsWith('application/json')) throw new AppError('Solicitação não autorizada. Recarregue a página.', 403);
        }
        if (route === '/api/session' && req.method === 'GET') { const u = session(req); return json(res, { user: u ? publicUser(u) : null, needsSetup: !db.prepare('SELECT 1 FROM users LIMIT 1').get(), setupTokenRequired: !local || !!bootstrap, providerConfigured: !!(providerUrl || process.env.GOOGLE_MAPS_API_KEY) }); }
        if (route === '/api/setup' && req.method === 'POST') {
          limit(`setup:${req.socket.remoteAddress}`, 8);
          if (db.prepare('SELECT 1 FROM users LIMIT 1').get()) throw new AppError('A configuração inicial já foi concluída.', 409);
          const body = await readBody(req);
          if ((!local || bootstrap) && (!bootstrap || !safeEqual(clean(body.token, 200), bootstrap))) throw new AppError('Chave de configuração inválida.', 403);
          const u = userInput(body), encrypted = await passwordHash(u.password), id = randomUUID();
          // Recheck after asynchronous hashing: only one first administrator may be created.
          if (db.prepare('SELECT 1 FROM users LIMIT 1').get()) throw new AppError('A configuração inicial já foi concluída.', 409);
          db.prepare('INSERT INTO users(id,name,email,password,role,created_at) VALUES(?,?,?,?,?,?)').run(id, u.name, u.email, encrypted, 'admin', timestamp());
          audit(id, 'setup.complete', id); setSession(res, id); return json(res, { user: publicUser(db.prepare('SELECT * FROM users WHERE id=?').get(id)) }, 201);
        }
        if (route === '/api/login' && req.method === 'POST') {
          limit(`ip:${req.socket.remoteAddress}`, 40); const body = await readBody(req), email = clean(body.email, 254).toLowerCase(); limit(`email:${email}`);
          const u = db.prepare('SELECT * FROM users WHERE email=?').get(email);
          const valid = await verifyPassword(typeof body.password === 'string' ? body.password.slice(0, 128) : '', u?.password ?? await dummy);
          if (!u || !u.active || !valid) throw new AppError('E-mail ou senha incorretos.', 401);
          db.prepare('DELETE FROM attempts WHERE key=?').run(`email:${email}`); setSession(res, u.id); audit(u.id, 'login', u.id); return json(res, { user: publicUser(u) });
        }
        const user = session(req); if (!user) throw new AppError('Sua sessão expirou. Entre novamente.', 401);
        if (route === '/api/logout' && req.method === 'POST') { const token = (req.headers.cookie ?? '').split(';').map(s => s.trim()).find(s => s.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1); if (token) db.prepare('DELETE FROM sessions WHERE token=?').run(hash(token)); res.setHeader('Set-Cookie', `${cookieName}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure ? '; Secure' : ''}`); return json(res, { ok: true }); }
        if (route === '/api/password' && req.method === 'POST') {
          limit(`password:${user.id}`); const b = await readBody(req); passwordCheck(b.password);
          if (!await verifyPassword(typeof b.currentPassword === 'string' ? b.currentPassword.slice(0, 128) : '', user.password)) throw new AppError('A senha atual está incorreta.', 403);
          const encrypted = await passwordHash(b.password); db.prepare('UPDATE users SET password=?,must_change=0 WHERE id=?').run(encrypted, user.id); db.prepare('DELETE FROM sessions WHERE user_id=?').run(user.id); setSession(res, user.id); audit(user.id, 'password.change', user.id); return json(res, { ok: true });
        }
        if (user.must_change) throw new AppError('Defina uma nova senha antes de continuar.', 428);
        if (route === '/api/whatsapp/status' && req.method === 'GET') {
          const state = await bridge.state();
          return json(res, { status:state.status, qr:user.role==='admin'?state.qr:'', phone:user.role==='admin'?state.phone:'' });
        }
        if (route === '/api/whatsapp/conversations' && req.method === 'GET') {
          const rows = db.prepare(`SELECT c.id,c.name,c.city,c.state,c.whatsapp,l.saved_by,u.name saved_by_name,
            (SELECT body FROM whatsapp_messages m WHERE m.company_id=c.id ORDER BY m.created_at DESC,m.id DESC LIMIT 1) last_body,
            (SELECT direction FROM whatsapp_messages m WHERE m.company_id=c.id ORDER BY m.created_at DESC,m.id DESC LIMIT 1) last_direction,
            (SELECT created_at FROM whatsapp_messages m WHERE m.company_id=c.id ORDER BY m.created_at DESC,m.id DESC LIMIT 1) last_at
            FROM leads l JOIN companies c ON c.id=l.company_id JOIN users u ON u.id=l.saved_by
            WHERE c.whatsapp<>'' AND (?='admin' OR l.saved_by=?)
            ORDER BY last_at DESC,c.name COLLATE NOCASE LIMIT 1000`).all(user.role,user.id);
          return json(res,{conversations:rows.map(r=>({id:r.id,name:r.name,city:r.city,state:r.state,whatsapp:r.whatsapp,savedBy:r.saved_by,savedByName:r.saved_by_name,lastBody:r.last_body,lastDirection:r.last_direction,lastAt:r.last_at}))});
        }
        const chatMatch = route.match(/^\/api\/whatsapp\/leads\/([a-f0-9-]+)$/);
        if (chatMatch && (req.method === 'GET' || req.method === 'POST')) {
          const lead = db.prepare('SELECT l.saved_by,c.whatsapp FROM leads l JOIN companies c ON c.id=l.company_id WHERE l.company_id=?').get(chatMatch[1]);
          if (!lead || (user.role !== 'admin' && lead.saved_by !== user.id)) throw new AppError('Lead não encontrado.', 404);
          if (req.method === 'GET') {
            const messages = db.prepare("SELECT m.id,m.direction,m.body,m.created_at,m.user_id,u.name user_name FROM (SELECT * FROM whatsapp_messages WHERE company_id=? ORDER BY created_at DESC LIMIT 100) m LEFT JOIN users u ON u.id=m.user_id ORDER BY m.created_at ASC").all(chatMatch[1]);
            const state = await bridge.state();
            return json(res, { status:state.status, messages:messages.map(m=>({id:m.id,direction:m.direction,body:m.body,createdAt:m.created_at,userId:m.user_id,userName:m.user_name})) });
          }
          const body = clean((await readBody(req)).text,3000);
          if (!body) throw new AppError('Digite uma mensagem antes de enviar.');
          let sent;try{sent=await bridge.send(lead.whatsapp,body)}catch(error){throw new AppError(error.message,503)}
          db.prepare("INSERT OR IGNORE INTO whatsapp_messages(company_id,message_id,direction,body,user_id,created_at) VALUES(?,?,'out',?,?,?)").run(chatMatch[1],sent.messageId,body,user.id,sent.sentAt);
          audit(user.id,'whatsapp.send',chatMatch[1]);
          return json(res,{ok:true});
        }
        if (route === '/api/meta' && req.method === 'GET') return json(res, { states: STATES, segments: SEGMENTS, sizes: SIZES, statuses: STATUSES, providerConfigured: !!(providerUrl || process.env.GOOGLE_MAPS_API_KEY) });
        if (route === '/api/google-places' && req.method === 'POST') { const result = await searchGooglePlaces(await readBody(req)); audit(user.id, 'google.places.search', result.query); return json(res, result); }
        if (route === '/api/companies' && req.method === 'GET') return json(res, { companies: companies(Object.fromEntries(parsed.searchParams)), providerConfigured: !!providerUrl });
        if (route === '/api/companies' && req.method === 'POST') { const result = insertCompany(await readBody(req), user.id); return json(res, result, result.duplicate ? 200 : 201); }
        if (route === '/api/search' && req.method === 'POST') {
          if (!providerUrl) throw new AppError('A fonte de empresas ainda não foi conectada. Cadastre empresas verificadas para pesquisar na base da equipe.', 503);
          limit(`search:${user.id}`, 30); const b = await readBody(req), filters = { state: clean(b.state, 2), city: clean(b.city, 100), segment: clean(b.segment, 50), size: clean(b.size, 20) };
          if ((filters.state && !STATES.includes(filters.state)) || (filters.segment && !SEGMENTS.includes(filters.segment)) || (filters.size && !SIZES.includes(filters.size))) throw new AppError('Filtros inválidos.');
          let response; try { response = await providerFetch(providerUrl, { method: 'POST', redirect: 'error', headers: { 'Content-Type': 'application/json', ...(providerKey ? { Authorization: `Bearer ${providerKey}` } : {}) }, body: JSON.stringify(filters), signal: AbortSignal.timeout(20_000) }); } catch { throw new AppError('Não foi possível consultar a fonte. Tente novamente.', 502); }
          if (!response.ok) throw new AppError('A fonte de empresas está indisponível. Tente novamente mais tarde.', 502);
          let payload; try { let text = ''; for await (const chunk of response.body) { text += Buffer.from(chunk).toString('utf8'); if (Buffer.byteLength(text) > 2_000_000) throw 0; } payload = JSON.parse(text); } catch { throw new AppError('A fonte retornou dados inválidos ou grandes demais.', 502); }
          if (!Array.isArray(payload.companies) || payload.companies.length > 100) throw new AppError('Resposta incompatível da fonte de empresas.', 502);
          let imported = 0, skipped = 0; for (const item of payload.companies) { try { const r = insertCompany(item, user.id); if (!r.duplicate) imported++; } catch (e) { if (e instanceof AppError) skipped++; else throw e; } }
          audit(user.id, 'provider.search', `${imported}/${skipped}`); return json(res, { companies: companies(filters), imported, skipped });
        }
        if (route === '/api/leads' && req.method === 'GET') return json(res, { companies: companies(Object.fromEntries(parsed.searchParams), true, user) });
        if (route === '/api/leads' && req.method === 'POST') {
          const b = await readBody(req), cid = clean(b.companyId, 40); if (!db.prepare('SELECT 1 FROM companies WHERE id=?').get(cid)) throw new AppError('Empresa não encontrada.', 404);
          const result = db.prepare('INSERT INTO leads(company_id,saved_by,saved_at) VALUES(?,?,?) ON CONFLICT(company_id) DO NOTHING').run(cid, user.id, timestamp());
          if (result.changes) audit(user.id, 'lead.save', cid); return json(res, { duplicate: !result.changes });
        }
        const activityMatch = route.match(/^\/api\/leads\/([a-f0-9-]+)\/activities$/);
        if (activityMatch && req.method === 'GET') { const owner=db.prepare('SELECT saved_by FROM leads WHERE company_id=?').get(activityMatch[1]); if(!owner||(user.role!=='admin'&&owner.saved_by!==user.id)) throw new AppError('Lead não encontrado.',404); return json(res,{activities:db.prepare('SELECT a.*,u.name user_name FROM lead_activities a JOIN users u ON u.id=a.user_id WHERE a.company_id=? ORDER BY a.created_at DESC LIMIT 30').all(activityMatch[1]).map(a=>({id:a.id,userName:a.user_name,equipmentInterest:a.equipment_interest,contactResult:a.contact_result,notes:a.notes,createdAt:a.created_at}))}); }
        const leadMatch = route.match(/^\/api\/leads\/([a-f0-9-]+)$/);
        if (leadMatch && req.method === 'PATCH') {
          const b = await readBody(req); if (!STATUSES.includes(b.status) || !Number.isInteger(b.version)) throw new AppError('Status ou versão inválidos.');
          const equipment=clean(b.equipmentInterest,120),contactResult=clean(b.contactResult,80),notes=clean(b.notes,5000),next=b.nextContactAt?new Date(b.nextContactAt):null;if(contactResult&&!['Contato iniciado','Sem resposta','Conversa em andamento','Proposta solicitada','Sem interesse'].includes(contactResult))throw new AppError('Selecione um resultado de contato válido.');if(next&&Number.isNaN(next.getTime()))throw new AppError('Informe uma data válida para o próximo contato.');const result = db.prepare("UPDATE leads SET status=?,notes=?,equipment_interest=?,contact_result=CASE WHEN ?<>'' THEN ? ELSE contact_result END,last_contact_at=CASE WHEN ?<>'' THEN ? ELSE last_contact_at END,next_contact_at=?,version=version+1 WHERE company_id=? AND version=? AND (saved_by=? OR ?='admin')").run(b.status,notes,equipment,contactResult,contactResult,contactResult,timestamp(),next?.toISOString()||null,leadMatch[1],b.version,user.id,user.role);if(result.changes&&contactResult)db.prepare('INSERT INTO lead_activities(company_id,user_id,equipment_interest,contact_result,notes,created_at) VALUES(?,?,?,?,?,?)').run(leadMatch[1],user.id,equipment,contactResult,notes,timestamp());
          if (!result.changes) throw new AppError('Este lead foi alterado por outra pessoa. Feche e abra os detalhes para carregar a versão atual.', 409);
          audit(user.id, 'lead.update', leadMatch[1]); return json(res, { ok: true });
        }
        if (route.startsWith('/api/users')) {
          if (user.role !== 'admin') throw new AppError('Apenas administradores podem gerenciar usuários.', 403);
          if (route === '/api/users' && req.method === 'GET') return json(res, { users: db.prepare('SELECT * FROM users ORDER BY name').all().map(publicUser) });
          if (route === '/api/users' && req.method === 'POST') {
            const u = userInput(await readBody(req)); if (db.prepare('SELECT 1 FROM users WHERE email=?').get(u.email)) throw new AppError('Já existe um usuário com esse e-mail.', 409);
            const encrypted = await passwordHash(u.password), id = randomUUID(); db.prepare('INSERT INTO users(id,name,email,password,role,must_change,created_at) VALUES(?,?,?,?,?,1,?)').run(id, u.name, u.email, encrypted, u.role, timestamp()); audit(user.id, 'user.create', id); return json(res, { ok: true }, 201);
          }
          const m = route.match(/^\/api\/users\/([a-f0-9-]+)$/);
          if (m && req.method === 'PATCH') {
            const b = await readBody(req);
            const encrypted = b.password ? await passwordHash(passwordCheck(b.password)) : null;
            // Perform role invariant checks after hashing, without an asynchronous gap before writes.
            const target = db.prepare('SELECT * FROM users WHERE id=?').get(m[1]); if (!target) throw new AppError('Usuário não encontrado.', 404);
            const currentAdmin = session(req); if (!currentAdmin || currentAdmin.role !== 'admin') throw new AppError('Seu acesso foi alterado. Entre novamente.', 403);
            const active = typeof b.active === 'boolean' ? Number(b.active) : target.active, role = ['admin', 'seller'].includes(b.role) ? b.role : target.role;
            if (target.id === user.id && !active) throw new AppError('Você não pode desativar seu próprio acesso.');
            if (target.role === 'admin' && target.active && (!active || role !== 'admin') && db.prepare("SELECT COUNT(*) n FROM users WHERE role='admin' AND active=1").get().n <= 1) throw new AppError('Mantenha pelo menos um administrador ativo.');
            if (encrypted) {
              db.prepare('UPDATE users SET password=?,must_change=1 WHERE id=?').run(encrypted, target.id);
            }
            db.prepare('UPDATE users SET active=?,role=? WHERE id=?').run(active, role, target.id);
            db.prepare('DELETE FROM sessions WHERE user_id=?').run(target.id); audit(user.id, 'user.update', target.id); return json(res, { ok: true });
          }
        }
        throw new AppError('Recurso não encontrado.', 404);
      }
      if (req.method !== 'GET' && req.method !== 'HEAD') throw new AppError('Método não permitido.', 405);
      const files = { '/': ['index.html', 'text/html; charset=utf-8'], '/app.js': ['app.js', 'text/javascript; charset=utf-8'], '/style.css': ['style.css', 'text/css; charset=utf-8'], '/favicon.svg': ['favicon.svg', 'image/svg+xml'] };
      const file = files[route]; if (!file) throw new AppError('Página não encontrada.', 404);
      const content = await readFile(path.join(root, 'public', file[0])); res.writeHead(200, { 'Content-Type': file[1] }); res.end(req.method === 'HEAD' ? undefined : content);
    } catch (e) {
      if (!(e instanceof AppError)) console.error('Request failed:', e.code ?? e.name);
      const constraint = e.code === 'ERR_SQLITE_ERROR' && String(e.message).includes('UNIQUE');
      json(res, { error: e instanceof AppError ? e.message : constraint ? 'Este registro já existe. Atualize a página.' : 'Não foi possível concluir. Tente novamente.' }, e.status ?? (constraint ? 409 : 500));
    }
  });
  server.requestTimeout = 30_000;
  return { server, db, host, port };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const app = createApp(); app.server.listen(app.port, app.host, () => console.log(`Arruda Bombas: http://${app.host}:${app.port}`));
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => app.server.close(() => { app.db.close(); process.exit(0); }));
}
