import { supabaseAdmin } from '@backend/shared/supabase-admin'
import type { LiliIntent } from './types'

type IntentMatch = {
  intent: LiliIntent
  confidence: number
  source: 'rule' | 'pattern' | 'gemini'
  searchTerm?: string
}

const NORMALIZED_RULES: Array<{ intent: LiliIntent; phrases: string[] }> = [
  {
    intent: 'listar_campeonatos_abertos',
    phrases: [
      'campeonatos com vagas',
      'vagas abertas',
      'campeonatos abertos',
      'ver campeonatos',
      'tem vaga',
      'quero vaga',
      'tem algum campeonato',
      'algum campeonato',
      'campeonato para jogar',
      'onde minha equipe possa jogar',
      'onde minha equipe pode jogar',
      'campeonato disponivel',
    ],
  },
  {
    intent: 'listar_minhas_inscricoes',
    phrases: [
      'minhas inscricoes',
      'ver minhas inscricoes',
      'campeonatos que estou inscrito',
      'campeonatos que minha equipe esta inscrita',
      'onde minha equipe esta inscrita',
      'acompanhar minhas inscricoes',
      'status das minhas inscricoes',
    ],
  },
  {
    intent: 'listar_minhas_equipes',
    phrases: ['minhas equipes', 'ver minhas equipes', 'qual minha equipe', 'equipes que administro', 'meus times'],
  },
  {
    intent: 'iniciar_inscricao',
    phrases: ['fazer inscricao', 'quero me inscrever', 'inscrever equipe', 'nova inscricao', 'cadastrar no campeonato'],
  },
  {
    intent: 'menu',
    phrases: ['menu', 'inicio', 'voltar ao inicio', 'ajuda', 'o que voce faz'],
  },
]

export function normalizeLiliText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function ruleMatch(message: string): IntentMatch | null {
  const text = normalizeLiliText(message)
  for (const rule of NORMALIZED_RULES) {
    if (rule.phrases.some((phrase) => text.includes(phrase))) {
      return { intent: rule.intent, confidence: 0.99, source: 'rule' }
    }
  }

  const namedSearch = text.match(
    /(?:buscar|procurar|achar|ver|resultado(?:s)?(?: do| da)?|campeonato chamado|liga chamada|copa chamada)\s+(?:o |a |do |da |de )?(?:campeonato |liga |copa )?(.+)$/,
  )
  if (namedSearch?.[1]?.trim()) {
    const searchTerm = namedSearch[1].trim()
    const generic = ['com vagas', 'aberto', 'abertos', 'disponivel', 'disponiveis', 'para jogar']
    if (!generic.some((value) => searchTerm === value || searchTerm.startsWith(`${value} `))) {
      return { intent: 'buscar_campeonato', confidence: 0.9, source: 'rule', searchTerm }
    }
  }
  return null
}

async function patternMatch(message: string): Promise<IntentMatch | null> {
  const normalized = normalizeLiliText(message)
  if (!normalized) return null
  const { data, error } = await supabaseAdmin
    .from('lili_intent_patterns')
    .select('intent_code,frase_normalizada,confianca')
    .eq('ativo', true)
    .eq('aprovado', true)
    .eq('frase_normalizada', normalized)
    .limit(1)
    .maybeSingle()
  if (error) {
    if (['42P01', 'PGRST205'].includes(error.code || '')) return null
    throw error
  }
  if (!data) return null
  return {
    intent: data.intent_code as LiliIntent,
    confidence: Number(data.confianca || 0.9),
    source: 'pattern',
  }
}

function stripJsonFence(value: string) {
  return value.trim().replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim()
}

async function geminiMatch(message: string): Promise<IntentMatch> {
  const apiKey = String(process.env.GEMINI_API_KEY || '').trim()
  if (!apiKey) return { intent: 'desconhecido', confidence: 0, source: 'gemini' }
  const model = String(process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite').trim()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 12000)
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        signal: controller.signal,
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: 'Classifique a mensagem de um usuário do DropZone. Responda SOMENTE JSON válido com intent, confidence e searchTerm. Intents permitidas: menu, listar_campeonatos_abertos, buscar_campeonato, listar_minhas_equipes, listar_minhas_inscricoes, iniciar_inscricao, desconhecido. Use listar_campeonatos_abertos para perguntas genéricas sobre campeonatos, vagas, oportunidades ou onde uma equipe pode jogar. Use buscar_campeonato somente quando houver um nome próprio explícito de campeonato, liga ou copa. searchTerm deve conter exclusivamente esse nome próprio e deve ficar vazio nas perguntas genéricas.' }],
          },
          contents: [{ role: 'user', parts: [{ text: message.slice(0, 500) }] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 120, responseMimeType: 'application/json' },
        }),
      },
    )
    if (!response.ok) return { intent: 'desconhecido', confidence: 0, source: 'gemini' }
    const json = await response.json()
    const text = json?.candidates?.[0]?.content?.parts?.map((part: any) => part?.text || '').join('') || ''
    const parsed = JSON.parse(stripJsonFence(text))
    const allowed: LiliIntent[] = ['menu', 'listar_campeonatos_abertos', 'buscar_campeonato', 'listar_minhas_equipes', 'listar_minhas_inscricoes', 'iniciar_inscricao', 'desconhecido']
    let intent = allowed.includes(parsed.intent) ? parsed.intent : 'desconhecido'
    let searchTerm = String(parsed.searchTerm || '').trim() || undefined

    if (intent === 'buscar_campeonato') {
      const normalized = normalizeLiliText(message)
      const looksGeneric =
        !searchTerm
        || normalized.includes('algum campeonato')
        || normalized.includes('campeonato com vaga')
        || normalized.includes('campeonatos com vaga')
        || normalized.includes('onde minha equipe')
        || normalized.includes('para jogar')
      if (looksGeneric) {
        intent = 'listar_campeonatos_abertos'
        searchTerm = undefined
      }
    }

    return {
      intent,
      confidence: Math.max(0, Math.min(1, Number(parsed.confidence || 0.6))),
      source: 'gemini',
      searchTerm,
    }
  } catch {
    return { intent: 'desconhecido', confidence: 0, source: 'gemini' }
  } finally {
    clearTimeout(timer)
  }
}

async function saveCandidate(message: string, match: IntentMatch) {
  if (match.source !== 'gemini' || match.intent === 'desconhecido' || match.confidence < 0.7) return
  const normalized = normalizeLiliText(message)
  if (!normalized) return
  const { error } = await supabaseAdmin.from('lili_pattern_candidates').insert({
    mensagem_original: message.slice(0, 500),
    frase_normalizada: normalized,
    intent_sugerida: match.intent,
    confianca: match.confidence,
  })
  if (error && !['42P01', 'PGRST205'].includes(error.code || '')) console.error('Lili candidate error:', error.message)
}

export async function resolveLiliIntent(message: string): Promise<IntentMatch> {
  const direct = ruleMatch(message)
  if (direct) return direct
  const learned = await patternMatch(message)
  if (learned) return learned
  const gemini = await geminiMatch(message)
  await saveCandidate(message, gemini)
  return gemini
}
