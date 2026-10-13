import { assertPodeCriarSlots } from "@backend/campeonatos/capacidade";
import { inserirParticipacaoNoSlot, resolveLineForInscricao } from "@backend/campeonatos/participacao-sync";
import { supabaseAdmin } from "@backend/shared/supabase-admin";
import { requireProducerWorkspaceAccess } from "@backend/produtora/workspace-access";
import { buildGroupInviteShareMessage, encodeLinkDescricao, isMissingMetadataColumn, parseExpectedTeamsFromText, registrationLinkData } from "@backend/shared/campeonato-link-metadata";
import { randomToken } from "@backend/shared/validation";
import { saveTeamPlayer } from "@backend/equipes/player-roster";
import { baseRow, championshipRow } from '@backend/dropzone/entities/records'
import { TEAM_INVITE_TYPES, PLAYER_INVITE_TYPES, normalizeTokenKind, isTeamInviteKind, isPlayerInviteKind, consumeToken, parseOptionalDateTime } from '@backend/dropzone/entities/tokens'
import { canCreate, requireChampionshipOwner, requireManagedTeam, requireTeamInChampionship, getLineupRule, assertLineupOpen, assertPlayerCapacity, assertPlayerUniqueInChampionship, assertInviteAllowed, saveLineupRule } from '@backend/dropzone/entities/permissions'
import { normalizeChampionshipType, championshipConfigurationPayload, saveChampionshipConfiguration, normalizeGroupName } from '@backend/dropzone/entities/championship-config'
import type { EntityContext } from './context'

export async function createEntity(context: EntityContext, body: Record<string, any>) {
    const { user, account } = context
    const entityType = String(body.entity_type || '').trim();
    if (!canCreate(account.profile_type, entityType))
        throw new Error('Seu tipo de perfil nao pode criar esse cadastro.');
    let row: any;
    if (entityType === 'championship') {
        const data = body.data || {};
        const nome = String(body.name || data.nome || '').trim();
        const logoUrl = String(data.logo_url || '').trim();
        const bannerUrl = String(data.banner_url || '').trim() || null;
        if (!nome)
            throw new Error('Informe o nome do campeonato.');
        if (!logoUrl)
            throw new Error('Envie a logo do campeonato.');
        await requireProducerWorkspaceAccess(user.id, account.id, 'criar_campeonato');
        const { assertProdutoraAprovada } = await import('@backend/admin/aprovacao');
        await assertProdutoraAprovada(account.id);
        const championshipPayload: Record<string, unknown> = {
            nome,
            tipo: normalizeChampionshipType(data.tipo),
            logo_url: logoUrl,
            banner_url: bannerUrl,
            criado_por: user.id,
            produtora_id: account.id,
            status: 'ativo',
            // novo campeonato não vai ao ar até admin aprovar (+ cobrança)
            aprovacao_status: 'pendente',
        };
        const { data: inserted, error: insertError } = await supabaseAdmin
            .from('campeonatos')
            .insert(championshipPayload)
            .select('*')
            .single();
        if (insertError)
            throw insertError;
        const configurationPayload = championshipConfigurationPayload(data, inserted.id);
        let configuration: any;
        try {
            const saved = await saveChampionshipConfiguration(configurationPayload);
            configuration = saved.data;
        }
        catch (configurationError) {
            await supabaseAdmin.from('campeonatos').delete().eq('id', inserted.id);
            throw configurationError;
        }
        // Snapshot de precificação (não bloqueia se tabela ausente)
        try {
            const { quoteChampionshipPrice, saveChampionshipBilling } = await import('@backend/admin/pricing');
            const vagas = Number(data.numero_vagas || configuration?.numero_vagas || 0);
            const quote = await quoteChampionshipPrice({
                tipo: normalizeChampionshipType(data.tipo),
                numero_vagas: vagas,
                recursos: {
                    export: data.recurso_export !== false,
                    stream: data.recurso_stream !== false,
                    rulebook: data.recurso_rulebook !== false,
                    stats: data.recurso_stats !== false,
                    broadcast: data.recurso_broadcast === true,
                },
            });
            await saveChampionshipBilling(inserted.id, quote, {
                status: 'pendente',
                userId: user.id,
                observacao: 'Gerado na criação do campeonato',
            });
        }
        catch {
            // silencioso — precificação opcional até migração
        }
        row = championshipRow({ ...inserted, campeonato_configuracoes: configuration });
    }
    else if (entityType === 'team') {
        const data = body.data || {};
        const { data: inserted, error } = await supabaseAdmin.from('equipes').insert({
            nome: body.name || data.nome,
            tag: data.tag,
            logo_url: data.logo_url || null,
            dono_auth_user_id: user.id,
            status: 'ativo',
        }).select('*').single();
        if (error)
            throw error;
        row = baseRow(inserted, entityType);
    }
    else if (entityType === 'championship_team') {
        const token = await consumeToken(body.token, TEAM_INVITE_TYPES);
        const campeonatoId = body.parent_id || token?.campeonato_id;
        const equipeId = body.ref_id || token?.equipe_id || (account.profile_type === 'equipe' ? account.id : null);
        if (!campeonatoId || !equipeId)
            throw new Error('Campeonato e equipe sao obrigatorios.');
        if (account.profile_type === 'produtora' && !token)
            await requireChampionshipOwner(campeonatoId, user.id, account.id);
        if ((account.profile_type === 'equipe' || account.profile_type === 'manager') && !token)
            await requireManagedTeam(equipeId, user.id);
        const data = body.data || {};
        const slotId = String(data.slot_id || token?.slot_id || '').trim();
        const resolved = await resolveLineForInscricao({
            equipeId,
            campeonatoId,
            lineId: data.line_id || token?.line_destino_id || null,
            nomeLine: data.nome_line || data.nome_exibicao || body.name || null,
        });
        let inserted: any;
        if (slotId) {
            // Caminho enxuto: line + slot
            inserted = await inserirParticipacaoNoSlot({
                campeonatoId,
                slotId,
                lineId: resolved.id,
                equipeId,
                nomeExibicao: resolved.nome,
                origem: token ? 'convite' : account.profile_type === 'produtora' ? 'organizador' : 'inscricao',
                criadoPor: user.id,
            });
        }
        else {
            // Sem slot (legado / inscrição sem assento ainda)
            const payload: Record<string, unknown> = {
                campeonato_id: campeonatoId,
                equipe_id: equipeId,
                line_id: resolved.id,
                nome_exibicao: resolved.nome,
                grupo_id: data.grupo_id || token?.grupo_id || null,
                slot_numero: data.slot_numero || null,
                origem_entrada: token ? 'convite' : account.profile_type === 'produtora' ? 'organizador' : 'inscricao',
                criado_por: user.id,
                status: 'ativo',
            };
            const { data: rowIns, error } = await supabaseAdmin.from('campeonato_equipes').insert(payload).select('*').single();
            if (error)
                throw error;
            inserted = rowIns;
        }
        row = baseRow(inserted, entityType, {
            data: {
                championship_id: inserted.campeonato_id,
                team_id: inserted.equipe_id,
                line_id: inserted.line_id,
                slot_id: inserted.slot_id || slotId || null,
                grupo_id: inserted.grupo_id,
                slot: inserted.slot_numero,
                campeonato_equipe_id: inserted.id,
                nome_exibicao: inserted.nome_exibicao,
            },
        });
    }
    else if (entityType === 'phase') {
        const data = body.data || {};
        await requireChampionshipOwner(body.parent_id || data.campeonato_id, user.id, account.id);
        const phaseName = String(body.name || data.nome || '').trim();
        if (!phaseName)
            throw new Error('Informe o nome da fase.');
        const { data: inserted, error } = await supabaseAdmin.from('campeonato_fases').insert({
            campeonato_id: body.parent_id || data.campeonato_id,
            nome: phaseName,
            ordem: Number(data.ordem || 1),
        }).select('*').single();
        if (error?.code === '23505')
            throw new Error('Ja existe uma fase com esse nome neste campeonato.');
        if (error)
            throw error;
        row = baseRow(inserted, entityType);
    }
    else if (entityType === 'group') {
        const data = body.data || {};
        const campeonatoId = body.parent_id || data.campeonato_id;
        const championship = await requireChampionshipOwner(campeonatoId, user.id, account.id);
        const championshipType = normalizeChampionshipType((championship as any).tipo || data.championship_type);
        const groupName = normalizeGroupName(body.name || data.nome, championshipType);
        let existingQuery = supabaseAdmin
            .from('campeonato_grupos')
            .select('*')
            .eq('campeonato_id', campeonatoId)
            .ilike('nome', groupName)
            .limit(1);
        existingQuery = data.fase_id ? existingQuery.eq('fase_id', data.fase_id) : existingQuery.is('fase_id', null);
        const { data: existingGroup, error: existingGroupError } = await existingQuery.maybeSingle();
        if (existingGroupError)
            throw existingGroupError;
        if (existingGroup) {
            throw new Error(championshipType === 'diario' ? 'Ja existe esse horario nesta fase do campeonato.' : 'Ja existe esse grupo nesta fase do campeonato.');
        }
        else {
            const { data: inserted, error } = await supabaseAdmin.from('campeonato_grupos').insert({
                campeonato_id: campeonatoId,
                fase_id: data.fase_id || null,
                nome: groupName,
                slots: Number(data.slots || 12),
                whatsapp_url: String(data.whatsapp_url || '').trim() || null,
            }).select('*').single();
            if (error) {
                if (error.code === '23505')
                    throw new Error(championshipType === 'diario' ? 'Ja existe esse horario nesta fase do campeonato.' : 'Ja existe esse grupo nesta fase do campeonato.');
                throw error;
            }
            const slotCount = Number(data.slots || 12);
            // Limite de vagas só vale na fase de entrada; fases seguintes = classificados
            await assertPodeCriarSlots(campeonatoId, slotCount, { faseId: data.fase_id || null });
            const letters = Array.from({ length: slotCount }, (_, index) => {
                let value = index + 1;
                let label = '';
                while (value > 0) {
                    value -= 1;
                    label = String.fromCharCode(65 + (value % 26)) + label;
                    value = Math.floor(value / 26);
                }
                return { campeonato_id: campeonatoId, fase_id: data.fase_id || null, grupo_id: inserted.id, slot_numero: index + 1, slot_letra: label, status: 'livre' };
            });
            const { error: slotsError } = await supabaseAdmin.from('campeonato_slots').insert(letters);
            if (slotsError)
                throw slotsError;
            row = baseRow(inserted, entityType, { data: { ...inserted, whatsapp_url: inserted.whatsapp_url } });
        }
    }
    else if (entityType === 'group_slot') {
        const data = body.data || {};
        const campeonatoId = body.parent_id || data.campeonato_id;
        await requireChampionshipOwner(campeonatoId, user.id, account.id);
        if (!data.grupo_id || !data.slot_numero)
            throw new Error('Grupo e slot sao obrigatorios.');
        const { data: groupRef, error: groupRefError } = await supabaseAdmin
            .from('campeonato_grupos')
            .select('fase_id')
            .eq('id', data.grupo_id)
            .eq('campeonato_id', campeonatoId)
            .maybeSingle();
        if (groupRefError)
            throw groupRefError;
        const faseId = data.fase_id || groupRef?.fase_id || null;
        const slotPayload = {
            campeonato_id: campeonatoId,
            fase_id: faseId,
            grupo_id: data.grupo_id,
            equipe_id: data.equipe_id || null,
            line_id: data.line_id || null,
            slot_numero: Number(data.slot_numero),
            status: data.equipe_id ? 'ocupado' : 'livre',
        };
        if (data.equipe_id) {
            const participationPatch: Record<string, unknown> = { grupo_id: data.grupo_id, slot_numero: Number(data.slot_numero) };
            if (data.line_id) {
                const { data: selectedLine, error: lineError } = await supabaseAdmin
                    .from('equipe_lines')
                    .select('id, equipe_id, nome')
                    .eq('id', data.line_id)
                    .eq('equipe_id', data.equipe_id)
                    .single();
                if (lineError || !selectedLine)
                    throw new Error('A line selecionada não pertence à equipe.');
                participationPatch.line_id = selectedLine.id;
                participationPatch.nome_exibicao = selectedLine.nome;
            }
            let participationUpdate = supabaseAdmin
                .from('campeonato_equipes')
                .update(participationPatch)
                .eq('campeonato_id', campeonatoId);
            participationUpdate = data.campeonato_equipe_id
                ? participationUpdate.eq('id', data.campeonato_equipe_id)
                : data.line_id
                    ? participationUpdate.eq('line_id', data.line_id)
                    : participationUpdate.eq('equipe_id', data.equipe_id);
            const { error: updateError } = await participationUpdate;
            if (updateError)
                throw updateError;
        }
        const { data: existing } = data.slot_id
            ? await supabaseAdmin
                .from('campeonato_slots')
                .select('id')
                .eq('id', data.slot_id)
                .eq('campeonato_id', campeonatoId)
                .maybeSingle()
            : await supabaseAdmin
                .from('campeonato_slots')
                .select('id')
                .eq('grupo_id', data.grupo_id)
                .eq('slot_numero', Number(data.slot_numero))
                .maybeSingle();
        const query = existing?.id
            ? supabaseAdmin.from('campeonato_slots').update(slotPayload).eq('id', existing.id)
            : supabaseAdmin.from('campeonato_slots').insert(slotPayload);
        const { data: inserted, error } = await query.select('*').single();
        if (error?.code === '23505')
            throw new Error('Esta line já está em outro grupo desta fase.');
        if (error)
            throw error;
        row = baseRow(inserted, entityType);
    }
    else if (entityType === 'game') {
        const data = body.data || {};
        const campeonatoId = body.parent_id || data.campeonato_id;
        await requireChampionshipOwner(campeonatoId, user.id, account.id);
        const gruposIds = Array.isArray(data.grupos_ids) ? data.grupos_ids : [];
        const { data: inserted, error } = await supabaseAdmin.from('campeonato_jogos').insert({
            campeonato_id: campeonatoId,
            fase_id: data.fase_id || null,
            nome: body.name || data.nome,
            data_jogo: data.data_jogo || null,
            horario: data.horario || null,
            numero_partidas: Number(data.numero_partidas || 1),
            mapas: String(data.mapas || '').split(',').map((x) => x.trim()).filter(Boolean),
            grupos_ids: gruposIds,
        }).select('*').single();
        if (error)
            throw error;
        if (gruposIds.length > 0) {
            const rows = gruposIds.map((grupoId: string) => ({ campeonato_id: campeonatoId, jogo_id: inserted.id, grupo_id: grupoId }));
            const { error: gruposError } = await supabaseAdmin.from('campeonato_jogos_grupos').insert(rows);
            if (gruposError)
                throw gruposError;
        }
        row = baseRow(inserted, entityType);
    }
    else if (entityType === 'invite_token') {
        const data = body.data || {};
        const tipo = normalizeTokenKind(data.token_kind || body.tipo);
        if (isTeamInviteKind(tipo))
            await requireChampionshipOwner(body.parent_id || data.championship_id, user.id, account.id);
        if (tipo === 'manager_invite')
            await requireChampionshipOwner(body.parent_id || data.championship_id, user.id, account.id);
        if (isPlayerInviteKind(tipo)) {
            await requireManagedTeam(body.ref_id || data.team_id, user.id);
            await requireTeamInChampionship(body.parent_id || data.championship_id, body.ref_id || data.team_id);
            await assertInviteAllowed(body.parent_id || data.championship_id, body.ref_id || data.team_id);
        }
        const prefix = String(body.token_prefix || (tipo === 'manager_invite' ? 'MG' : isPlayerInviteKind(tipo) ? 'JG' : 'EQ'));
        const { data: inserted, error } = await supabaseAdmin.from('tokens').insert({
            token: body.generate_token ? randomToken(prefix) : body.token,
            tipo,
            campeonato_id: body.parent_id || data.championship_id || null,
            fase_id: data.phase_id || data.fase_id || null,
            grupo_id: data.group_id || data.grupo_id || null,
            equipe_id: body.ref_id || data.team_id || null,
            jogador_id: data.player_id || null,
            manager_id: data.manager_id || null,
            jogo_id: data.game_id || null,
            criado_por: user.id,
            expira_em: data.expira_em || null,
        }).select('*').single();
        if (error)
            throw error;
        row = baseRow(inserted, entityType);
    }
    else if (entityType === 'lineup_rule') {
        const data = body.data || {};
        const campeonatoId = body.parent_id || data.championship_id || data.campeonato_id;
        await requireChampionshipOwner(campeonatoId, user.id, account.id);
        const inserted = await saveLineupRule(data, campeonatoId);
        row = baseRow(inserted, entityType);
    }
    else if (entityType === 'registration_link') {
        const data = body.data || {};
        const campeonatoId = body.parent_id || data.championship_id || data.campeonato_id;
        const grupoId = data.group_id || data.grupo_id;
        await requireChampionshipOwner(campeonatoId, user.id, account.id);
        if (!grupoId)
            throw new Error('Grupo obrigatorio para gerar link de inscricao.');
        // Só existe link de entrada de equipes por grupo (inscrição individual removida)
        const tipoLink = 'inscricao_equipes_grupo';
        const { data: group, error: groupError } = await supabaseAdmin
            .from('campeonato_grupos')
            .select('slots,nome')
            .eq('id', grupoId)
            .eq('campeonato_id', campeonatoId)
            .single();
        if (groupError)
            throw groupError;
        const slotsGrupo = Math.max(1, Number(group.slots || 1));
        const limiteRaw = Number(data.limite_vagas ?? data.vagas_link ?? data.quantidade_vagas);
        if (!Number.isFinite(limiteRaw) || !Number.isInteger(limiteRaw) || limiteRaw < 1) {
            throw new Error(`Informe quantas vagas este link aceita (1 a ${slotsGrupo}).`);
        }
        if (limiteRaw > slotsGrupo) {
            throw new Error(`O limite maximo deste grupo e ${slotsGrupo} vaga(s).`);
        }
        const limiteVagas = limiteRaw;
        // Lista de controle opcional (não bloqueia inscrição; admin cola texto livre)
        const expectedTeams = parseExpectedTeamsFromText(data.expected_teams
            ?? data.equipes_esperadas_texto
            ?? data.nomes_equipes_texto
            ?? data.nomes_equipes
            ?? '');
        // Conta slots livres reais no grupo — o link não pode vender mais do que cabe
        const { count: livresCount, error: livresError } = await supabaseAdmin
            .from('campeonato_slots')
            .select('id', { count: 'exact', head: true })
            .eq('campeonato_id', campeonatoId)
            .eq('grupo_id', grupoId)
            .is('line_id', null)
            .is('equipe_id', null);
        if (livresError)
            throw livresError;
        const livres = Number(livresCount || 0);
        if (livres < 1)
            throw new Error('Este grupo nao tem slots livres para gerar link.');
        if (limiteVagas > livres) {
            throw new Error(`So restam ${livres} slot(s) livre(s) neste grupo. Reduza o limite do link.`);
        }
        const expiraEm = parseOptionalDateTime(data.expira_em || data.encerra_em, {
            fieldLabel: 'Data de encerramento do link',
            requireFuture: true,
        });
        const meta = {
            limite_vagas: limiteVagas,
            usos: 0,
            expected_teams: expectedTeams,
            entradas: [] as Array<{
                participacao_id: string;
                equipe_id: string | null;
                equipe_nome: string | null;
                line_id: string | null;
                line_nome: string | null;
                slot_id: string | null;
                slot_letra: string | null;
                slot_numero: number | null;
                referencia_lista?: string | null;
                entrou_em: string;
            }>,
        };
        const titulo = String(body.name || data.titulo || data.nome_interno || '').trim()
            || (limiteVagas === 1
                ? `Entrada de 1 equipe · ${group.nome || 'grupo'}`
                : `Entrada de ${limiteVagas} equipes · ${group.nome || 'grupo'}`);
        const linkPayload: Record<string, unknown> = {
            campeonato_id: campeonatoId,
            fase_id: data.fase_id || null,
            grupo_id: grupoId,
            token: body.generate_token ? randomToken('EQS') : body.token,
            tipo: tipoLink,
            titulo,
            descricao: encodeLinkDescricao(meta, data.descricao),
            ativo: data.ativo !== false,
            acompanhamento_publico: data.acompanhamento_publico !== false,
            criado_por: user.id,
            expira_em: expiraEm,
        };
        let { data: inserted, error } = await supabaseAdmin.from('campeonato_links').insert({
            ...linkPayload,
            metadata: meta,
        }).select('*').single();
        if (error && isMissingMetadataColumn(error)) {
            const retry = await supabaseAdmin.from('campeonato_links').insert(linkPayload).select('*').single();
            inserted = retry.data;
            error = retry.error;
        }
        if (error)
            throw error;
        const origin = context.origin || process.env.NEXT_PUBLIC_APP_URL || '';
        const publicUrl = `${String(origin).replace(/\/$/, '')}/convite/grupo/${inserted.token}`;
        const { data: campRow } = await supabaseAdmin
            .from('campeonatos')
            .select('nome')
            .eq('id', campeonatoId)
            .maybeSingle();
        const shareTexto = buildGroupInviteShareMessage({
            campeonatoNome: campRow?.nome || body.name || 'Campeonato',
            grupoNome: group.nome || 'Grupo',
            limiteVagas,
            expectedTeams,
            publicUrl,
            expiraEm,
            titulo,
        });
        row = baseRow(inserted, entityType, {
            data: {
                ...registrationLinkData(inserted),
                share_texto: shareTexto,
                public_url_full: publicUrl,
            },
        });
    }
    else if (entityType === 'player_registration') {
        const token = await consumeToken(body.data?.token || body.token, PLAYER_INVITE_TYPES);
        const data = body.data || {};
        const campeonatoId = body.parent_id || token?.campeonato_id;
        const equipeId = body.ref_id || token?.equipe_id;
        const champTeam = await requireTeamInChampionship(campeonatoId, equipeId);
        const rule = await getLineupRule(campeonatoId, champTeam.grupo_id);
        assertLineupOpen(rule);
        await assertPlayerCapacity(campeonatoId, equipeId, Number(rule?.vagas_por_equipe || 6));
        const { data: jogador, error: jogadorError } = await supabaseAdmin.from('jogadores').select('*').eq('auth_user_id', user.id).maybeSingle();
        if (jogadorError)
            throw jogadorError;
        if (!jogador)
            throw new Error('Entre com uma conta de jogador.');
        const idJogo = String(data.id_jogo || jogador.id_jogo || '').trim();
        await assertPlayerUniqueInChampionship(campeonatoId, champTeam.id, idJogo);
        await saveTeamPlayer({
            equipe_id: equipeId,
            jogador_auth_user_id: user.id,
            nick: body.name || data.nick || jogador.nome,
            foto_url: data.foto_url || jogador.avatar_url || null,
            id_jogo: idJogo,
            funcao: data.funcao || jogador.funcao || null,
            localidade: data.localidade || jogador.localidade || null,
            origem: 'token',
            status: 'ativo',
        });
        const { data: inserted, error } = await supabaseAdmin.from('campeonato_jogadores').insert({
            campeonato_id: campeonatoId,
            equipe_id: equipeId,
            jogo_id: token?.jogo_id || data.game_id || null,
            jogador_id: jogador.id,
            nick: body.name || data.nick || jogador.nome,
            foto_url: data.foto_url || jogador.avatar_url || null,
            id_jogo: idJogo,
            funcao: data.funcao || jogador.funcao || 'support',
            localidade: data.localidade || jogador.localidade || null,
            campeonato_equipe_id: champTeam.id,
            line_id: token?.line_destino_id || data.line_id || champTeam.line_id || null,
            origem: 'token',
            status: 'ativo',
        }).select('*').single();
        if (error)
            throw error;
        row = baseRow(inserted, entityType);
    }
    else if (entityType === 'player_team') {
        const data = body.data || {};
        await requireManagedTeam(body.ref_id || data.team_id, user.id);
        if (!data.player_id)
            throw new Error('Selecione um jogador existente para adicionar ao elenco.');
        const { data: inserted, error } = await supabaseAdmin.from('equipe_jogadores').insert({
            equipe_id: body.ref_id || data.team_id,
            jogador_auth_user_id: data.player_user_id || data.jogador_auth_user_id,
            nick: data.nick || null,
            foto_url: data.foto_url || null,
            id_jogo: data.id_jogo || null,
            funcao: data.funcao || null,
            localidade: data.localidade || null,
            origem: 'manual',
            status: 'ativo',
        }).select('*').single();
        if (error)
            throw error;
        row = baseRow(inserted, entityType);
    }
    else {
        throw new Error('Tipo de cadastro invalido.');
    }
    if (entityType === 'championship') {
        context.invalidateTag('directory:campeonatos');
    }
    return { row };
}
