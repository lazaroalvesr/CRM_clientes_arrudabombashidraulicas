import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
export default {
  turbopack: { root },
  serverExternalPackages: ['@whiskeysockets/baileys', 'qrcode']
};
