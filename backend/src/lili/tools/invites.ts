import { supabaseAdmin } from '@backend/shared/supabase-admin'

export function extractInviteToken(value: string) {
  const raw = decodeURIComponent(String(value || '').trim())
  if (!raw) return { token: '', hintedPath: '' }
  try {
    const url = new URL(raw)
    const path = url.pathname
    const match = path.match(/^\/(convite\/equipe|convite\/grupo|equipe\/entrar|escala|i|vagas\/compra)\/([^/?#]+)/i)
    if (match) return { token: decodeURIComponent(match[2]), hintedPath: `/${match[1]}` }
  } catch {
    const match = raw.match(/\/?(convite\/equipe|convite\/grupo|equipe\/entrar|escala|i|vagas\/compra)\/([^/?#\s]+)/i)
    if (match) return { token: decodeURIComponent(match[2]), hintedPath: `/${match[1]}` }
  }
  return { token: raw.replace(/^['\"]|['\"]$/g, '').trim(), hintedPath: '' }
}

export async function resolveExistingInvite(value: string) {
  const parsed = extractInviteToken(value)
  const token = parsed.token
  if (!token) throw new Error('Informe o token ou cole o link de convite.')

  const byHint = (path: string) => ({ token, href: `${path}/${encodeURIComponent(token)}` })
  if (parsed.hintedPath) {
    const hinted = byHint(parsed.hintedPath)
    return { ...hinted, kind: parsed.hintedPath, title: 'Convite localizado' }
  }

  const { data: playerTeamInvite, error: playerTeamError } = await supabaseAdmin
    .from('tokens')
    .select('token,tipo,equipe_id,status,expira_em')
    .ilike('token', token)
    .eq('tipo', 'convite_jogador_equipe')
    .maybeSingle()
  if (playerTeamError) throw playerTeamError
  if (playerTeamInvite) {
    return {
      token: playerTeamInvite.token,
      href: `/equipe/entrar/${encodeURIComponent(playerTeamInvite.token)}`,
      kind: 'convite_jogador_equipe',
      title: 'Convite individual de equipe',
    }
  }

  const { data: teamInvite, error: teamError } = await supabaseAdmin
    .from('tokens')
    .select('token,tipo,campeonato_id,grupo_id,slot_id,status,expira_em')
    .ilike('token', token)
    .in('tipo', ['convite_equipe_campeonato', 'team_invite'])
    .maybeSingle()
  if (teamError) throw teamError
  if (teamInvite) {
    return {
      token: teamInvite.token,
      href: `/convite/equipe/${encodeURIComponent(teamInvite.token)}`,
      kind: 'convite_equipe',
      title: 'Convite de equipe',
      campeonatoId: teamInvite.campeonato_id,
    }
  }

  const { data: lineupLink, error: lineupError } = await supabaseAdmin
    .from('campeonato_links_inscricao')
    .select('token,tipo,campeonato_id,grupo_id,campeonato_equipe_id,line_id,ativo,expira_em')
    .ilike('token', token)
    .eq('tipo', 'escalacao_line')
    .maybeSingle()
  if (lineupError) throw lineupError
  if (lineupLink) {
    return {
      token: lineupLink.token,
      href: `/escala/${encodeURIComponent(lineupLink.token)}`,
      kind: 'escalacao_line',
      title: 'Convite para escalação de jogadores',
      campeonatoId: lineupLink.campeonato_id,
    }
  }

  const { data: groupLink, error: groupError } = await supabaseAdmin
    .from('campeonato_links')
    .select('token,tipo,campeonato_id,grupo_id,ativo,expira_em')
    .ilike('token', token)
    .maybeSingle()
  if (groupError) throw groupError
  if (groupLink) {
    const href = groupLink.tipo === 'inscricao_equipes_grupo'
      ? `/convite/grupo/${encodeURIComponent(groupLink.token)}`
      : `/i/${encodeURIComponent(groupLink.token)}`
    return {
      token: groupLink.token,
      href,
      kind: groupLink.tipo,
      title: groupLink.tipo === 'inscricao_equipes_grupo' ? 'Link de inscrição de equipe' : 'Link de inscrição',
      campeonatoId: groupLink.campeonato_id,
    }
  }

  const { data: purchase, error: purchaseError } = await supabaseAdmin
    .from('sistema_compras_vaga')
    .select('token,campeonato_id,status')
    .ilike('token', token)
    .maybeSingle()
  if (purchaseError) throw purchaseError
  if (purchase) {
    return {
      token: purchase.token,
      href: `/vagas/compra/${encodeURIComponent(purchase.token)}`,
      kind: 'compra_vaga',
      title: 'Compra de vaga',
      campeonatoId: purchase.campeonato_id,
    }
  }

  throw new Error('Não encontrei um convite válido com esse token. Confira o código ou cole o link completo.')
}
