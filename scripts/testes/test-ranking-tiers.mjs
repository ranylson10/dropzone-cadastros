import { existsSync } from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

const ROOT = path.resolve(import.meta.dirname, '../..');
const port = 3198;
const baseUrl = `http://127.0.0.1:${port}`;
const buildId = path.join(ROOT, 'web', '.next', 'BUILD_ID');
if (!existsSync(buildId)) throw new Error('Build ausente. Execute "npm run build" antes de "npm run test:ranking".');

const command = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const server = spawn(command, ['run', 'start', '--workspace', 'dropzone-web', '--', '-p', String(port)], {
  cwd: ROOT,
  stdio: 'ignore',
  windowsHide: true,
  shell: process.platform === 'win32',
});

async function getRanking() {
  let lastError = null;
  for (let attempt = 0; attempt < 24; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/api/rank`, { cache: 'no-store' });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || `HTTP ${response.status}`);
      return payload;
    } catch (error) {
      lastError = error;
      await delay(500);
    }
  }
  throw lastError || new Error('O endpoint de ranking não respondeu.');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function validateRows(label, rows, fields) {
  assert(Array.isArray(rows), `${label} deve ser uma lista.`);
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    assert(Number(row.rank) === index + 1, `${label}: posição sequencial inválida no item ${index + 1}.`);
    assert(['SS', 'S', 'A', 'B', 'C', 'D', 'E'].includes(row.tier), `${label}: tier inválido no item ${index + 1}.`);
    assert(Number.isFinite(Number(row.score)), `${label}: score inválido no item ${index + 1}.`);
    if (index > 0) assert(Number(rows[index - 1].score) >= Number(row.score), `${label}: ranking fora de ordem no item ${index + 1}.`);
    for (const field of fields) assert(Object.hasOwn(row, field), `${label}: campo ${field} ausente no item ${index + 1}.`);
  }
}

try {
  const ranking = await getRanking();
  assert(ranking.metodologia?.iteracoes === 8, 'O motor deve usar os oito ciclos de influência limitada.');
  validateRows('Jogadores', ranking.players, ['score_base', 'influencia_equipes', 'influencia_campeonatos']);
  validateRows('Equipes', ranking.teams, ['score_base', 'influencia_jogadores', 'influencia_campeonatos']);
  validateRows('Campeonatos', ranking.championships, ['score_base', 'influencia_equipes', 'influencia_jogadores']);
  console.log(`OK: ranking validado (${ranking.players.length} jogadores, ${ranking.teams.length} equipes, ${ranking.championships.length} campeonatos).`);
} finally {
  if (process.platform === 'win32' && server.pid) {
    spawn('taskkill', ['/pid', String(server.pid), '/t', '/f'], { stdio: 'ignore', windowsHide: true });
  } else {
    server.kill();
  }
}
