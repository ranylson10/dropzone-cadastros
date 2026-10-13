import { getPublishedRulebook, getRulebook } from '@backend/campeonatos/rulebook'
import { getCampeonatoPermission } from '@backend/campeonatos/campeonato-permissions'
import type { LiliCard } from '@backend/lili/types'

export async function getPublishedChampionshipRulebook(championshipId: string, userId?: string | null) {
  // Primeiro usa exatamente o serviço público oficial do Rulebook Builder.
  // Se ainda estiver em rascunho, somente um usuário com permissão no campeonato
  // pode consultá-lo pela Lili; visitantes continuam vendo apenas versões publicadas.
  let source: any = await getPublishedRulebook(championshipId)
  let visibility: 'published' | 'draft' = 'published'

  if (!source && userId) {
    const permission = await getCampeonatoPermission(userId, championshipId)
    const canManage = permission.role === 'owner' || permission.canManage || permission.canOrganizeGroups
    if (canManage) {
      source = await getRulebook(championshipId)
      visibility = 'draft'
    }
  }

  if (!source) return null

  const row = source.rulebook && typeof source.rulebook === 'object' ? source.rulebook : source
  const document = row.documento && typeof row.documento === 'object' ? row.documento as any : null
  if (!document || !Array.isArray(document.chapters)) return null

  return {
    campeonatoId: String(row.campeonato_id || championshipId),
    perfil: row.perfil,
    publicadoEm: row.publicado_em || null,
    versao: row.versao,
    status: String(row.status || (visibility === 'published' ? 'publicado' : 'rascunho')),
    visibility,
    title: String(document.title || 'Regulamento'),
    subtitle: String(document.subtitle || ''),
    chapters: document.chapters
      .filter((chapter: any) => chapter && chapter.included !== false)
      .sort((a: any, b: any) => Number(a.order || 0) - Number(b.order || 0)),
  }
}

export function truncateRuleText(value: unknown, max = 360) {
  const text = String(value || '').replace(/\s+/g, ' ').trim()
  if (text.length <= max) return text
  return `${text.slice(0, max - 1).trimEnd()}…`
}

export function rulebookTopicCards(rulebook: any, championshipId: string): LiliCard[] {
  return (rulebook.chapters || []).map((chapter: any, chapterIndex: number) => {
    const articles = Array.isArray(chapter.articles) ? chapter.articles : []
    const topicId = String(chapter.id || chapterIndex)
    return {
      id: `rulebook-topic-${topicId}`,
      kind: 'rulebook',
      title: String(chapter.title || `Tópico ${chapterIndex + 1}`),
      subtitle: `${articles.length} artigo${articles.length === 1 ? '' : 's'}`,
      badges: [`Tópico ${chapterIndex + 1}`],
      actions: [{
        id: `open-rulebook-topic-${topicId}`,
        label: 'Ver regras deste tópico',
        message: `Abrir tópico ${chapter.title || chapterIndex + 1}`,
        intent: 'abrir_topico_regulamento',
        variant: 'primary',
        context: {
          selectedChampionshipId: championshipId,
          selectedRulebookTopicId: topicId,
          currentFlow: 'championship_rules',
          currentStep: 'rulebook_topic',
        },
      }],
    }
  })
}

export function rulebookTopicDetailCard(rulebook: any, championshipId: string, topicId: string): LiliCard | null {
  const chapters = Array.isArray(rulebook.chapters) ? rulebook.chapters : []
  const chapterIndex = chapters.findIndex((chapter: any, index: number) => String(chapter?.id || index) === String(topicId))
  if (chapterIndex < 0) return null

  const chapter = chapters[chapterIndex]
  const articles = Array.isArray(chapter.articles) ? chapter.articles : []
  const details = articles.map((article: any, articleIndex: number) => ({
    label: article.number ? `Art. ${article.number}` : `Regra ${articleIndex + 1}`,
    value: [article.title, String(article.body || '').replace(/\s+/g, ' ').trim()]
      .filter(Boolean)
      .join(' — '),
  }))

  return {
    id: `rulebook-topic-detail-${topicId}`,
    kind: 'rulebook',
    title: String(chapter.title || `Tópico ${chapterIndex + 1}`),
    subtitle: `${articles.length} artigo${articles.length === 1 ? '' : 's'}`,
    badges: [`Tópico ${chapterIndex + 1}`],
    details,
    actions: [{
      id: `open-full-rulebook-topic-${topicId}`,
      label: 'Abrir no regulamento completo',
      href: `/campeonatos/${championshipId}/regulamento${chapter.id ? `#${encodeURIComponent(String(chapter.id))}` : ''}`,
      variant: 'secondary',
    }],
  }
}

export function detailsSafeIndex(article: any, articles: any[]) {
  const index = articles.indexOf(article)
  return index >= 0 ? index : 0
}

export function normalizeRuleSearchText(value: unknown) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export const RULE_STOP_WORDS = new Set([
  'a', 'ao', 'aos', 'as', 'com', 'como', 'da', 'das', 'de', 'do', 'dos', 'e', 'em', 'eu', 'me', 'na', 'nas', 'no', 'nos',
  'o', 'os', 'ou', 'para', 'por', 'posso', 'pode', 'podem', 'que', 'qual', 'quais', 'se', 'ser', 'sobre', 'tem', 'uma', 'um',
  'al', 'con', 'como', 'de', 'del', 'el', 'en', 'es', 'la', 'las', 'los', 'o', 'para', 'por', 'puedo', 'puede', 'que', 'se', 'sobre', 'un', 'una',
  'about', 'a', 'an', 'and', 'can', 'do', 'does', 'for', 'how', 'i', 'in', 'is', 'of', 'on', 'or', 'the', 'to', 'what', 'with',
])

export function ruleSearchTokens(value: unknown) {
  return normalizeRuleSearchText(value)
    .split(' ')
    .filter((token) => token.length >= 3 && !RULE_STOP_WORDS.has(token))
}

export function findRulebookAnswers(rulebook: any, question: string, championshipId: string): LiliCard[] {
  const tokens = [...new Set(ruleSearchTokens(question))]
  if (!tokens.length) return []

  const matches: Array<{ score: number; chapter: any; chapterIndex: number; article: any; articleIndex: number }> = []
  for (const [chapterIndex, chapter] of (rulebook.chapters || []).entries()) {
    const chapterText = normalizeRuleSearchText(chapter?.title)
    const articles = Array.isArray(chapter?.articles) ? chapter.articles : []
    for (const [articleIndex, article] of articles.entries()) {
      const titleText = normalizeRuleSearchText(article?.title)
      const bodyText = normalizeRuleSearchText(article?.body)
      const numberText = normalizeRuleSearchText(article?.number)
      let score = 0
      for (const token of tokens) {
        if (numberText === token || numberText.includes(token)) score += 8
        if (titleText.includes(token)) score += 5
        if (chapterText.includes(token)) score += 3
        if (bodyText.includes(token)) score += 1
      }
      const phrase = normalizeRuleSearchText(question)
      if (phrase.length >= 8 && titleText.includes(phrase)) score += 10
      if (score > 0) matches.push({ score, chapter, chapterIndex, article, articleIndex })
    }
  }

  return matches
    .sort((a, b) => b.score - a.score || a.chapterIndex - b.chapterIndex || a.articleIndex - b.articleIndex)
    .slice(0, 4)
    .map(({ chapter, chapterIndex, article, articleIndex }) => ({
      id: `rule-answer-${chapter?.id || chapterIndex}-${article?.id || articleIndex}`,
      kind: 'rulebook' as const,
      title: String(article?.title || (article?.number ? `Artigo ${article.number}` : `Regra ${articleIndex + 1}`)),
      subtitle: String(chapter?.title || `Tópico ${chapterIndex + 1}`),
      badges: [article?.number ? `Art. ${article.number}` : `Tópico ${chapterIndex + 1}`],
      details: [{ label: 'Regra publicada', value: truncateRuleText(article?.body, 900) || 'Conteúdo não informado.' }],
      actions: [{
        id: `open-rule-answer-${chapter?.id || chapterIndex}-${article?.id || articleIndex}`,
        label: 'Abrir no regulamento completo',
        href: `/campeonatos/${championshipId}/regulamento${chapter?.id ? `#${encodeURIComponent(String(chapter.id))}` : ''}`,
        variant: 'secondary' as const,
      }],
    }))
}
