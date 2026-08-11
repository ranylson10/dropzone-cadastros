-- =============================================================================
-- DROPZONE · Broadcast passa a operar tipos oficiais do pacote de overlays.
-- Substitui o antigo active_overlay_id (FK de overlays livres) por
-- active_overlay_type, ligado ao enabled_overlay_types do campeonato_stream_pack.
-- =============================================================================

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'broadcast_live_sessions'
      and column_name = 'active_overlay_id'
  ) then
    alter table public.broadcast_live_sessions
      drop constraint if exists broadcast_live_sessions_active_overlay_id_fkey;

    update public.broadcast_live_sessions
    set active_overlay_id = null;

    alter table public.broadcast_live_sessions
      alter column active_overlay_id type text using null::text;

    alter table public.broadcast_live_sessions
      rename column active_overlay_id to active_overlay_type;
  end if;
end $$;

alter table public.broadcast_live_sessions
  add column if not exists active_overlay_type text null;

alter table public.broadcast_live_sessions
  drop constraint if exists broadcast_live_sessions_active_overlay_type_check;

alter table public.broadcast_live_sessions
  add constraint broadcast_live_sessions_active_overlay_type_check
  check (
    active_overlay_type is null
    or active_overlay_type in (
      'standings_general',
      'round_teams',
      'round_players',
      'mvp_general',
      'mvp_day',
      'mvp_round',
      'booyahs_day',
      'qualified_teams',
      'next_round',
      'champion'
    )
  );

comment on table public.broadcast_live_sessions is
  'Mesa do Stream: 1 por broadcast. controller_token + obs_token fixos; campeonato_id = live selecionada; active_overlay_type = cena oficial do pacote no ar.';

comment on column public.broadcast_live_sessions.active_overlay_type is
  'Tipo oficial da overlay atualmente no ar. Deve existir em campeonato_stream_pack.enabled_overlay_types.';
