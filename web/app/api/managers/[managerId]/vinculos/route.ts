import { NextRequest, NextResponse } from 'next/server'
import { getBearerUser, getAccountsForUser } from '@backend/auth/server-auth'
import { isMissingRelation } from '@backend/equipes/manager-invites'
import { supabaseAdmin } from '@backend/shared/supabase-admin'

/**
 * Lista onde o manager é ajudante (staff), separado por contexto:
 * - equipes (manager_equipe)
 * - produtoras (manager_produtora)
 * - jogadores (manager_jogador)
 *
 * Não altera autenticação nem convites de campeonato.
 */
export async function GET(req: NextRequest, context: { params: Promise<{ managerId: string }> }) {
  try {
    const user = await getBearerUser(req)
    const { managerId } = await context.params

    const accounts = await getAccountsForUser(user)
    const manager = accounts.find((a) => a.profile_type === 'manager' && a.id === managerId)
    if (!manager) {
      // também aceita se o manager_id for o perfil manager da conta
      const anyManager = accounts.find((a) => a.profile_type === 'manager')
      if (!anyManager || anyManager.id !== managerId) {
        throw new Error('Sem permissão para ver vínculos deste manager.')
      }
    }

    const [eqRes, prRes, jgRes] = await Promise.all([
      supabaseAdmin
        .from('manager_equipe')
        .select('id,manager_id,equipe_id,pode_ver,pode_editar,pode_escalar,pode_gerar_token,status,created_at')
        .eq('manager_id', managerId)
        .eq('status', 'ativo')
        .order('created_at', { ascending: false }),
      supabaseAdmin
        .from('manager_produtora')
        .select(
          'id,manager_id,produtora_id,pode_ver,pode_editar,pode_criar_campeonato,pode_gerenciar_campeonato,pode_gerar_token,status,created_at',
        )
        .eq('manager_id', managerId)
        .eq('status', 'ativo')
        .order('created_at', { ascending: false }),
      supabaseAdmin
        .from('manager_jogador')
        .select('id,manager_id,jogador_id,pode_ver,pode_editar,status,created_at')
        .eq('manager_id', managerId)
        .eq('status', 'ativo')
        .order('created_at', { ascending: false }),
    ])

    // tabelas opcionais / ausentes → lista vazia (não quebra painel)
    const equipesLink = isMissingRelation(eqRes.error) ? [] : eqRes.error ? (() => { throw eqRes.error })() : (eqRes.data || [])
    const produtorasLink = isMissingRelation(prRes.error) ? [] : prRes.error ? (() => { throw prRes.error })() : (prRes.data || [])
    const jogadoresLink = isMissingRelation(jgRes.error) ? [] : jgRes.error ? (() => { throw jgRes.error })() : (jgRes.data || [])

    const equipeIds = [...new Set(equipesLink.map((r: any) => r.equipe_id).filter(Boolean))]
    const produtoraIds = [...new Set(produtorasLink.map((r: any) => r.produtora_id).filter(Boolean))]
    const jogadorIds = [...new Set(jogadoresLink.map((r: any) => r.jogador_id).filter(Boolean))]

    const [equipes, produtoras, jogadores] = await Promise.all([
      equipeIds.length
        ? supabaseAdmin.from('equipes').select('id,nome,username,logo_url,status,public_id').in('id', equipeIds)
        : Promise.resolve({ data: [] as any[], error: null }),
      produtoraIds.length
        ? supabaseAdmin.from('produtoras').select('id,nome,username,logo_url,status,public_id').in('id', produtoraIds)
        : Promise.resolve({ data: [] as any[], error: null }),
      jogadorIds.length
        ? supabaseAdmin.from('jogadores').select('id,nome,username,avatar_url,status,public_id').in('id', jogadorIds)
        : Promise.resolve({ data: [] as any[], error: null }),
    ])

    if (equipes.error) throw equipes.error
    if (produtoras.error) throw produtoras.error
    if (jogadores.error) throw jogadores.error

    const eqMap = new Map((equipes.data || []).map((e) => [e.id, e]))
    const prMap = new Map((produtoras.data || []).map((p) => [p.id, p]))
    const jgMap = new Map((jogadores.data || []).map((j) => [j.id, j]))

    return NextResponse.json({
      equipes: equipesLink.map((row: any) => ({
        vinculo_id: row.id,
        tipo: 'equipe' as const,
        permissoes: {
          pode_ver: row.pode_ver !== false,
          pode_editar: Boolean(row.pode_editar),
          pode_escalar: Boolean(row.pode_escalar),
          pode_gerar_token: Boolean(row.pode_gerar_token),
        },
        alvo: eqMap.get(row.equipe_id) || { id: row.equipe_id, nome: 'Equipe' },
        created_at: row.created_at,
      })),
      produtoras: produtorasLink.map((row: any) => ({
        vinculo_id: row.id,
        tipo: 'produtora' as const,
        permissoes: {
          pode_ver: row.pode_ver !== false,
          pode_editar: Boolean(row.pode_editar),
          pode_criar_campeonato: Boolean(row.pode_criar_campeonato),
          pode_gerenciar_campeonato: Boolean(row.pode_gerenciar_campeonato),
          pode_gerar_token: Boolean(row.pode_gerar_token),
        },
        alvo: prMap.get(row.produtora_id) || { id: row.produtora_id, nome: 'Produtora' },
        created_at: row.created_at,
      })),
      jogadores: jogadoresLink.map((row: any) => ({
        vinculo_id: row.id,
        tipo: 'jogador' as const,
        permissoes: {
          pode_ver: row.pode_ver !== false,
          pode_editar: Boolean(row.pode_editar),
        },
        alvo: jgMap.get(row.jogador_id) || { id: row.jogador_id, nome: 'Jogador' },
        created_at: row.created_at,
      })),
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro ao listar vínculos.' }, { status: 400 })
  }
}
