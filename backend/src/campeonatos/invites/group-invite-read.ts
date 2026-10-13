import { supabaseAdmin } from '../../shared/supabase-admin'
import { parseLinkMetadata, linkRestantes } from '../../shared/campeonato-link-metadata'
import { resolveGroupLink, linkClosedMessage } from './group-link-state'
import { readGroupSession } from './group-invite-session'
import type { InviteActor } from './types'

export async function readGroupInvite(token: string, actor: InviteActor | null, preferredEquipeId = '') {
  const { link, status, limite, campeonato, grupo, grade } = await resolveGroupLink(token)
  const meta = parseLinkMetadata(link)
  const inscricaoAberta = status === 'ok'

  const [session, temaRes] = await Promise.all([
    readGroupSession(actor, link.campeonato_id, link.grupo_id, preferredEquipeId),
    supabaseAdmin.from('campeonato_configuracoes')
      .select('cor_principal,cor_secundaria,cor_texto_clara,cor_texto_escura,bg_opacidade,bg_image_url')
      .eq('campeonato_id', link.campeonato_id).maybeSingle(),
  ])
  const tema = temaRes.error ? null : temaRes.data

  const vagasBase = grade!.vagas
  const usos = meta.usos
  const restantes = inscricaoAberta ? linkRestantes(meta, grupo?.slots) : 0
  // Referências já usadas = entradas do link com referencia_lista (fonte da verdade do admin)
  const usedNames = new Set(
    (meta.entradas || [])
      .map((e) => String(e.referencia_lista || '').trim().toLowerCase())
      .filter(Boolean),
  )
  // Legado: lista de nomes (links antigos). Links novos só usam limite_vagas.
  const expected = meta.expected_teams
  const equipesEsperadas = expected.map((nome) => ({
    nome,
    disponivel: !usedNames.has(nome.trim().toLowerCase()),
    status: usedNames.has(nome.trim().toLowerCase()) ? ('inscrita' as const) : ('pendente' as const),
    entrada:
      (meta.entradas || []).find(
        (e) => String(e.referencia_lista || '').trim().toLowerCase() === nome.trim().toLowerCase(),
      ) || null,
  }))

  const vagas = vagasBase

  return {
    link: {
      token: link.token,
      titulo: link.titulo,
      limite_vagas: limite,
      usos,
      restantes,
      expira_em: link.expira_em || null,
    },
    /** inscricao = ainda aceita equipes; acompanhamento = esgotado/pausado/expirado (só ver). */
    modo: inscricaoAberta ? 'inscricao' : 'acompanhamento',
    inscricao_aberta: inscricaoAberta,
    status_link: status,
    status_mensagem: inscricaoAberta ? null : linkClosedMessage(status, limite),
    campeonato,
    tema: {
      cor_principal: tema?.cor_principal || '#ff4655',
      cor_secundaria: tema?.cor_secundaria || '#17191d',
      bg_opacidade: tema?.bg_opacidade != null ? Number(tema.bg_opacidade) : 18,
      bg_image_url: tema?.bg_image_url || null,
      cor_texto_clara: tema?.cor_texto_clara || '#ffffff',
      cor_texto_escura: tema?.cor_texto_escura || '#17191d',
    },
    grupo,
    vagas,
    equipes_esperadas: equipesEsperadas,
    equipes_esperadas_disponiveis: equipesEsperadas.filter((item) => item.disponivel).map((item) => item.nome),
    resumo_grupo: {
      total: vagas.length,
      ocupadas: vagas.filter((v) => v.ocupada).length,
      livres: vagas.filter((v) => !v.ocupada).length,
    },
    resumo_link: {
      limite_vagas: limite,
      usos,
      restantes,
    },
    modelo: {
      leitura: grade!.source,
      unidade_competitiva: 'line',
      // UI pede slot; se omitido, servidor ainda preenche o primeiro livre
      auto_slot: true,
      escolher_slot: true,
    },
    ...session,
  }
}
