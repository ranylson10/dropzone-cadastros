import { randomBytes } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getAccountsForUser, getBearerUser } from '@backend/auth/server-auth'
import { supabaseAdmin } from '@backend/shared/supabase-admin'

function novoToken() {
  return randomBytes(18).toString('base64url').toUpperCase()
}

function missingRelation(error: any) {
  return ['42P01', '42703', 'PGRST205', 'PGRST204'].includes(error?.code || '')
}

function sellerLimit(value: unknown) {
  const limit = Number(value || 0)
  return Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 0
}

async function requireProdutoraAccount(req: NextRequest) {
  const user = await getBearerUser(req)
  const accounts = await getAccountsForUser(user)
  const produtora = accounts.find((a) => a.profile_type === 'produtora')
  if (!produtora) throw new Error('Somente a produtora pode gerenciar vendedores.')
  return { user, produtora }
}

const DEFAULT_PERMS = {
  vendedor_vagas: true,
  adicionar_equipes: true,
  remover_proprias_equipes: true,
  gerar_convites_equipe: true,
  ver_estrutura: true,
  organizar_grupos: false,
  pontuar_tabela: false,
}

function normalizePerms(raw: unknown) {
  const value = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  return {
    vendedor_vagas: value.vendedor_vagas !== false,
    adicionar_equipes: value.adicionar_equipes !== false,
    remover_proprias_equipes: value.remover_proprias_equipes !== false,
    gerar_convites_equipe: value.gerar_convites_equipe !== false,
    ver_estrutura: value.ver_estrutura !== false,
    organizar_grupos: value.organizar_grupos === true,
    pontuar_tabela: value.pontuar_tabela === true,
  }
}

/** Lista roster da produtora + em quais campeonatos cada um está. */
export async function GET(req: NextRequest) {
  try {
    const { produtora } = await requireProdutoraAccount(req)
    const campeonatoFilter = req.nextUrl.searchParams.get('campeonato_id') || ''

    // Roster preferencial (produtora_vendedores); fallback: distinct de campeonato_vendedores
    let roster: any[] = []
    const { data: rosterRows, error: rosterError } = await supabaseAdmin
      .from('produtora_vendedores')
      .select('*')
      .eq('produtora_id', produtora.id)
      .neq('status', 'cancelado')
      .order('created_at', { ascending: false })

    if (rosterError && !missingRelation(rosterError)) throw rosterError
    if (!rosterError) roster = rosterRows || []

    if (!roster.length) {
      const { data: fromCamp, error: fromCampError } = await supabaseAdmin
        .from('campeonato_vendedores')
        .select('manager_id,manager_auth_user_id,nome_publico,whatsapp_url,status,produtora_id,aceito_em,criado_por,created_at')
        .eq('produtora_id', produtora.id)
        .eq('status', 'ativo')
        .not('manager_id', 'is', null)
      if (fromCampError && !missingRelation(fromCampError)) throw fromCampError
      const byManager = new Map<string, any>()
      for (const row of fromCamp || []) {
        if (!row.manager_id || byManager.has(row.manager_id)) continue
        byManager.set(row.manager_id, {
          id: row.manager_id,
          produtora_id: produtora.id,
          manager_id: row.manager_id,
          manager_auth_user_id: row.manager_auth_user_id,
          nome_publico: row.nome_publico,
          whatsapp_url: row.whatsapp_url,
          status: 'ativo',
          aceito_em: row.aceito_em,
          criado_por: row.criado_por,
          created_at: row.created_at,
        })
      }
      roster = Array.from(byManager.values())
    }

    const managerIds = roster.map((r) => r.manager_id).filter(Boolean)
    const [{ data: managers }, { data: links }, { data: champs }, { data: pendingInvites }] = await Promise.all([
      managerIds.length
        ? supabaseAdmin
            .from('managers')
            .select('id,nome,username,avatar_url,whatsapp_url,nome_publico_vendas,status,auth_user_id')
            .in('id', managerIds)
        : Promise.resolve({ data: [] as any[] }),
      managerIds.length
        ? supabaseAdmin
            .from('campeonato_vendedores')
            .select('id,campeonato_id,manager_id,manager_auth_user_id,limite_vagas,permissoes,status,nome_publico,whatsapp_url')
            .eq('produtora_id', produtora.id)
            .in('manager_id', managerIds)
            .neq('status', 'cancelado')
        : Promise.resolve({ data: [] as any[] }),
      supabaseAdmin
        .from('campeonatos')
        .select('id,nome,logo_url,status')
        .eq('produtora_id', produtora.id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false }),
      supabaseAdmin
        .from('tokens')
        .select('id,token,status,usado,manager_id,created_at,manager_limite_vagas,expira_em')
        .eq('produtora_id', produtora.id)
        .in('tipo', ['manager_invite_produtora', 'manager_invite'])
        .eq('usado', false)
        .eq('status', 'ativo')
        .is('manager_id', null)
        .order('created_at', { ascending: false })
        .limit(20),
    ])

    const managersById = new Map((managers || []).map((m) => [m.id, m]))
    const linksByManager = new Map<string, any[]>()
    for (const link of links || []) {
      const list = linksByManager.get(link.manager_id) || []
      list.push(link)
      linksByManager.set(link.manager_id, list)
    }
    const champsById = new Map((champs || []).map((c) => [c.id, c]))

    // Uso de vagas por vendedor no campeonato filtrado (criado_por = auth do manager)
    const usageByAuth = new Map<string, number>()
    if (campeonatoFilter) {
      const authIds = Array.from(
        new Set(
          (links || [])
            .filter((l) => l.campeonato_id === campeonatoFilter)
            .map((l) => {
              const m = managersById.get(l.manager_id)
              return m?.auth_user_id || roster.find((r) => r.manager_id === l.manager_id)?.manager_auth_user_id
            })
            .filter(Boolean),
        ),
      )
      // managers select didn't include auth_user_id — fetch usage via manager_auth from links table
      const { data: linksWithAuth } = await supabaseAdmin
        .from('campeonato_vendedores')
        .select('manager_id,manager_auth_user_id')
        .eq('campeonato_id', campeonatoFilter)
        .eq('produtora_id', produtora.id)
        .eq('status', 'ativo')
      const authList = (linksWithAuth || []).map((l) => l.manager_auth_user_id).filter(Boolean)
      if (authList.length) {
        const { data: parts } = await supabaseAdmin
          .from('campeonato_equipes')
          .select('criado_por')
          .eq('campeonato_id', campeonatoFilter)
          .eq('status', 'ativo')
          .in('origem_entrada', ['vendedor', 'convite', 'inscricao', 'link'])
          .in('criado_por', authList)
        for (const p of parts || []) {
          if (!p.criado_por) continue
          usageByAuth.set(p.criado_por, (usageByAuth.get(p.criado_por) || 0) + 1)
        }
      }
      // map manager_id -> usage via auth
      for (const l of linksWithAuth || []) {
        if (l.manager_id && l.manager_auth_user_id) {
          const used = usageByAuth.get(l.manager_auth_user_id) || 0
          usageByAuth.set(`m:${l.manager_id}`, used)
        }
      }
    }

    const vendedores = roster.map((row) => {
      const manager = managersById.get(row.manager_id) || null
      const assignments = (linksByManager.get(row.manager_id) || []).map((link) => ({
        ...link,
        campeonato: champsById.get(link.campeonato_id) || null,
        no_campeonato_atual: campeonatoFilter ? link.campeonato_id === campeonatoFilter : undefined,
      }))
      const onCurrent = campeonatoFilter
        ? assignments.find((a) => a.campeonato_id === campeonatoFilter) || null
        : null
      const vagasUsadas = usageByAuth.get(`m:${row.manager_id}`) || 0
      const limite = onCurrent?.limite_vagas != null ? Number(onCurrent.limite_vagas) : null
      return {
        id: row.id || row.manager_id,
        manager_id: row.manager_id,
        manager_auth_user_id: row.manager_auth_user_id || manager?.auth_user_id || null,
        nome_publico:
          row.nome_publico
          || manager?.nome_publico_vendas
          || manager?.nome
          || manager?.username
          || 'Vendedor',
        whatsapp_url: row.whatsapp_url || manager?.whatsapp_url || null,
        status: row.status || 'ativo',
        aceito_em: row.aceito_em,
        managers: manager,
        campeonatos: assignments,
        no_campeonato: Boolean(onCurrent),
        vinculo_atual: onCurrent,
        limite_vagas_atual: limite,
        vagas_usadas: vagasUsadas,
        vagas_restantes: limite && limite > 0 ? Math.max(0, limite - vagasUsadas) : null,
        public_url: `/vendedores/${row.manager_id}`,
      }
    })

    return NextResponse.json({
      produtora: { id: produtora.id, nome: produtora.name },
      vendedores,
      campeonatos: champs || [],
      convites_pendentes: (pendingInvites || []).map((t) => ({
        id: t.id,
        token: t.token,
        created_at: t.created_at,
        link: null as string | null,
      })),
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao listar vendedores.' },
      { status: 400 },
    )
  }
}

/** Gera convite da produtora (1 link → manager vira vendedor da produtora). */
export async function POST(req: NextRequest) {
  try {
    const { user, produtora } = await requireProdutoraAccount(req)
    const body = await req.json().catch(() => ({}))
    const action = String(body.action || 'invite').trim()

    // Remover vendedor deste campeonato (não remove da produtora)
    if (action === 'detach') {
      const managerId = String(body.manager_id || '').trim()
      const campeonatoId = String(body.campeonato_id || '').trim()
      if (!managerId || !campeonatoId) throw new Error('Informe o vendedor e o campeonato.')
      const { data: camp } = await supabaseAdmin
        .from('campeonatos')
        .select('id,produtora_id')
        .eq('id', campeonatoId)
        .eq('produtora_id', produtora.id)
        .maybeSingle()
      if (!camp) throw new Error('Campeonato não encontrado nesta produtora.')
      const { error } = await supabaseAdmin
        .from('campeonato_vendedores')
        .update({ status: 'cancelado', updated_at: new Date().toISOString() })
        .eq('campeonato_id', campeonatoId)
        .eq('manager_id', managerId)
      if (error) throw error
      return NextResponse.json({ ok: true, mensagem: 'Vendedor removido deste campeonato.' })
    }

    // Adicionar manager existente a um campeonato
    if (action === 'attach') {
      const managerId = String(body.manager_id || '').trim()
      const campeonatoId = String(body.campeonato_id || '').trim()
      const limiteVagas = sellerLimit(body.limite_vagas)
      const permissoes = body.permissoes ? normalizePerms(body.permissoes) : DEFAULT_PERMS
      if (!managerId || !campeonatoId) throw new Error('Informe o vendedor e o campeonato.')

      const { data: camp, error: campError } = await supabaseAdmin
        .from('campeonatos')
        .select('id,produtora_id,nome')
        .eq('id', campeonatoId)
        .eq('produtora_id', produtora.id)
        .is('deleted_at', null)
        .maybeSingle()
      if (campError) throw campError
      if (!camp) throw new Error('Campeonato não encontrado nesta produtora.')

      const { data: manager, error: managerError } = await supabaseAdmin
        .from('managers')
        .select('id,nome,username,auth_user_id,whatsapp_url,nome_publico_vendas')
        .eq('id', managerId)
        .maybeSingle()
      if (managerError) throw managerError
      if (!manager) throw new Error('Vendedor não encontrado.')

      // Garante roster
      await supabaseAdmin.from('produtora_vendedores').upsert(
        {
          produtora_id: produtora.id,
          manager_id: managerId,
          manager_auth_user_id: manager.auth_user_id,
          nome_publico: manager.nome_publico_vendas || manager.nome || manager.username,
          whatsapp_url: manager.whatsapp_url,
          status: 'ativo',
          aceito_em: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'produtora_id,manager_id' },
      )

      const token = novoToken()
      const { data: link, error: linkError } = await supabaseAdmin
        .from('campeonato_vendedores')
        .upsert(
          {
            token,
            campeonato_id: campeonatoId,
            produtora_id: produtora.id,
            manager_id: managerId,
            manager_auth_user_id: manager.auth_user_id,
            nome_publico: manager.nome_publico_vendas || manager.nome || manager.username,
            whatsapp_url: manager.whatsapp_url,
            status: 'ativo',
            limite_vagas: limiteVagas,
            permissoes,
            criado_por: user.id,
            aceito_em: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'campeonato_id,manager_id' },
        )
        .select('*')
        .maybeSingle()

      // unique parcial pode não ser onConflict — tenta insert ou update
      if (linkError) {
        const existing = await supabaseAdmin
          .from('campeonato_vendedores')
          .select('id')
          .eq('campeonato_id', campeonatoId)
          .eq('manager_id', managerId)
          .maybeSingle()
        if (existing.data?.id) {
          const { data: updated, error: upError } = await supabaseAdmin
            .from('campeonato_vendedores')
            .update({
              status: 'ativo',
              limite_vagas: limiteVagas,
              permissoes,
              whatsapp_url: manager.whatsapp_url,
              nome_publico: manager.nome_publico_vendas || manager.nome || manager.username,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existing.data.id)
            .select('*')
            .single()
          if (upError) throw upError
          return NextResponse.json({ ok: true, vinculo: updated, mensagem: `Vendedor atualizado em ${camp.nome}.` })
        }
        // insert simples
        const { data: inserted, error: insError } = await supabaseAdmin
          .from('campeonato_vendedores')
          .insert({
            token,
            campeonato_id: campeonatoId,
            produtora_id: produtora.id,
            manager_id: managerId,
            manager_auth_user_id: manager.auth_user_id,
            nome_publico: manager.nome_publico_vendas || manager.nome || manager.username,
            whatsapp_url: manager.whatsapp_url,
            status: 'ativo',
            limite_vagas: limiteVagas,
            permissoes,
            criado_por: user.id,
            aceito_em: new Date().toISOString(),
          })
          .select('*')
          .single()
        if (insError) throw insError
        return NextResponse.json({ ok: true, vinculo: inserted, mensagem: `Vendedor adicionado a ${camp.nome}.` }, { status: 201 })
      }

      return NextResponse.json({ ok: true, vinculo: link, mensagem: `Vendedor adicionado a ${camp.nome}.` }, { status: 201 })
    }

    // Convite geral da produtora
    const limiteVagas = sellerLimit(body.limite_vagas)
    const token = novoToken()
    const { data: convite, error } = await supabaseAdmin
      .from('tokens')
      .insert({
        token,
        tipo: 'manager_invite_produtora',
        campeonato_id: null,
        produtora_id: produtora.id,
        status: 'ativo',
        usado: false,
        criado_por: user.id,
        manager_limite_vagas: limiteVagas,
        manager_permissoes: DEFAULT_PERMS,
      })
      .select('*')
      .single()

    // Se tipo custom falhar, usa manager_invite sem campeonato
    if (error) {
      const retry = await supabaseAdmin
        .from('tokens')
        .insert({
          token,
          tipo: 'manager_invite',
          campeonato_id: null,
          produtora_id: produtora.id,
          status: 'ativo',
          usado: false,
          criado_por: user.id,
          manager_limite_vagas: limiteVagas,
          manager_permissoes: DEFAULT_PERMS,
        })
        .select('*')
        .single()
      if (retry.error) throw retry.error
      const link = `${req.nextUrl.origin}/vendedor/${token}`
      return NextResponse.json(
        {
          convite: retry.data,
          link,
          texto_whatsapp: [
            `Você recebeu um convite para vender vagas pela produtora ${produtora.name}.`,
            'Acesse o link, entre ou crie seu perfil de manager e cadastre seu WhatsApp de venda.',
            'Depois o produtor libera os campeonatos que você pode vender.',
            link,
          ].join('\n\n'),
          whatsapp_url: `https://wa.me/?text=${encodeURIComponent(`Convite de vendedor DropZone:\n${link}`)}`,
        },
        { status: 201 },
      )
    }

    const link = `${req.nextUrl.origin}/vendedor/${token}`
    const textoWhatsapp = [
      `Você recebeu um convite para vender vagas pela produtora ${produtora.name}.`,
      limiteVagas ? `Limite padrão sugerido: ${limiteVagas} vaga(s) por campeonato.` : '',
      'Acesse o link, entre ou crie seu perfil de manager e cadastre seu WhatsApp de venda.',
      'Depois o produtor libera os campeonatos que você pode vender.',
      link,
    ]
      .filter(Boolean)
      .join('\n\n')

    return NextResponse.json(
      {
        convite,
        link,
        texto_whatsapp: textoWhatsapp,
        whatsapp_url: `https://wa.me/?text=${encodeURIComponent(textoWhatsapp)}`,
      },
      { status: 201 },
    )
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao gerenciar vendedores.' },
      { status: 400 },
    )
  }
}
