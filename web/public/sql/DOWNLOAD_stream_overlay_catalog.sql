-- =============================================================================
-- DROPZONE · Catálogo de modelos de overlay Stream
-- Rode no Supabase SQL Editor (uma vez). Idempotente.
-- =============================================================================

-- Biblioteca de modelos (por usuário)
create table if not exists public.stream_overlay_catalog (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null,
  nome text not null default 'Modelo',
  descricao text not null default '',
  -- snapshot do design (mesmo envelope v3 de blocks: frameW/frameH/items)
  blocks jsonb not null default '{"v":3,"frameW":1920,"frameH":1080,"items":[]}'::jsonb,
  -- private | public | for_sale
  visibility text not null default 'private'
    check (visibility in ('private', 'public', 'for_sale')),
  -- se o modelo veio de compra: não pode republicar nem gerar códigos de venda
  is_purchased_copy boolean not null default false,
  source_catalog_id uuid null references public.stream_overlay_catalog(id) on delete set null,
  price_label text null,
  preview_note text null,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_stream_catalog_owner
  on public.stream_overlay_catalog (owner_user_id, updated_at desc);

create index if not exists idx_stream_catalog_public
  on public.stream_overlay_catalog (visibility, updated_at desc)
  where ativo = true and visibility = 'public';

-- Códigos de compra gerados pelo dono do modelo
create table if not exists public.stream_overlay_purchase_codes (
  id uuid primary key default gen_random_uuid(),
  catalog_id uuid not null references public.stream_overlay_catalog(id) on delete cascade,
  owner_user_id uuid not null,
  code text not null,
  max_redemptions int not null default 1,
  redemption_count int not null default 0,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  constraint stream_overlay_purchase_codes_code_unique unique (code)
);

create index if not exists idx_stream_purchase_codes_catalog
  on public.stream_overlay_purchase_codes (catalog_id, created_at desc);

-- Quem tem direito de usar um modelo (dono, compra, clone público)
create table if not exists public.stream_overlay_entitlements (
  id uuid primary key default gen_random_uuid(),
  catalog_id uuid not null references public.stream_overlay_catalog(id) on delete cascade,
  user_id uuid not null,
  -- own | purchase | public_clone
  source text not null default 'own'
    check (source in ('own', 'purchase', 'public_clone')),
  purchase_code_id uuid null references public.stream_overlay_purchase_codes(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint stream_overlay_entitlements_unique unique (catalog_id, user_id)
);

create index if not exists idx_stream_entitlements_user
  on public.stream_overlay_entitlements (user_id, created_at desc);

-- Metadados de licença nas overlays do campeonato
alter table public.campeonato_stream_overlays
  add column if not exists catalog_source_id uuid null;

alter table public.campeonato_stream_overlays
  add column if not exists license_kind text not null default 'own';

comment on column public.campeonato_stream_overlays.license_kind is
  'own | public_clone | purchased — purchased não pode virar modelo público/venda';

-- RLS service_role only
alter table public.stream_overlay_catalog enable row level security;
alter table public.stream_overlay_catalog force row level security;
alter table public.stream_overlay_purchase_codes enable row level security;
alter table public.stream_overlay_purchase_codes force row level security;
alter table public.stream_overlay_entitlements enable row level security;
alter table public.stream_overlay_entitlements force row level security;

drop policy if exists stream_catalog_service_all on public.stream_overlay_catalog;
create policy stream_catalog_service_all
  on public.stream_overlay_catalog for all
  using (
    coalesce(current_setting('request.jwt.claim.role', true), current_setting('role', true))
      in ('service_role', 'supabase_admin', 'postgres')
  )
  with check (
    coalesce(current_setting('request.jwt.claim.role', true), current_setting('role', true))
      in ('service_role', 'supabase_admin', 'postgres')
  );

drop policy if exists stream_purchase_codes_service_all on public.stream_overlay_purchase_codes;
create policy stream_purchase_codes_service_all
  on public.stream_overlay_purchase_codes for all
  using (
    coalesce(current_setting('request.jwt.claim.role', true), current_setting('role', true))
      in ('service_role', 'supabase_admin', 'postgres')
  )
  with check (
    coalesce(current_setting('request.jwt.claim.role', true), current_setting('role', true))
      in ('service_role', 'supabase_admin', 'postgres')
  );

drop policy if exists stream_entitlements_service_all on public.stream_overlay_entitlements;
create policy stream_entitlements_service_all
  on public.stream_overlay_entitlements for all
  using (
    coalesce(current_setting('request.jwt.claim.role', true), current_setting('role', true))
      in ('service_role', 'supabase_admin', 'postgres')
  )
  with check (
    coalesce(current_setting('request.jwt.claim.role', true), current_setting('role', true))
      in ('service_role', 'supabase_admin', 'postgres')
  );

revoke all on public.stream_overlay_catalog from anon, authenticated;
revoke all on public.stream_overlay_purchase_codes from anon, authenticated;
revoke all on public.stream_overlay_entitlements from anon, authenticated;
