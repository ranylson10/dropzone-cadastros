import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '../..')
const envFile = path.join(root, 'web', '.env.local')
const env = {}
for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
  const match = line.match(/^([^=#\s]+)=(.*)$/)
  if (match) env[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, '')
}
const url = env.NEXT_PUBLIC_SUPABASE_URL
const key = env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) throw new Error('Credenciais server-side ausentes para validar o schema da R03.')

const contracts = [
  ['campeonato_partidas_com_mapa', 'id,campeonato_id,fase_id,jogo_id,grupo_id,numero_partida,mapa_codigo,mapa_nome,status'],
  ['campeonato_pontuador_slots_jogo', 'campeonato_id,jogo_id,campeonato_equipe_id,equipe_id,slot_numero,equipe_nome,equipe_tag,equipe_logo_url,grupo_id,grupo_nome'],
  ['campeonato_equipes', 'id,slot_id'],
  ['campeonato_pontuador_jogadores_jogo', 'campeonato_id,jogo_id,campeonato_jogador_id,campeonato_equipe_id,jogador_id,jogador_temporario_id,id_jogo,nick,slot_jogador,foto_url'],
  ['garena_matchstats_jogadores', 'importacao_id,campeonato_jogador_id,campeonato_equipe_id,player_id,abates,dano,assistencias,headshots,knockdowns,sobrevivencia_segundos,distancia_movida,distancia_max_abate,revives,membros_revividos,membros_resgatados,kits_medicos,gel_destruido'],
]

const failures = []
for (const [table, columns] of contracts) {
  const response = await fetch(`${url}/rest/v1/${table}?select=${encodeURIComponent(columns)}&limit=1`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  })
  if (!response.ok) {
    const sampleResponse = await fetch(`${url}/rest/v1/${table}?select=*&limit=1`, { headers: { apikey: key, Authorization: `Bearer ${key}` } })
    const sample = sampleResponse.ok ? await sampleResponse.json() : []
    failures.push(`${table}: HTTP ${response.status} ${(await response.text()).slice(0, 240)}; colunas=${Object.keys(sample[0] || {}).join(',')}`)
  }
}
if (failures.length) throw new Error(failures.join('; '))
console.log('test-baseline-schema-r03: ok')
