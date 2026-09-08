import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = path.resolve(import.meta.dirname, '..', '..');
const queryFile = path.join(root, 'database', 'auditoria', 'rodada_3_integridade_banco.sql');
const destination = path.join(root, 'relatorios-testes', 'integridade-publicada.json');
const npxCli = path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npx-cli.js');
const executable = process.platform === 'win32' ? process.execPath : 'npx';
const executableArgs = process.platform === 'win32' ? [npxCli] : [];

const query = spawnSync(
  executable,
  [...executableArgs, 'supabase', 'db', 'query', '--linked', '--file', queryFile],
  {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  },
);

if (query.status !== 0) {
  process.stderr.write(query.stderr || query.stdout || query.error?.message || 'Falha ao consultar o Supabase.\n');
  process.exit(query.status ?? 1);
}

const output = query.stdout.trim();
const jsonStart = output.indexOf('{');
if (jsonStart < 0) {
  throw new Error('A CLI do Supabase não retornou um objeto JSON.');
}

const response = JSON.parse(output.slice(jsonStart));
const integrity = response?.rows?.[0]?.integridade;
if (!integrity || typeof integrity !== 'object') {
  throw new Error('O campo rows[0].integridade não foi encontrado na resposta.');
}

fs.mkdirSync(path.dirname(destination), { recursive: true });
fs.writeFileSync(destination, `${JSON.stringify(integrity, null, 2)}\n`, 'utf8');
process.stdout.write(`Integridade atualizada em ${destination}\n`);
