import { readPagedRows } from "@backend/shared/paginated-query";
import { supabaseAdmin } from "@backend/shared/supabase-admin";
import { isMissingDeletedAtColumn, parseLinkMetadata, registrationLinkData } from "@backend/shared/campeonato-link-metadata";
import { baseRow, PUBLIC_TYPES, selectRows, championshipRow } from '@backend/dropzone/entities/records'
import { entityTeamReadScope, entityChampionshipReadScope } from './read-scope'
import type { EntityContext } from './context'
import { producerWorkspaceSummary } from './producer-summary'

export async function listEntities(context: EntityContext, searchParams: URLSearchParams) {
    const { user, account } = context
    const entityType = searchParams.get('entity_type');
    const selectedTypes = searchParams.has('entity_types')
        ? (searchParams.get('entity_types') || '').split(',').map(type => type.trim()).filter(Boolean)
        : null;
    const typesToLoad = [...new Set(entityType ? [entityType] : selectedTypes || PUBLIC_TYPES)];
    if (typesToLoad.some(type => !PUBLIC_TYPES.includes(type))) throw new Error('Tipo de entidade inválido.');
    const championshipFilter = searchParams.get('championship_id') || searchParams.get('campeonato_id') || '';
    const wantsSummary = searchParams.get('summary') === '1';
    if (wantsSummary && account.profile_type !== 'produtora') throw new Error('Resumo disponível somente no workspace da produtora.');
    let producerChampionshipIds: string[] = [];
    if (account.profile_type === 'produtora') {
        const ownedChampionships = await readPagedRows<{
            id: string;
        }>(supabaseAdmin
            .from('campeonatos')
            .select('id')
            .eq('produtora_id', account.id)
            .is('deleted_at', null)
            .order('id', { ascending: true }));
        producerChampionshipIds = (ownedChampionships || []).map((row: any) => String(row.id));
    }
    let teamScopePromise: ReturnType<typeof entityTeamReadScope> | undefined;
    const teamScope = () => teamScopePromise ||= entityTeamReadScope(context);
    let championshipScopePromise: ReturnType<typeof entityChampionshipReadScope> | undefined;
    const championshipScope = () => championshipScopePromise ||= teamScope().then(scope => entityChampionshipReadScope(context, scope));
    const uniqueRows = (batches: any[][]) => [...new Map(batches.flat().map(row => [row.id, row])).values()];
    async function loadType(type: string): Promise<any[]> {
        if (type === 'championship') {
            let championshipQuery = supabaseAdmin
                .from('campeonatos')
                .select('*, campeonato_configuracoes(*)')
                .is('deleted_at', null)
                .order('created_at', { ascending: false })
                .order('id', { ascending: true });
            if (account.profile_type === 'produtora')
                championshipQuery = championshipQuery.eq('produtora_id', account.id);
            else {
                const ids = await championshipScope();
                if (!ids.length) return [];
                championshipQuery = championshipQuery.in('id', ids);
            }
            if (championshipFilter)
                championshipQuery = championshipQuery.eq('id', championshipFilter);
            const data = await readPagedRows<any>(championshipQuery);
            return (data || []).map(championshipRow);
        }
        const privateCreatorType = type === 'invite_token' || type === 'registration_link';
        const independentType = ['team', 'team_line', 'player_team', 'player_registration'].includes(type);
        const campIdsForScoped = account.profile_type === 'produtora'
            ? producerChampionshipIds.filter(id => !championshipFilter || id === championshipFilter)
            : privateCreatorType || independentType
                ? championshipFilter ? [championshipFilter] : null
                : (await championshipScope()).filter(id => !championshipFilter || id === championshipFilter);
        const scoped = campIdsForScoped && campIdsForScoped.length
            ? [{ column: 'campeonato_id', op: 'in' as const, value: campIdsForScoped }]
            : campIdsForScoped && campIdsForScoped.length === 0
                ? null
                : [];
        if (type === 'team') {
            const scope = await teamScope();
            return selectRows('equipes', type, (row) => {
                const control = scope.controlled.find(team => team.id === row.id);
                const mapped = baseRow(row, type, { data: { tag: row.tag, logo_url: row.logo_url, profile_team: true, managed_by_current_user: Boolean(control), permissions: control?.permissoes } });
                delete mapped.data.dono_auth_user_id;
                mapped.created_by = row.dono_auth_user_id === user.id ? user.id : null;
                return mapped;
            }, { columns: 'id,nome,tag,logo_url,status,dono_auth_user_id,created_at,updated_at' });
        }
        if (type === 'team_line') {
            const scope = await teamScope();
            return selectRows('equipe_lines', type, (row) => baseRow(row, type, { data: { team_id: row.equipe_id, equipe_id: row.equipe_id, tag: row.tag, logo_url: row.logo_url } }), {
                columns: 'id,equipe_id,nome,tag,logo_url,status,created_at,updated_at',
                filters: [{ column: 'equipe_id', op: 'in', value: scope.lineIds }],
            });
        }
        // Roster records are private and are scoped before pagination.
        if (type === 'player_team') {
            const mapPlayer = (row: any) => baseRow(row, type, { data: { player_user_id: row.jogador_auth_user_id, team_id: row.equipe_id, origem: row.origem, nick: row.nick, id_jogo: row.id_jogo, funcao: row.funcao, foto_url: row.foto_url } });
            if (account.profile_type === 'jogador') {
                return uniqueRows(await Promise.all([
                    selectRows('equipe_jogadores', type, mapPlayer, { filters: [{ column: 'jogador_id', op: 'eq', value: account.id }] }),
                    selectRows('equipe_jogadores', type, mapPlayer, { filters: [{ column: 'jogador_auth_user_id', op: 'eq', value: user.id }] }),
                ]));
            }
            const scope = await teamScope();
            return selectRows('equipe_jogadores', type, mapPlayer, { filters: [{ column: 'equipe_id', op: 'in', value: scope.managedIds }] });
        }
        // An empty producer scope must not suppress independent team records.
        if (scoped === null) return [];
        if (type === 'championship_team') {
            return selectRows('campeonato_equipes', type, (row) => baseRow(row, type, {
                data: {
                    championship_id: row.campeonato_id,
                    team_id: row.equipe_id,
                    line_id: row.line_id,
                    slot_id: row.slot_id || null,
                    nome_exibicao: row.nome_exibicao,
                    grupo_id: row.grupo_id,
                    slot: row.slot_numero,
                    campeonato_equipe_id: row.id,
                },
            }), {
                columns: 'id,campeonato_id,equipe_id,line_id,slot_id,grupo_id,slot_numero,nome_exibicao,status,origem_entrada,criado_por,created_at,updated_at',
                filters: [...scoped, { column: 'status', op: 'eq', value: 'ativo' }, ...(account.profile_type === 'produtora' ? [] : [{ column: 'equipe_id', op: 'in' as const, value: (await teamScope()).lineIds }])],
            });
        }
        if (type === 'player_registration') {
            const mapRegistration = (row: any) => baseRow(row, type, {
                data: {
                    nick: row.nick,
                    id_jogo: row.id_jogo,
                    funcao: row.funcao,
                    localidade: row.localidade,
                    championship_id: row.campeonato_id,
                    team_id: row.equipe_id,
                    game_id: row.jogo_id,
                    foto_url: row.foto_url,
                    jogador_id: row.jogador_id,
                },
            });
            if (account.profile_type === 'produtora') return selectRows('campeonato_jogadores', type, mapRegistration, { filters: scoped });
            if (account.profile_type === 'jogador') return uniqueRows(await Promise.all([
                selectRows('campeonato_jogadores', type, mapRegistration, { filters: [...scoped, { column: 'jogador_id', op: 'eq', value: account.id }] }),
                selectRows('campeonato_jogadores', type, mapRegistration, { filters: [...scoped, { column: 'criado_por', op: 'eq', value: user.id }] }),
            ]));
            const scope = await teamScope();
            return selectRows('campeonato_jogadores', type, mapRegistration, { filters: [...scoped, { column: 'equipe_id', op: 'in', value: scope.managedIds }] });
        }
        if (type === 'phase') {
            return selectRows('campeonato_fases', type, (row) => baseRow(row, type, { data: { championship_id: row.campeonato_id, ordem: row.ordem } }), { filters: scoped });
        }
        if (type === 'group') {
            return selectRows('campeonato_grupos', type, (row) => baseRow(row, type, {
                data: { championship_id: row.campeonato_id, fase_id: row.fase_id, slots: row.slots, whatsapp_url: row.whatsapp_url },
            }), { filters: scoped });
        }
        if (type === 'group_slot') {
            return selectRows('campeonato_slots', type, (row) => baseRow(row, type, {
                data: {
                    championship_id: row.campeonato_id,
                    fase_id: row.fase_id,
                    group_id: row.grupo_id,
                    grupo_id: row.grupo_id,
                    team_id: row.equipe_id,
                    equipe_id: row.equipe_id,
                    line_id: row.line_id,
                    slot_numero: row.slot_numero,
                    slot_letra: row.slot_letra,
                    status: row.status,
                },
            }), {
                columns: 'id,campeonato_id,fase_id,grupo_id,equipe_id,line_id,slot_numero,slot_letra,status,created_at,updated_at',
                filters: scoped,
            });
        }
        if (type === 'game') {
            return selectRows('campeonato_jogos', type, (row) => baseRow(row, type, {
                data: {
                    championship_id: row.campeonato_id,
                    fase_id: row.fase_id,
                    data_jogo: row.data_jogo,
                    horario: row.horario,
                    numero_partidas: row.numero_partidas,
                    mapas: row.mapas,
                    grupos_ids: row.grupos_ids,
                },
            }), { filters: scoped });
        }
        if (type === 'invite_token') {
            return selectRows('tokens', type, (row) => baseRow(row, type, {
                data: {
                    token_kind: row.tipo,
                    championship_id: row.campeonato_id,
                    phase_id: row.fase_id,
                    group_id: row.grupo_id,
                    slot_id: row.slot_id || null,
                    team_id: row.equipe_id,
                    player_id: row.jogador_id,
                    manager_id: row.manager_id,
                    game_id: row.jogo_id,
                    usado: row.usado,
                    expira_em: row.expira_em,
                },
            }), { filters: account.profile_type === 'produtora' ? scoped : [...scoped, { column: 'criado_por', op: 'eq', value: user.id }] });
        }
        if (type === 'registration_link') {
            const mapLink = (row: any) => baseRow(row, type, {
                name: row.titulo || row.token || null,
                data: registrationLinkData(row),
                status: row.deleted_at ? 'excluido' : row.ativo === false ? 'pausado' : 'ativo',
            });
            const linkFilters = account.profile_type === 'produtora' ? scoped : [...scoped, { column: 'criado_por', op: 'eq' as const, value: user.id }];
            // selectRows engole erro de coluna ausente → [] ; por isso tentamos explicitamente
            let query = supabaseAdmin
                .from('campeonato_links')
                .select('*')
                .order('created_at', { ascending: false })
                .order('id', { ascending: true });
            if (scoped.length) {
                const campFilter = scoped[0];
                if (!Array.isArray(campFilter.value) || !campFilter.value.length)
                    return [];
                query = query.in(campFilter.column, campFilter.value);
            }
            if (account.profile_type !== 'produtora') query = query.eq('criado_por', user.id);
            query = query.is('deleted_at', null);
            let data: any[] | null = null;
            let error: any = null;
            try {
                data = await readPagedRows<any>(query);
            }
            catch (cause) {
                error = cause;
            }
            if (error && isMissingDeletedAtColumn(error)) {
                const retry = await selectRows('campeonato_links', type, mapLink, { filters: linkFilters });
                return (retry || []).filter((row: any) => String(row.data?.closed_reason || '') !== 'excluido');
            }
            if (error) {
                if (['42P01', 'PGRST205'].includes(error.code || ''))
                    return [];
                throw error;
            }
            return (data || [])
                .filter((row: any) => parseLinkMetadata(row).closed_reason !== 'excluido')
                .map(mapLink);
        }
        if (type === 'lineup_rule') {
            // Administrative rules have no creator column; only the producer workspace reads them here.
            if (account.profile_type !== 'produtora') return [];
            return selectRows('campeonato_regras', type, (row) => baseRow(row, type, {
                data: {
                    championship_id: row.campeonato_id,
                    fase_id: row.fase_id,
                    group_id: row.grupo_id,
                    vagas_por_equipe: row.vagas_por_equipe,
                    abre_em: row.abre_em,
                    encerra_em: row.encerra_em,
                    permite_substituicao: row.permite_substituicao,
                    max_substituicoes_por_equipe: row.max_substituicoes_por_equipe,
                    substituicao_encerra_em: row.substituicao_encerra_em,
                    bloquear_convites_apos_encerramento: row.bloquear_convites_apos_encerramento,
                },
            }), { filters: scoped });
        }
        return [];
    }
    // Paralelo: antes carregava 12 tipos em série
    const batches = await Promise.all(typesToLoad.map((type) => loadType(type)));
    const output = batches.flat();
    const championshipScopedTypes = new Set([
        'championship_team',
        'player_registration',
        'phase',
        'group',
        'group_slot',
        'game',
        'invite_token',
        'registration_link',
        'lineup_rule',
    ]);
    const visible = output.filter((row) => {
        if (account.profile_type === 'produtora') {
            if (row.entity_type === 'championship')
                return producerChampionshipIds.includes(row.id);
            if (championshipScopedTypes.has(row.entity_type)) {
                const championshipId = String(row.parent_id || row.data?.championship_id || '');
                return producerChampionshipIds.includes(championshipId);
            }
        }
        if (row.entity_type === 'invite_token' || row.entity_type === 'registration_link' || row.entity_type === 'lineup_rule') {
            return row.created_by === user.id;
        }
        return true;
    });
    visible.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    if (wantsSummary) return { rows: visible, summary: await producerWorkspaceSummary(producerChampionshipIds, championshipFilter) };
    return { rows: visible };
}
