import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '../..');
const envFile = path.join(ROOT, 'web', '.env.local');

function readEnv(file) {
  if (!fs.existsSync(file)) throw new Error('web/.env.local não foi encontrado. Configure o ambiente antes de testar o banco.');
  const values = {};
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^([^=#\s]+)=(.*)$/);
    if (match) values[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, '');
  }
  return values;
}

const env = readEnv(envFile);
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('As credenciais de serviço do Supabase não estão configuradas para este teste.');

const tables = [
  ['garena_matchstats_importacoes', 'id,match_id,status,partida_id'],
  ['garena_matchstats_jogadores', 'id,importacao_id,player_id,jogador_id,dano,assistencias'],
  ['garena_matchstats_armas', 'id,importacao_id,player_id,weapon_id,arma'],
  ['garena_matchstats_habilidades', 'id,importacao_id,player_id,tipo,skill_id,habilidade'],
];

const failures = [];
for (const [table, columns] of tables) {
  const response = await fetch(`${url}/rest/v1/${table}?select=${encodeURIComponent(columns)}&limit=1`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!response.ok) failures.push(`${table}: HTTP ${response.status}`);
}

if (failures.length) {
  throw new Error(`Schema Garena indisponível. Aplique database/migrations/20260813_importacao_estatisticas_garena_matchstats.sql. ${failures.join('; ')}`);
}

console.log('OK: tabelas privadas de estatísticas da Garena estão disponíveis e com as colunas esperadas.');
