import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const singleton = new Map();
const normalizePhone = value => String(value || '').replace(/\D/g, '');

export function whatsappBridge(authDir) {
  if (!authDir) return null;
  const directory = path.resolve(authDir);
  if (singleton.has(directory)) return singleton.get(directory);

  let socket = null;
  let status = 'disconnected';
  let qr = '';
  let phone = '';
  let starting = null;
  let retryTimer = null;
  let generation = 0;
  let inboundHandler = null;

  async function connect() {
    if (starting) return starting;
    if (status === 'connected') return;
    starting = (async () => {
      await mkdir(directory, { recursive: true, mode: 0o700 });
      const [{ default: makeWASocket, useMultiFileAuthState, DisconnectReason, Browsers }, { default: QRCode }, { default: pino }] = await Promise.all([
        import('@whiskeysockets/baileys'), import('qrcode'), import('pino')
      ]);
      const { state, saveCreds } = await useMultiFileAuthState(directory);
      const current = ++generation;
      status = 'connecting';
      qr = '';
      socket = makeWASocket({ auth: state, browser: Browsers.macOS('Arruda CRM'), logger:pino({level:'silent'}), printQRInTerminal: false, markOnlineOnConnect: false, syncFullHistory: false });
      socket.ev.on('creds.update', saveCreds);
      socket.ev.on('connection.update', async update => {
        if (current !== generation) return;
        if (update.qr) {
          qr = await QRCode.toDataURL(update.qr, { margin: 1, width: 260 });
          status = 'qr';
        }
        if (update.connection === 'open') {
          status = 'connected'; qr = '';
          phone = normalizePhone(socket.user?.id?.split('@')[0]?.split(':')[0]);
        }
        if (update.connection === 'close') {
          status = 'disconnected'; qr = ''; socket = null;
          const reason = update.lastDisconnect?.error?.output?.statusCode;
          if (reason !== DisconnectReason.loggedOut) {
            clearTimeout(retryTimer);
            retryTimer = setTimeout(() => { if (current === generation) connect().catch(() => {}); }, 5000);
          }
        }
      });
      socket.ev.on('messages.upsert', async ({ messages, type }) => {
        if (current !== generation || !inboundHandler || type !== 'notify') return;
        for (const message of messages || []) {
          if (message.key?.fromMe || !message.key?.remoteJid?.endsWith('@s.whatsapp.net')) continue;
          const body = message.message?.conversation || message.message?.extendedTextMessage?.text;
          if (!body) continue;
          try {
            await inboundHandler({ phone: normalizePhone(message.key.remoteJid.split('@')[0]), messageId: message.key.id, body: String(body).slice(0, 5000), timestamp: new Date(Number(message.messageTimestamp || Date.now() / 1000) * 1000).toISOString() });
          } catch (error) { console.error('WhatsApp inbound save failed', error); }
        }
      });
    })().catch(error => { status = 'error'; socket = null; throw error; }).finally(() => { starting = null; });
    return starting;
  }

  const bridge = {
    setInboundHandler(handler) { inboundHandler = handler; },
    async state() { if (status === 'disconnected' && !retryTimer) await connect(); return { status, qr, phone }; },
    async send(number, body) {
      if (status !== 'connected' || !socket) throw new Error('WhatsApp da empresa não está conectado.');
      const normalized = normalizePhone(number);
      if (!/^55\d{10,11}$/.test(normalized)) throw new Error('O lead precisa de um WhatsApp válido com 55 e DDD.');
      const result = await socket.sendMessage(`${normalized}@s.whatsapp.net`, { text: body });
      return { messageId: result?.key?.id || null, sentAt: new Date().toISOString() };
    },
    async logout() {
      clearTimeout(retryTimer); retryTimer = null;
      generation += 1;
      const active = socket; socket = null; status = 'disconnected'; qr = ''; phone = '';
      if (active) await active.logout();
    }
  };
  singleton.set(directory, bridge);
  return bridge;
}
