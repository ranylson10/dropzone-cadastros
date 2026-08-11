-- Rodada 88E — remoção definitiva da arquitetura antiga de overlays livres.
-- O runtime oficial passa a usar somente campeonato_stream_pack + active_overlay_type.

-- A seleção de cenas agora é enabled_overlay_types no pacote.
alter table if exists public.campeonato_stream_pack
  drop column if exists selected_overlay_ids;

-- Catálogo/códigos pertenciam ao editor livre baseado em blocks e não têm consumidor no pacote oficial.
drop function if exists public.fn_resgatar_stream_overlay_code(text, uuid);
drop table if exists public.stream_overlay_entitlements cascade;
drop table if exists public.stream_overlay_purchase_codes cascade;
drop table if exists public.stream_overlay_catalog cascade;

-- Instâncias antigas (blocks/share_token) deixam de existir após a troca do runtime OBS.
drop table if exists public.campeonato_stream_overlays cascade;
