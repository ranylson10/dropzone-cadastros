-- Carrinho e favoritos por usuario.
-- O checkout multi-itens fica para a proxima etapa; esta migration persiste
-- intencao de compra/favoritos com RLS e vinculo real aos campeonatos.

begin;

create table if not exists public.commerce_carrinhos (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'ativo' check (status in ('ativo', 'convertido', 'abandonado', 'expirado')),
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists commerce_carrinhos_usuario_ativo_idx
  on public.commerce_carrinhos (auth_user_id)
  where status = 'ativo';

create table if not exists public.commerce_carrinho_itens (
  id uuid primary key default gen_random_uuid(),
  carrinho_id uuid not null references public.commerce_carrinhos(id) on delete cascade,
  campeonato_id uuid not null references public.campeonatos(id) on delete cascade,
  quantidade integer not null default 1 check (quantidade > 0 and quantidade <= 100),
  preco_unitario_centavos integer not null default 0 check (preco_unitario_centavos >= 0),
  origem text not null default 'direto' check (origem in ('direto', 'vendedor', 'afiliado', 'lili', 'app')),
  vendedor_manager_id uuid null references public.managers(id) on delete set null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (carrinho_id, campeonato_id, vendedor_manager_id)
);

create table if not exists public.commerce_favoritos (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  campeonato_id uuid not null references public.campeonatos(id) on delete cascade,
  origem text not null default 'direto' check (origem in ('direto', 'vendedor', 'afiliado', 'lili', 'app')),
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (auth_user_id, campeonato_id)
);

alter table public.commerce_carrinhos enable row level security;
alter table public.commerce_carrinho_itens enable row level security;
alter table public.commerce_favoritos enable row level security;

drop policy if exists commerce_carrinhos_select_own on public.commerce_carrinhos;
drop policy if exists commerce_carrinhos_insert_own on public.commerce_carrinhos;
drop policy if exists commerce_carrinhos_update_own on public.commerce_carrinhos;
drop policy if exists commerce_carrinhos_delete_own on public.commerce_carrinhos;

create policy commerce_carrinhos_select_own on public.commerce_carrinhos
  for select using (auth.uid() = auth_user_id);
create policy commerce_carrinhos_insert_own on public.commerce_carrinhos
  for insert with check (auth.uid() = auth_user_id);
create policy commerce_carrinhos_update_own on public.commerce_carrinhos
  for update using (auth.uid() = auth_user_id) with check (auth.uid() = auth_user_id);
create policy commerce_carrinhos_delete_own on public.commerce_carrinhos
  for delete using (auth.uid() = auth_user_id);

drop policy if exists commerce_carrinho_itens_select_own on public.commerce_carrinho_itens;
drop policy if exists commerce_carrinho_itens_insert_own on public.commerce_carrinho_itens;
drop policy if exists commerce_carrinho_itens_update_own on public.commerce_carrinho_itens;
drop policy if exists commerce_carrinho_itens_delete_own on public.commerce_carrinho_itens;

create policy commerce_carrinho_itens_select_own on public.commerce_carrinho_itens
  for select using (
    exists (
      select 1 from public.commerce_carrinhos c
      where c.id = carrinho_id and c.auth_user_id = auth.uid()
    )
  );
create policy commerce_carrinho_itens_insert_own on public.commerce_carrinho_itens
  for insert with check (
    exists (
      select 1 from public.commerce_carrinhos c
      where c.id = carrinho_id and c.auth_user_id = auth.uid()
    )
  );
create policy commerce_carrinho_itens_update_own on public.commerce_carrinho_itens
  for update using (
    exists (
      select 1 from public.commerce_carrinhos c
      where c.id = carrinho_id and c.auth_user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.commerce_carrinhos c
      where c.id = carrinho_id and c.auth_user_id = auth.uid()
    )
  );
create policy commerce_carrinho_itens_delete_own on public.commerce_carrinho_itens
  for delete using (
    exists (
      select 1 from public.commerce_carrinhos c
      where c.id = carrinho_id and c.auth_user_id = auth.uid()
    )
  );

drop policy if exists commerce_favoritos_select_own on public.commerce_favoritos;
drop policy if exists commerce_favoritos_insert_own on public.commerce_favoritos;
drop policy if exists commerce_favoritos_delete_own on public.commerce_favoritos;

create policy commerce_favoritos_select_own on public.commerce_favoritos
  for select using (auth.uid() = auth_user_id);
create policy commerce_favoritos_insert_own on public.commerce_favoritos
  for insert with check (auth.uid() = auth_user_id);
create policy commerce_favoritos_delete_own on public.commerce_favoritos
  for delete using (auth.uid() = auth_user_id);

comment on table public.commerce_carrinhos is 'Carrinho persistido por usuario. Nao confirma pagamento nem reserva definitiva sozinho.';
comment on table public.commerce_carrinho_itens is 'Itens do carrinho vinculados a campeonatos e quantidade desejada.';
comment on table public.commerce_favoritos is 'Lista de campeonatos salvos/favoritos por usuario.';

commit;
