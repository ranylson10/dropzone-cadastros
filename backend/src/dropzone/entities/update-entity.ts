import { assertPodeCriarSlots } from "@backend/campeonatos/capacidade";
import { inserirParticipacaoNoSlot, resolveLineForInscricao } from "@backend/campeonatos/participacao-sync";
import { supabaseAdmin } from "@backend/shared/supabase-admin";
import { syncRulebookFromCampeonato } from "@backend/campeonatos/rulebook";
import { encodeLinkDescricao, extractHumanDescricao, isMissingMetadataColumn, parseExpectedTeamsFromText, parseLinkMetadata, registrationLinkData } from "@backend/shared/campeonato-link-metadata";
import { randomToken } from "@backend/shared/validation";
import { baseRow, championshipRow } from '@backend/dropzone/entities/records'
import { parseOptionalDateTime } from '@backend/dropzone/entities/tokens'
import { requireChampionshipOwner, freeSlotParticipation } from '@backend/dropzone/entities/permissions'
import { normalizeChampionshipType, championshipConfigurationPayload, saveChampionshipConfiguration } from '@backend/dropzone/entities/championship-config'
import type { EntityContext } from './context'

export async function updateEntity(context: EntityContext, body: Record<string, any>) {
    const { user, account } = context
    if (account.profile_type !== 'produtora')
        throw new Error('Somente a produtora pode editar esta estrutura.');
    const entityType = String(body.entity_type || '');
    const id = String(body.id || '');
    const data = body.data || {};
    if (entityType === 'championship') {
        await requireChampionshipOwner(id, user.id, account.id, 'administrar');
        const { data: currentChamp, error: currentChampError } = await supabaseAdmin
            .from('campeonatos')
            .select('aprovacao_status')
            .eq('id', id)
            .maybeSingle();
        if (currentChampError)
            throw currentChampError;
        if (currentChamp?.aprovacao_status && currentChamp.aprovacao_status !== 'aprovado') {
            throw new Error('Campeonato aguardando liberação. Pague via PIX ou aguarde o admin liberar para editar.');
        }
        const nome = String(data.nome || '').trim();
        const logoUrl = String(data.logo_url || '').trim();
        const bannerUrl = String(data.banner_url || '').trim() || null;
        if (!nome || !logoUrl)
            throw new Error('Informe nome e logo do campeonato.');
        const { data: updated, error } = await supabaseAdmin.from('campeonatos').update({ nome, logo_url: logoUrl, banner_url: bannerUrl, tipo: normalizeChampionshipType(data.tipo) }).eq('id', id).select('*').single();
        if (error)
            throw error;
        const { data: configuration, warning } = await saveChampionshipConfiguration(championshipConfigurationPayload(data, id));
        // Mantém rulebook alinhado (premiação, taxa, transmissão, etc.)
        try {
            await syncRulebookFromCampeonato(id);
        }
        catch {
            // best-effort
        }
        context.invalidateTag('directory:campeonatos');
        context.invalidatePath(`/campeonatos/${id}`);
        return {
            row: championshipRow({ ...updated, campeonato_configuracoes: configuration }),
            ...(warning ? { warning } : {}),
        };
    }
    if (entityType === 'phase') {
        const { data: current, error: readError } = await supabaseAdmin.from('campeonato_fases').select('campeonato_id').eq('id', id).single();
        if (readError)
            throw readError;
        await requireChampionshipOwner(current.campeonato_id, user.id, account.id);
        const { data: updated, error } = await supabaseAdmin.from('campeonato_fases').update({ nome: String(data.nome || '').trim(), ordem: Number(data.ordem || 1), updated_at: new Date().toISOString() }).eq('id', id).select('*').single();
        if (error?.code === '23505')
            throw new Error('Ja existe uma fase com esse nome neste campeonato.');
        if (error)
            throw error;
        return { row: baseRow(updated, 'phase', { data: updated }) };
    }
    if (entityType === 'group') {
        const { data: current, error: readError } = await supabaseAdmin.from('campeonato_grupos').select('*').eq('id', id).single();
        if (readError)
            throw readError;
        await requireChampionshipOwner(current.campeonato_id, user.id, account.id);
        const requestedSlots = Number(data.slots || current.slots);
        const { count: occupied } = await supabaseAdmin.from('campeonato_slots').select('id', { count: 'exact', head: true }).eq('grupo_id', id).not('equipe_id', 'is', null).gt('slot_numero', requestedSlots);
        if ((occupied || 0) > 0)
            throw new Error('Não é possível remover slots ocupados.');
        const { data: updated, error } = await supabaseAdmin.from('campeonato_grupos').update({ nome: String(data.nome || current.nome).trim(), slots: requestedSlots, whatsapp_url: String(data.whatsapp_url || '').trim() || null, updated_at: new Date().toISOString() }).eq('id', id).select('*').single();
        if (error?.code === '23505')
            throw new Error('Ja existe um grupo com esse nome nesta fase.');
        if (error)
            throw error;
        if (requestedSlots > current.slots) {
            const novos = requestedSlots - Number(current.slots || 0);
            // Limite de vagas só vale na fase de entrada; fases seguintes = classificados
            await assertPodeCriarSlots(current.campeonato_id, novos, { faseId: current.fase_id || null });
            const additions = Array.from({ length: novos }, (_, offset) => {
                const number = Number(current.slots || 0) + offset + 1;
                let value = number;
                let label = '';
                while (value > 0) {
                    value -= 1;
                    label = String.fromCharCode(65 + (value % 26)) + label;
                    value = Math.floor(value / 26);
                }
                return {
                    campeonato_id: current.campeonato_id,
                    fase_id: current.fase_id,
                    grupo_id: id,
                    slot_numero: number,
                    slot_letra: label,
                    status: 'livre',
                };
            });
            const { error: addError } = await supabaseAdmin.from('campeonato_slots').insert(additions);
            if (addError)
                throw addError;
        }
        else if (requestedSlots < current.slots) {
            const { error: removeError } = await supabaseAdmin.from('campeonato_slots').delete().eq('grupo_id', id).gt('slot_numero', requestedSlots).is('equipe_id', null);
            if (removeError)
                throw removeError;
        }
        return { row: baseRow(updated, 'group', { data: updated }) };
    }
    if (entityType === 'group_slot') {
        const { data: current, error: readError } = await supabaseAdmin.from('campeonato_slots').select('*').eq('id', id).single();
        if (readError)
            throw readError;
        await requireChampionshipOwner(current.campeonato_id, user.id, account.id);
        const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (data.slot_letra !== undefined) {
            const slotLetter = String(data.slot_letra || '').trim().toUpperCase();
            if (!/^[A-Z]{1,3}$/.test(slotLetter))
                throw new Error('A letra do slot deve usar apenas letras de A a Z.');
            patch.slot_letra = slotLetter;
        }
        if (data.equipe_id !== undefined) {
            if (data.equipe_id) {
                // Ocupar slot via helper enxuto (cria/atualiza participação + espelho)
                const resolved = await resolveLineForInscricao({
                    equipeId: String(data.equipe_id),
                    campeonatoId: current.campeonato_id,
                    lineId: data.line_id || null,
                    nomeLine: data.nome_line || data.nome_exibicao || null,
                });
                // Se já tem part ativa neste slot, soft-remove antes de reinscrever
                if (current.equipe_id || current.line_id) {
                    await freeSlotParticipation(current);
                }
                await inserirParticipacaoNoSlot({
                    campeonatoId: current.campeonato_id,
                    slotId: current.id,
                    lineId: resolved.id,
                    equipeId: String(data.equipe_id),
                    nomeExibicao: resolved.nome,
                    origem: 'organizador',
                    criadoPor: user.id,
                });
                const { data: updated, error } = await supabaseAdmin.from('campeonato_slots').select('*').eq('id', id).single();
                if (error)
                    throw error;
                return { row: baseRow(updated, 'group_slot', { data: updated }) };
            }
            // Liberar slot
            await freeSlotParticipation(current);
            if (data.slot_letra !== undefined) {
                const { data: updated, error } = await supabaseAdmin
                    .from('campeonato_slots')
                    .update({ slot_letra: patch.slot_letra, updated_at: new Date().toISOString() })
                    .eq('id', id)
                    .select('*')
                    .single();
                if (error)
                    throw error;
                return { row: baseRow(updated, 'group_slot', { data: updated }) };
            }
            const { data: updated, error } = await supabaseAdmin.from('campeonato_slots').select('*').eq('id', id).single();
            if (error)
                throw error;
            return { row: baseRow(updated, 'group_slot', { data: updated }) };
        }
        const { data: updated, error } = await supabaseAdmin.from('campeonato_slots').update(patch).eq('id', id).select('*').single();
        if (error?.code === '23505')
            throw new Error('Essa letra ja esta sendo usada neste grupo ou esta line ja esta em outro grupo da fase.');
        if (error)
            throw error;
        return { row: baseRow(updated, 'group_slot', { data: updated }) };
    }
    if (entityType === 'registration_link') {
        const { data: current, error: readError } = await supabaseAdmin.from('campeonato_links').select('*').eq('id', id).single();
        if (readError)
            throw readError;
        await requireChampionshipOwner(current.campeonato_id, user.id, account.id);
        const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (data.ativo !== undefined)
            patch.ativo = Boolean(data.ativo);
        if (data.expira_em !== undefined || data.encerra_em !== undefined) {
            patch.expira_em = parseOptionalDateTime(data.expira_em || data.encerra_em, {
                fieldLabel: 'Data de encerramento do link',
                requireFuture: Boolean(data.expira_em || data.encerra_em),
            });
        }
        if (data.regenerate_token) {
            patch.token = randomToken(current.tipo === 'inscricao_equipes_grupo' ? 'EQS' : 'INSC');
        }
        if (data.titulo !== undefined || data.nome_interno !== undefined) {
            patch.titulo = String(data.titulo ?? data.nome_interno ?? '').trim() || current.titulo;
        }
        const currentMeta = parseLinkMetadata(current);
        // Sempre regrava descricao com meta embutida (funciona sem coluna metadata)
        if (data.limite_vagas !== undefined
            || data.expected_teams !== undefined
            || data.equipes_esperadas_texto !== undefined
            || data.descricao !== undefined
            || data.ativo !== undefined
            || data.regenerate_token
            || data.reset_usos !== undefined) {
            const limiteNext = data.limite_vagas !== undefined
                ? Math.max(1, Number(data.limite_vagas) || 1)
                : currentMeta.limite_vagas;
            // Reativar: limpa closed_reason. usos = entradas reais (nunca zerar cegamente).
            let usosNext = Math.max(currentMeta.usos, currentMeta.entradas.length);
            let closedReason = currentMeta.closed_reason;
            let closedAt = currentMeta.closed_at;
            if (data.ativo === true || data.reset_usos === true || data.reset_usos === 'true') {
                closedReason = undefined;
                closedAt = undefined;
                // Histórico permanece; contador reflete quem já entrou
                usosNext = currentMeta.entradas.length;
            }
            const expectedNext = data.expected_teams !== undefined || data.equipes_esperadas_texto !== undefined
                ? parseExpectedTeamsFromText(data.expected_teams ?? data.equipes_esperadas_texto)
                : currentMeta.expected_teams;
            const metaNext = {
                limite_vagas: limiteNext,
                usos: usosNext,
                expected_teams: expectedNext,
                entradas: currentMeta.entradas,
                ...(closedReason ? { closed_reason: closedReason } : {}),
                ...(closedAt ? { closed_at: closedAt } : {}),
            };
            const human = data.descricao !== undefined
                ? String(data.descricao || '')
                : extractHumanDescricao(current.descricao);
            patch.descricao = encodeLinkDescricao(metaNext, human);
            patch.metadata = metaNext;
        }
        let { data: updated, error } = await supabaseAdmin.from('campeonato_links').update(patch).eq('id', id).select('*').single();
        if (error && isMissingMetadataColumn(error)) {
            const { metadata: _meta, ...withoutMeta } = patch;
            const retry = await supabaseAdmin.from('campeonato_links').update(withoutMeta).eq('id', id).select('*').single();
            updated = retry.data;
            error = retry.error;
        }
        if (error)
            throw error;
        return { row: baseRow(updated, 'registration_link', { data: registrationLinkData(updated) }) };
    }
    throw new Error('Tipo de edicao nao suportado.');
}
