import postgres from 'postgres';
import { readFile } from 'node:fs/promises';

if (!process.env.SUPABASE_DB_URL) throw new Error('Defina SUPABASE_DB_URL antes de executar a migration.');
const sql = postgres(process.env.SUPABASE_DB_URL, { prepare: false, max: 1 });
const statements = (await readFile(new URL('./neon-schema.sql', import.meta.url), 'utf8')).split(/;\s*(?:\r?\n|$)/).map(s => s.trim()).filter(Boolean);
for (const statement of statements) await sql.unsafe(statement);
await sql.end();
console.log(`Supabase schema ready: ${statements.length} statements applied.`);
