import { NextRequest, NextResponse } from 'next/server'
import { getAccountsForUser, getBearerUser } from '@backend/auth/server-auth'
import { listControllableEquipes } from '@backend/equipes/manager-team-access'
import { supabaseAdmin } from '@backend/shared/supabase-admin'

export const runtime = 'nodejs'

type ChatMessage = { role: 'user' | 'model'; text: string }
type ToolCall = { name: string; args?: Record<string, unknown> }

const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash'
const API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || ''
const MAX_HISTORY = 16

const tools = [
  {
    functionDeclarations: [
      {
        name: 'listar_meus_perfis',
        description: 'Lista os perfis DropZone vinculados ao usuário autenticado.',
        parameters: { type: 'OBJECT', properties: {} },
      },
      {
        name: 'listar_minhas_equipes',
        description: 'Lista equipes que o usuário pode visualizar, administrar ou escalar.',
        parameters: { type: 'OBJECT', properties: {} },
      },
      {
        name: 'listar_inscricoes_da_equipe',
        description: 'Lista campeonatos, grupos, slots e lines inscritos de uma equipe controlada pelo usuário.',
        parameters: {
          type: 'OBJECT',
          properties: {
            equipe: { type: 'STRING', description: 'Nome, tag, username ou ID da equipe. Pode ficar vazio quando houver apenas uma.' },
          },
        },
      },
      {
        name: 'listar_jogadores_inscritos',
        description: 'Lista jogadores inscritos nas participações de campeonato de uma equipe controlada pelo usuário.',
        parameters: {
          type: 'OBJECT',
          properties: {
            equipe: { type: 'STRING', description: 'Nome, tag, username ou ID da equipe.' },
            campeonato: { type: 'STRING', description: 'Nome ou ID do campeonato, opcional.' },
          },
        },
      },
      {
        name: 'resumir_vagas_da_equipe',
        description: 'Mostra quantas inscrições/slots a equipe possui por campeonato e quantos jogadores faltam em cada line.',
        parameters: {
          type: 'OBJECT',
          properties: {
            equipe: { type: 'STRING', description: 'Nome, tag, username ou ID da equipe.' },
            campeonato: { type: 'STRING', description: 'Nome ou ID do campeonato, opcional.' },
          },
        },
      },
    ],
  },
]

function normalize(value: unknown) {
  return String(value || '').trim().toLocaleLowerCase('pt-BR')
}

function compactHistory(input: unknown): ChatMessage[] {
  if (!Array.isArray(input)) return []
  return input
    .filter((item) => item && (item.role === 'user' || item.role === 'model') && typeof item.text === 'string')
    .slice(-MAX_HISTORY)
    .map((item) => ({ role: item.role, text: item.text.slice(0, 4000) }))
}

async function getContext(req: NextRequest) {
  try {
    const user = await getBearerUser(req)
    const accounts = await getAccountsForUser(user)
    const teams = await listControllableEquipes(user.id, accounts)
    return { authenticated: true as const, user, accounts, teams }
  } catch {
    return { authenticated: false as const, user: null, accounts: [], teams: [] }
  }
}

function pickTeam(teams: any[], query: unknown) {
  if (!teams.length) throw new Error('Você não possui equipe vinculada ou com permissão de visualização.')
  const wanted = normalize(query)
  if (!wanted && teams.length === 1) return teams[0]
  if (!wanted) {
    return { ambiguous: true, options: teams.map((team) => ({ id: team.id, nome: team.nome, tag: team.tag, papel: team.papel })) }
  }
  const exact = teams.find((team) => [team.id, team.nome, team.tag, team.username].some((v) => normalize(v) === wanted))
  if (exact) return exact
  const partial = teams.filter((team) => [team.nome, team.tag, team.username].some((v) => normalize(v).includes(wanted)))
  if (partial.length === 1) return partial[0]
  if (partial.length > 1) return { ambiguous: true, options: partial.map((team) => ({ id: team.id, nome: team.nome, tag: team.tag, papel: team.papel })) }
  throw new Error(`Não encontrei uma equipe correspondente a “${String(query || '')}”.`)
}

async function readParticipations(teamId: string, championshipQuery?: unknown) {
  const { data, error } = await supabaseAdmin
    .from('campeonato_equipes')
    .select('id,campeonato_id,equipe_id,line_id,grupo_id,slot_numero,status,nome_exibicao,created_at')
    .eq('equipe_id', teamId)
    .eq('status', 'ativo')
    .order('created_at', { ascending: false })
  if (error) throw error
  const rows = data || []
  if (!rows.length) return []

  const championshipIds = [...new Set(rows.map((row: any) => row.campeonato_id).filter(Boolean))]
  const lineIds = [...new Set(rows.map((row: any) => row.line_id).filter(Boolean))]
  const groupIds = [...new Set(rows.map((row: any) => row.grupo_id).filter(Boolean))]
  const [{ data: championships }, { data: lines }, { data: groups }] = await Promise.all([
    supabaseAdmin.from('campeonatos').select('id,nome,status,logo_url').in('id', championshipIds),
    lineIds.length ? supabaseAdmin.from('equipe_lines').select('id,nome,tag,logo_url').in('id', lineIds) : Promise.resolve({ data: [] as any[] }),
    groupIds.length ? supabaseAdmin.from('campeonato_grupos').select('id,nome').in('id', groupIds) : Promise.resolve({ data: [] as any[] }),
  ])
  const championshipMap = new Map((championships || []).map((item: any) => [item.id, item]))
  const lineMap = new Map((lines || []).map((item: any) => [item.id, item]))
  const groupMap = new Map((groups || []).map((item: any) => [item.id, item]))
  let result = rows.map((row: any) => ({
    ...row,
    campeonato: championshipMap.get(row.campeonato_id) || null,
    line: lineMap.get(row.line_id) || null,
    grupo: groupMap.get(row.grupo_id) || null,
  }))
  const wanted = normalize(championshipQuery)
  if (wanted) {
    result = result.filter((item: any) => normalize(item.campeonato_id) === wanted || normalize(item.campeonato?.nome).includes(wanted))
  }
  return result
}

async function executeTool(call: ToolCall, ctx: Awaited<ReturnType<typeof getContext>>) {
  if (!ctx.authenticated) return { auth_required: true, message: 'É necessário entrar no DropZone para consultar dados privados.' }

  if (call.name === 'listar_meus_perfis') {
    return {
      perfis: ctx.accounts.map((account: any) => ({ id: account.id, tipo: account.profile_type, nome: account.name, username: account.username })),
    }
  }

  if (call.name === 'listar_minhas_equipes') {
    return {
      equipes: ctx.teams.map((team: any) => ({ id: team.id, nome: team.nome, tag: team.tag, papel: team.papel, permissoes: team.permissoes })),
    }
  }

  if (['listar_inscricoes_da_equipe', 'listar_jogadores_inscritos', 'resumir_vagas_da_equipe'].includes(call.name)) {
    const selected: any = pickTeam(ctx.teams, call.args?.equipe)
    if (selected?.ambiguous) return { precisa_escolher_equipe: true, equipes: selected.options }
    const participations = await readParticipations(selected.id, call.args?.campeonato)

    if (call.name === 'listar_inscricoes_da_equipe') {
      return {
        equipe: { id: selected.id, nome: selected.nome, tag: selected.tag },
        total_inscricoes: participations.length,
        inscricoes: participations.map((item: any) => ({
          participacao_id: item.id,
          campeonato: item.campeonato?.nome || 'Campeonato',
          campeonato_id: item.campeonato_id,
          grupo: item.grupo?.nome || null,
          slot: item.slot_numero || null,
          line: item.line?.nome || item.nome_exibicao || 'Line',
        })),
      }
    }

    const participationIds = participations.map((item: any) => item.id)
    const { data: players, error } = participationIds.length
      ? await supabaseAdmin
          .from('campeonato_jogadores')
          .select('id,campeonato_equipe_id,jogador_id,nick,id_jogo,funcao,status,slot_numero,capitao,foto_url')
          .in('campeonato_equipe_id', participationIds)
          .eq('status', 'ativo')
          .order('slot_numero')
      : { data: [] as any[], error: null }
    if (error) throw error

    if (call.name === 'listar_jogadores_inscritos') {
      return {
        equipe: { id: selected.id, nome: selected.nome, tag: selected.tag },
        inscricoes: participations.map((item: any) => ({
          campeonato: item.campeonato?.nome || 'Campeonato',
          grupo: item.grupo?.nome || null,
          slot: item.slot_numero || null,
          line: item.line?.nome || item.nome_exibicao || 'Line',
          jogadores: (players || []).filter((player: any) => player.campeonato_equipe_id === item.id).map((player: any) => ({
            nick: player.nick,
            id_jogo: player.id_jogo,
            funcao: player.funcao,
            slot: player.slot_numero,
            capitao: Boolean(player.capitao),
          })),
        })),
      }
    }

    return {
      equipe: { id: selected.id, nome: selected.nome, tag: selected.tag },
      total_inscricoes: participations.length,
      inscricoes: participations.map((item: any) => {
        const registered = (players || []).filter((player: any) => player.campeonato_equipe_id === item.id).length
        const limit = 6
        return {
          campeonato: item.campeonato?.nome || 'Campeonato',
          grupo: item.grupo?.nome || null,
          slot: item.slot_numero || null,
          line: item.line?.nome || item.nome_exibicao || 'Line',
          jogadores_confirmados: registered,
          limite_jogadores: limit,
          vagas_jogadores: Math.max(0, limit - registered),
        }
      }),
    }
  }

  return { error: 'Ferramenta desconhecida.' }
}

function partsFromHistory(history: ChatMessage[]) {
  return history.map((message) => ({ role: message.role, parts: [{ text: message.text }] }))
}

async function callGemini(contents: any[], availableTools: any[]) {
  if (!API_KEY) throw new Error('GEMINI_API_KEY não configurada no servidor.')
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(MODEL)}:generateContent?key=${encodeURIComponent(API_KEY)}`
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{
          text: `Você é Lili, assistente oficial do DropZone. Responda sempre em português do Brasil, com tom humano, direto e acolhedor.\n\nRegras:\n- Nunca invente dados do sistema. Use ferramentas para qualquer dado de conta, equipe, campeonato, inscrição, line, vaga ou jogador.\n- Se o usuário não estiver autenticado e pedir dado privado, explique em uma frase que precisa entrar e peça login.\n- Não peça senha dentro do chat.\n- Quando houver mais de uma equipe possível, peça para o usuário escolher pelo nome.\n- Não execute alterações; esta primeira versão é somente consulta.\n- Use listas curtas quando apresentar jogadores ou inscrições.\n- Seja concisa e não exponha IDs internos, salvo se estritamente necessário.`,
        }],
      },
      contents,
      ...(availableTools.length ? { tools: availableTools } : {}),
      generationConfig: { temperature: 0.25, maxOutputTokens: 900 },
    }),
    signal: AbortSignal.timeout(25000),
  })
  const json = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(json?.error?.message || `Gemini respondeu com HTTP ${response.status}.`)
  return json
}

function candidateParts(json: any) {
  return json?.candidates?.[0]?.content?.parts || []
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const message = String(body?.message || '').trim()
    if (!message) return NextResponse.json({ error: 'Digite uma mensagem.' }, { status: 400 })
    if (message.length > 2000) return NextResponse.json({ error: 'Mensagem muito longa.' }, { status: 400 })

    const ctx = await getContext(req)
    const history = compactHistory(body?.history)
    const contents: any[] = [...partsFromHistory(history), { role: 'user', parts: [{ text: message }] }]
    const availableTools = ctx.authenticated ? tools : []
    let authRequired = false

    for (let step = 0; step < 4; step += 1) {
      const result = await callGemini(contents, availableTools)
      const parts = candidateParts(result)
      const functionCalls = parts.filter((part: any) => part.functionCall).map((part: any) => part.functionCall as ToolCall)
      if (!functionCalls.length) {
        const text = parts.map((part: any) => part.text || '').join('').trim() || 'Não consegui formular uma resposta agora.'
        authRequired = !ctx.authenticated && /entrar|login|autenticar|identidade/i.test(text)
        return NextResponse.json({ reply: text, authenticated: ctx.authenticated, authRequired })
      }

      contents.push({ role: 'model', parts })
      const responseParts = []
      for (const call of functionCalls) {
        const output = await executeTool(call, ctx)
        if ((output as any)?.auth_required) authRequired = true
        responseParts.push({ functionResponse: { name: call.name, response: output } })
      }
      contents.push({ role: 'user', parts: responseParts })
    }

    return NextResponse.json({ reply: 'A consulta ficou longa demais. Reformule em uma pergunta mais direta.', authenticated: ctx.authenticated, authRequired })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Não foi possível falar com a Lili.' }, { status: 500 })
  }
}
