import { supabaseAdmin } from '../../shared/supabase-admin'
import { listControllableEquipes } from '../../equipes/manager-team-access'
import { inserirParticipacaoNoSlot, resolveLineForInscricao, softRemoveParticipacao } from '../participacao-sync'
import { loadTeamInvite, teamInviteValid } from './team-invite-read'
import { assertTeamEnrollmentPermission, type InviteActor } from './types'
import { readPagedRows } from '../../shared/paginated-query'
import { assertEnrollmentOpen } from './enrollment-policy'

export async function acceptTeamInvite(actor: InviteActor, token: string, body: Record<string, any>) {
  let createdParticipation: any = null
  try {
    const { user, accounts } = actor
    const controllable = await listControllableEquipes(user.id, accounts)
    if (!controllable.length) {
      throw new Error('Este login não controla nenhuma equipe. Crie ou aceite um convite de staff primeiro.')
    }
    const equipeIdInformada = String(body.equipe_id || '').trim()
    const selectedTeam = equipeIdInformada
      ? controllable.find((e) => e.id === equipeIdInformada)
      : controllable.length === 1
        ? controllable[0]
        : null
    if (!selectedTeam) throw new Error('Selecione com qual equipe deseja entrar neste campeonato.')
    assertTeamEnrollmentPermission(selectedTeam, body.line_id)
    const account = {
      id: selectedTeam.id,
      name: selectedTeam.nome,
      data: { tag: selectedTeam.tag, logo_url: selectedTeam.logo_url },
    }

    const { convite, slot: slotFixo, modoGrupo, grupo } = await loadTeamInvite(token, false)

    if (!teamInviteValid(convite)) {
      throw new Error('Este convite expirou ou já foi utilizado.')
    }
    await assertEnrollmentOpen(convite.campeonato_id)

    let slotUsado: any = slotFixo

    if (slotFixo) {
      if (slotFixo.equipe_id || slotFixo.line_id) {
        throw new Error('Este slot já foi ocupado. Peça um novo convite.')
      }
    } else if (modoGrupo) {
      // Auto-slot: usa slot informado ou o primeiro livre (espelho + participações)
      const slotIdInformado = String(body.slot_id || '').trim()
      const [slots, partsAtivas] =
        await Promise.all([
          readPagedRows<any>(supabaseAdmin
            .from('campeonato_slots')
            .select('id,slot_numero,slot_letra,equipe_id,line_id,grupo_id,campeonato_id')
            .eq('campeonato_id', convite.campeonato_id)
            .eq('grupo_id', convite.grupo_id)
            .order('slot_numero', { ascending: true }).order('id', { ascending: true })),
          readPagedRows<any>(supabaseAdmin
            .from('campeonato_equipes')
            .select('slot_id,slot_numero')
            .eq('campeonato_id', convite.campeonato_id)
            .eq('grupo_id', convite.grupo_id)
            .eq('status', 'ativo').order('id', { ascending: true })),
        ])

      const occupiedIds = new Set((partsAtivas || []).map((p) => p.slot_id).filter(Boolean).map(String))
      const occupiedNums = new Set(
        (partsAtivas || [])
          .map((p) => (p.slot_numero != null ? Number(p.slot_numero) : null))
          .filter((n) => n != null && Number.isFinite(n)),
      )
      const isFree = (s: any) =>
        !s.equipe_id
        && !s.line_id
        && !occupiedIds.has(String(s.id))
        && !occupiedNums.has(Number(s.slot_numero))

      const slotEscolhido = slotIdInformado
        ? slots.find(s => s.id === slotIdInformado) || null
        : slots.find(s => isFree(s)) || null

      if (!slotEscolhido) throw new Error('Nenhum slot livre neste grupo no momento.')
      if (!isFree(slotEscolhido)) {
        throw new Error('Esse slot já foi preenchido. Tente novamente.')
      }

      slotUsado = slotEscolhido
    } else {
      throw new Error('Este convite não está vinculado a um slot ou grupo válido.')
    }

    const resolved = await resolveLineForInscricao({
      equipeId: account.id,
      campeonatoId: convite.campeonato_id,
      lineId: body.line_id ? String(body.line_id) : null,
      nomeLine: String(body.nome_line || '').trim() || null,
      tag: account.data?.tag || null,
      logoUrl: account.data?.logo_url || null,
    })

    const participacao = await inserirParticipacaoNoSlot({
      campeonatoId: convite.campeonato_id, slotId: slotUsado.id,
      lineId: resolved.id, equipeId: account.id, nomeExibicao: resolved.nome,
      origem: 'convite', criadoPor: user.id,
    })
    createdParticipation = participacao
    await assertEnrollmentOpen(convite.campeonato_id)

    // Marca token como usado de forma condicional (atômico no nível do flag usado)
    const { data: tokenUsed, error: tokenError } = await supabaseAdmin
      .from('tokens')
      .update({
        usado: true,
        usado_em: new Date().toISOString(),
        status: 'usado',
        equipe_id: account.id,
        line_destino_id: resolved.id,
        ...(slotUsado?.id ? { slot_id: slotUsado.id } : {}),
      })
      .eq('id', convite.id)
      .eq('usado', false)
      .eq('status', 'ativo')
      .or(`expira_em.is.null,expira_em.gt.${new Date().toISOString()}`)
      .select('id')
      .maybeSingle()
    if (tokenError) throw tokenError
    if (!tokenUsed) {
      await softRemoveParticipacao(participacao.id, participacao)
      createdParticipation = null
      throw new Error('Este convite já foi utilizado. Atualize a página.')
    }

    return {
      ok: true,
      participacao,
      equipe: { id: account.id, nome: account.name },
      line: { id: resolved.id, nome: resolved.nome, criada_agora: resolved.criada_agora },
      grupo: grupo ? { id: grupo.id, nome: grupo.nome } : null,
      slot: slotUsado
        ? { id: slotUsado.id, letra: slotUsado.slot_letra, numero: slotUsado.slot_numero }
        : null,
      slot_letra: slotUsado?.slot_letra || null,
      mensagem: resolved.criada_agora
        ? `Line "${resolved.nome}" criada e inscrita.`
        : `Line "${resolved.nome}" inscrita.`,
    }
  } catch (error) {
    if (createdParticipation) {
      try {
        await softRemoveParticipacao(createdParticipation.id, createdParticipation)
      } catch {
        // ignore
      }
    }
    throw error
  }
}
