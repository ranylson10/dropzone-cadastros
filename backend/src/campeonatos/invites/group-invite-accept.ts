import { supabaseAdmin } from '../../shared/supabase-admin'
import { readPagedRows } from '../../shared/paginated-query'
import { assertCampeonatoNoAr } from '../../admin/aprovacao'
import { listControllableEquipes } from '../../equipes/manager-team-access'
import { inserirParticipacaoNoSlot, resolveLineForInscricao, softRemoveParticipacao } from '../participacao-sync'
import { parseLinkMetadata, matchExpectedTeamReference } from '../../shared/campeonato-link-metadata'
import { assertTeamEnrollmentPermission, type InviteActor } from './types'
import { loadLinkForInscricao, consumirVagaDoLink, devolverVagaDoLink, registrarEntradaNoLink, maybeCloseGroupLinkAfterUse } from './group-link-state'
import { assertEnrollmentOpen } from './enrollment-policy'

export async function acceptGroupInvite(actor: InviteActor, token: string, body: any) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Dados de inscrição inválidos.')
  let createdParticipacaoId: string | null = null
  let createdParticipation: any = null
  let consumo: Awaited<ReturnType<typeof consumirVagaDoLink>> | null = null

  try {
    const { user, accounts } = actor
    const vagaIndex = Number(body.vaga_index)
    const slotIdInformado = String(body.slot_id || '').trim()
    const lineIdInformada = String(body.line_id || '').trim()
    const nomeNovaLine = String(body.nome_line || '').trim()
    const equipeIdInformada = String(body.equipe_id || '').trim()
    // referência da lista é opcional/legado; preferimos match automático
    const referenciaInformada = String(body.referencia_equipe || body.nome_lista || '').trim()

    const controllable = await listControllableEquipes(user.id, accounts)
    if (!controllable.length) {
      throw new Error('Este login não controla nenhuma equipe. Crie ou aceite um convite de staff primeiro.')
    }
    const selectedTeam = equipeIdInformada
      ? controllable.find((e) => e.id === equipeIdInformada)
      : controllable.length === 1
        ? controllable[0]
        : null
    if (!selectedTeam) {
      throw new Error('Selecione com qual equipe deseja entrar neste campeonato.')
    }
    assertTeamEnrollmentPermission(selectedTeam, lineIdInformada)
    const account = {
      id: selectedTeam.id,
      name: selectedTeam.nome,
      data: { tag: selectedTeam.tag, logo_url: selectedTeam.logo_url },
    }

    const link = await loadLinkForInscricao(token)
    await assertCampeonatoNoAr(link.campeonato_id)
    const meta = parseLinkMetadata(link)
    const expected = meta.expected_teams

    // Resolve slot: informado, índice, ou primeiro livre (auto-slot)
    // Considera tanto colunas do slot quanto participações ativas (evita desync do espelho).
    let slot: any = null
    const [slotsGrupo, partsAtivas] = await Promise.all([
      readPagedRows<any>(supabaseAdmin.from('campeonato_slots')
        .select('id,slot_numero,slot_letra,equipe_id,line_id,grupo_id,campeonato_id')
        .eq('campeonato_id', link.campeonato_id).eq('grupo_id', link.grupo_id).order('slot_numero').order('id')),
      readPagedRows<any>(supabaseAdmin.from('campeonato_equipes')
        .select('id,slot_id,slot_numero,line_id').eq('campeonato_id', link.campeonato_id)
        .eq('grupo_id', link.grupo_id).eq('status', 'ativo').order('id')),
    ])
    if (!slotsGrupo?.length) {
      throw new Error('Este grupo ainda nao possui slots. Crie o grupo novamente ou regenere os slots.')
    }

    const occupiedSlotIds = new Set(
      (partsAtivas || []).map((p) => p.slot_id).filter(Boolean).map(String),
    )
    const occupiedSlotNums = new Set(
      (partsAtivas || [])
        .filter(p => !p.slot_id)
        .map((p) => (p.slot_numero != null ? Number(p.slot_numero) : null))
        .filter((n) => n != null && Number.isFinite(n)),
    )
    const isSlotFree = (s: any) =>
      !s.equipe_id
      && !s.line_id
      && !occupiedSlotIds.has(String(s.id))
      && !occupiedSlotNums.has(Number(s.slot_numero))

    if (slotIdInformado) {
      slot = slotsGrupo.find((s) => s.id === slotIdInformado) || null
    } else if (Number.isInteger(vagaIndex) && vagaIndex >= 0) {
      slot = slotsGrupo[vagaIndex] || null
    } else {
      slot = slotsGrupo.find((s) => isSlotFree(s)) || null
    }

    if (!slot) throw new Error('Nenhum slot livre neste grupo no momento.')
    if (!isSlotFree(slot)) throw new Error('Esse slot ja foi preenchido. Tente novamente.')

    const resolvedLine = await resolveLineForInscricao({
      equipeId: account.id,
      campeonatoId: link.campeonato_id,
      lineId: lineIdInformada || null,
      nomeLine: nomeNovaLine || null,
      tag: account.data?.tag || null,
      logoUrl: account.data?.logo_url || null,
    })

    // Reject invalid/foreign lines before touching the counter. A new line can still
    // remain if a later step fails; that requires the pending DB transaction.
    consumo = await consumirVagaDoLink(link)

    // nome_exibicao = nome real da line, nunca a etiqueta de referência do admin
    const nomeExibicao = resolvedLine.nome

    // Match automático da lista interna (não bloqueia inscrição)
    const claimedRefs = (meta.entradas || [])
      .map((e) => String(e.referencia_lista || '').trim())
      .filter(Boolean)
    let referenciaEquipe = referenciaInformada || ''
    if (expected.length) {
      if (referenciaEquipe) {
        const existsInList = expected.some((nome) => nome.trim().toLowerCase() === referenciaEquipe.toLowerCase())
        if (!existsInList) referenciaEquipe = ''
        else {
          const alreadyOnLink = claimedRefs.some((key) => key.toLowerCase() === referenciaEquipe.toLowerCase())
          if (alreadyOnLink) referenciaEquipe = ''
        }
      }
      if (!referenciaEquipe) {
        referenciaEquipe =
          matchExpectedTeamReference({
            expectedTeams: expected,
            claimedReferences: claimedRefs,
            equipeNome: account.name,
            lineNome: resolvedLine.nome,
          }) || ''
      }
    }

    let participacao: any
    try {
      participacao = await inserirParticipacaoNoSlot({
        campeonatoId: link.campeonato_id,
        slotId: slot.id,
        lineId: resolvedLine.id,
        equipeId: account.id,
        nomeExibicao,
        origem: 'link',
        criadoPor: user.id,
      })
    } catch (insertError) {
      throw insertError
    }
    createdParticipacaoId = participacao.id
    createdParticipation = participacao
    await assertEnrollmentOpen(link.campeonato_id)

    const letra = String(slot.slot_letra || '').trim().toUpperCase() || String(slot.slot_numero)

    // Histórico: quem entrou por este link (+ match automático na lista do admin)
    try {
      await registrarEntradaNoLink(
        link,
        {
          participacao_id: String(participacao.id),
          equipe_id: account.id,
          equipe_nome: account.name || null,
          line_id: resolvedLine.id,
          line_nome: resolvedLine.nome || null,
          slot_id: slot.id,
          slot_letra: letra,
          slot_numero: slot.slot_numero != null ? Number(slot.slot_numero) : null,
          referencia_lista: referenciaEquipe || null,
          entrou_em: new Date().toISOString(),
        },
      )
    } catch {
      // inscrição ok; histórico é best-effort
    }

    // Fecha só após o aceite: limite do link ou grupo sem slots livres
    try {
      await maybeCloseGroupLinkAfterUse(link)
    } catch {
      // inscrição já concluída; fechamento do link é best-effort
    }

    // valor de inscrição (se houver) — frontend pode abrir ASAAS
    let valorInscricao: number | null = null
    try {
      const { data: cfg } = await supabaseAdmin
        .from('campeonato_configuracoes')
        .select('valor_inscricao')
        .eq('campeonato_id', link.campeonato_id)
        .maybeSingle()
      if (cfg?.valor_inscricao != null && Number(cfg.valor_inscricao) > 0) {
        valorInscricao = Number(cfg.valor_inscricao)
      }
    } catch {
      // ignore
    }

    return {
      ok: true,
      participacao,
      campeonato_equipe_id: participacao?.id || createdParticipacaoId,
      equipe: { id: account.id, nome: account.name },
      line: { id: resolvedLine.id, nome: resolvedLine.nome, criada_agora: resolvedLine.criada_agora },
      grupo_id: link.grupo_id,
      slot_id: slot.id,
      slot_letra: letra,
      referencia: referenciaEquipe || resolvedLine.nome || `Slot ${letra}`,
      valor_inscricao: valorInscricao,
      precisa_pagamento: Boolean(valorInscricao && valorInscricao >= 1),
      link: {
        limite_vagas: consumo.limite,
        usos: consumo.usos,
        restantes: consumo.restantes,
        encerrado: consumo.restantes <= 0,
      },
      mensagem: resolvedLine.criada_agora
        ? `Line "${resolvedLine.nome}" criada e inscrita no slot ${letra}.`
        : `Line "${resolvedLine.nome}" inscrita no slot ${letra}.`,
    }
  } catch (error) {
    let removed = !createdParticipacaoId
    if (createdParticipacaoId) {
      try {
        await softRemoveParticipacao(createdParticipacaoId, createdParticipation || undefined)
        removed = true
      } catch {
        // ignore
      }
    }
    if (consumo && removed) {
      try { await devolverVagaDoLink(consumo) } catch { /* Keep later state intact on failure. */ }
    }
    throw error
  }
}
