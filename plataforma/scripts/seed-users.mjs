import postgres from 'postgres';
import { randomBytes, randomUUID, scrypt } from 'node:crypto';
import { promisify } from 'node:util';

if (!process.env.SUPABASE_DB_URL) throw new Error('Defina SUPABASE_DB_URL antes de executar o seed.');
let users;
try { users = JSON.parse(process.env.SEED_USERS_JSON || ''); } catch { throw new Error('SEED_USERS_JSON precisa ser um JSON válido.'); }
if (!Array.isArray(users) || users.length !== 3) throw new Error('SEED_USERS_JSON deve conter exatamente três usuários.');
const emails = new Set(users.map(u => String(u.email || '').trim().toLowerCase()));
if (emails.size !== 3 || [...emails].some(email => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) throw new Error('Os três e-mails precisam ser válidos e diferentes.');
if (users.filter(u => u.role === 'admin').length !== 1) throw new Error('Defina exatamente um administrador entre as três contas.');
const sql = postgres(process.env.SUPABASE_DB_URL, { prepare: false, max: 1 }), scryptAsync = promisify(scrypt);
const existing = await sql('SELECT count(*)::int AS count FROM users');
if (existing[0].count !== 0) throw new Error('O banco já possui usuários; seed cancelado para não alterar acessos existentes.');
for (const user of users) {
  const salt = randomBytes(16).toString('hex');
  const initialPassword = typeof user.initialPassword === 'string' ? user.initialPassword : randomBytes(32).toString('hex');
  if (initialPassword.length < 8 || initialPassword.length > 128) throw new Error('A senha inicial precisa ter de 8 a 128 caracteres.');
  const password = `${salt}:${Buffer.from(await scryptAsync(initialPassword, salt, 64)).toString('hex')}`;
  await sql('INSERT INTO users(id,name,email,password,role,must_change) VALUES($1,$2,$3,$4,$5,true)', [randomUUID(), String(user.name || '').trim(), String(user.email).trim().toLowerCase(), password, user.role]);
}
console.log('Three accounts seeded. Each account must define a new password after its first login.');
await sql.end();
