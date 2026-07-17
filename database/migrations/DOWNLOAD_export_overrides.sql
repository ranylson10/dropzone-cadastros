-- =============================================================================
-- DROPZONE · Backup da aba Download/SPEC por campeonato
-- Rode este SQL no Supabase (SQL Editor) UMA vez.
-- =============================================================================
-- O que cria:
--   public.campeonato_export_overrides
--
-- Campos principais:
--   logo_bg_url      → URL/data do fundo das logos
--   photo_bg_url     → URL/data do fundo das fotos
--   logo_margin      → margens { top, right, bottom, left }
--   photo_margin     → margens { top, right, bottom, left }
--   equipes          → nome/tag editados só neste campeonato
--   jogadores        → nick, id_jogo, função, localidade editados
--   logos            → só logos que o ADM salvou (source + cor + slot)
--   fotos            → só fotos que o ADM salvou
--   nation_source    → 'funcao' | 'localidade' no PlayerNameOverwrite
--   role_color / team_color / text_colors → cores do SPEC
--
-- NÃO altera perfil global de equipe/jogador — só override do campeonato.
-- =============================================================================

create table if not exists public.campeonato_export_overrides (
  campeonato_id uuid primary key references public.campeonatos(id) on delete cascade,

  -- Fundos gerais (mesmo fundo para todas as logos / todas as fotos)
  logo_bg_url text,
  photo_bg_url text,

  -- Margens gerais
  logo_margin jsonb not null default '{"top":24,"right":24,"bottom":24,"left":24}'::jsonb,
  photo_margin jsonb not null default '{"top":30,"right":30,"bottom":30,"left":30}'::jsonb,

  -- Edições de texto (por id)
  -- equipes:  { "<equipe_id>": { "nome": "...", "tag": "..." } }
  equipes jsonb not null default '{}'::jsonb,

  -- jogadores: { "<key>": { "nick", "id_jogo", "funcao", "localidade", "tag_equipe", "equipe_id" } }
  jogadores jsonb not null default '{}'::jsonb,

  -- Logos salvas pelo ADM (só as que ficaram na lista ao clicar Backup)
  -- { "<key>": { "source_url", "tint_color", "codigo", "slot_letra", "equipe_nome", "line_nome", "equipe_id" } }
  logos jsonb not null default '{}'::jsonb,

  -- Fotos salvas pelo ADM
  -- { "<id_jogo>": { "source_url", "nick", "equipe_nome", "key" } }
  fotos jsonb not null default '{}'::jsonb,

  -- Opções do PlayerNameOverwrite.json
  nation_source text not null default 'funcao'
    check (nation_source in ('funcao', 'localidade')),
  role_color text not null default '#000000',
  team_color text not null default '#000000',
  text_colors jsonb,

  updated_at timestamptz not null default now(),
  updated_by uuid
);

comment on table public.campeonato_export_overrides is
  'Backup Download/SPEC por campeonato: fundos, margens, edições de equipe/jogador, logos e fotos. Não altera perfil global.';

comment on column public.campeonato_export_overrides.logo_bg_url is
  'Fundo único aplicado em todas as logos do SPEC deste campeonato';
comment on column public.campeonato_export_overrides.photo_bg_url is
  'Fundo único aplicado em todas as fotos do SPEC deste campeonato';
comment on column public.campeonato_export_overrides.logos is
  'Somente logos que o ADM salvou no backup (lista reduzida).';
comment on column public.campeonato_export_overrides.fotos is
  'Somente fotos que o ADM salvou no backup (lista reduzida).';

create index if not exists campeonato_export_overrides_updated_at_idx
  on public.campeonato_export_overrides (updated_at desc);

-- API usa service role (supabaseAdmin). Se usar RLS no futuro, libere service_role.
alter table public.campeonato_export_overrides enable row level security;

drop policy if exists campeonato_export_overrides_service_all on public.campeonato_export_overrides;
-- service_role ignora RLS por padrão no Supabase; policy abaixo é defensiva para authenticated se necessário
drop policy if exists campeonato_export_overrides_select_auth on public.campeonato_export_overrides;
create policy campeonato_export_overrides_select_auth
  on public.campeonato_export_overrides
  for select
  to authenticated
  using (true);

drop policy if exists campeonato_export_overrides_write_auth on public.campeonato_export_overrides;
create policy campeonato_export_overrides_write_auth
  on public.campeonato_export_overrides
  for all
  to authenticated
  using (true)
  with check (true);

-- Confirmação
select
  column_name,
  data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'campeonato_export_overrides'
order by ordinal_position;
