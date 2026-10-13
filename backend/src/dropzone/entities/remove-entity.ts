import { supabaseAdmin } from "@backend/shared/supabase-admin";
import { buildLinkMetaPayload, encodeLinkDescricao, extractHumanDescricao, isMissingDeletedAtColumn, isMissingMetadataColumn, parseLinkMetadata } from "@backend/shared/campeonato-link-metadata";
import { requireChampionshipOwner, freeSlotParticipation } from '@backend/dropzone/entities/permissions'
import type { EntityContext } from './context'

export async function removeEntity(context: EntityContext, body: Record<string, any>) {
    const { user, account } = context
    if (account.profile_type !== 'produtora')
        throw new Error('Somente a produtora pode excluir esta estrutura.');
    const entityType = String(body.entity_type || '');
    const id = String(body.id || '');
    if (entityType === 'championship') {
        await requireChampionshipOwner(id, user.id, account.id, 'administrar');
        const { error } = await supabaseAdmin.from('campeonatos').update({ deleted_at: new Date().toISOString(), status: 'excluido' }).eq('id', id);
        if (error)
            throw error;
        context.invalidateTag('directory:campeonatos');
        context.invalidatePath(`/campeonatos/${id}`);
    }
    else if (entityType === 'phase') {
        const { data, error: readError } = await supabaseAdmin.from('campeonato_fases').select('campeonato_id').eq('id', id).single();
        if (readError)
            throw readError;
        await requireChampionshipOwner(data.campeonato_id, user.id, account.id);
        const { error } = await supabaseAdmin.from('campeonato_fases').delete().eq('id', id);
        if (error)
            throw error;
    }
    else if (entityType === 'group') {
        const { data, error: readError } = await supabaseAdmin.from('campeonato_grupos').select('campeonato_id').eq('id', id).single();
        if (readError)
            throw readError;
        await requireChampionshipOwner(data.campeonato_id, user.id, account.id);
        const { error } = await supabaseAdmin.from('campeonato_grupos').delete().eq('id', id);
        if (error)
            throw error;
    }
    else if (entityType === 'group_slot') {
        const { data, error: readError } = await supabaseAdmin.from('campeonato_slots').select('*').eq('id', id).single();
        if (readError)
            throw readError;
        await requireChampionshipOwner(data.campeonato_id, user.id, account.id);
        await freeSlotParticipation(data);
    }
    else if (entityType === 'registration_link') {
        const { data: current, error: readError } = await supabaseAdmin
            .from('campeonato_links')
            .select('*')
            .eq('id', id)
            .single();
        if (readError)
            throw readError;
        await requireChampionshipOwner(current.campeonato_id, user.id, account.id);
        // Soft-delete: mantém o token para acompanhamento público
        const meta = parseLinkMetadata(current);
        const closedAt = new Date().toISOString();
        const payload = buildLinkMetaPayload(meta, {
            closed_reason: 'excluido',
            closed_at: closedAt,
        });
        const patch: Record<string, unknown> = {
            ativo: false,
            descricao: encodeLinkDescricao(payload, extractHumanDescricao(current.descricao)),
            metadata: payload,
            updated_at: closedAt,
            deleted_at: closedAt,
        };
        let { error } = await supabaseAdmin.from('campeonato_links').update(patch).eq('id', id);
        if (error && isMissingDeletedAtColumn(error)) {
            const { deleted_at: _d, ...withoutDeleted } = patch;
            const retry = await supabaseAdmin.from('campeonato_links').update(withoutDeleted).eq('id', id);
            error = retry.error;
        }
        if (error && isMissingMetadataColumn(error)) {
            const { metadata: _m, deleted_at: _d2, ...withoutMeta } = patch;
            const retry = await supabaseAdmin.from('campeonato_links').update(withoutMeta).eq('id', id);
            error = retry.error;
        }
        if (error)
            throw error;
    }
    else
        throw new Error('Tipo de exclusao nao suportado.');
    return { success: true };
}
