-- Comissão por vendedor/campeonato para venda de vagas.
-- Valor em basis points: 100 = 1%, máximo 2000 = 20%.

alter table public.campeonato_vendedores
  add column if not exists comissao_bps integer;

alter table public.tokens
  add column if not exists manager_comissao_bps integer;

alter table public.campeonato_manager_convites
  add column if not exists comissao_bps integer;

update public.campeonato_vendedores
   set comissao_bps = least(greatest(coalesce(comissao_bps, 0), 0), 2000)
 where comissao_bps is not null;

update public.tokens
   set manager_comissao_bps = least(greatest(coalesce(manager_comissao_bps, 0), 0), 2000)
 where manager_comissao_bps is not null;

update public.campeonato_manager_convites
   set comissao_bps = least(greatest(coalesce(comissao_bps, 0), 0), 2000)
 where comissao_bps is not null;

do $$
begin
  if not exists (
    select 1
      from pg_constraint
     where conname = 'campeonato_vendedores_comissao_bps_check'
       and conrelid = 'public.campeonato_vendedores'::regclass
  ) then
    alter table public.campeonato_vendedores
      add constraint campeonato_vendedores_comissao_bps_check
      check (comissao_bps is null or (comissao_bps >= 0 and comissao_bps <= 2000));
  end if;

  if not exists (
    select 1
      from pg_constraint
     where conname = 'tokens_manager_comissao_bps_check'
       and conrelid = 'public.tokens'::regclass
  ) then
    alter table public.tokens
      add constraint tokens_manager_comissao_bps_check
      check (manager_comissao_bps is null or (manager_comissao_bps >= 0 and manager_comissao_bps <= 2000));
  end if;

  if not exists (
    select 1
      from pg_constraint
     where conname = 'campeonato_manager_convites_comissao_bps_check'
       and conrelid = 'public.campeonato_manager_convites'::regclass
  ) then
    alter table public.campeonato_manager_convites
      add constraint campeonato_manager_convites_comissao_bps_check
      check (comissao_bps is null or (comissao_bps >= 0 and comissao_bps <= 2000));
  end if;
end $$;

comment on column public.campeonato_vendedores.comissao_bps is
  'Comissão do vendedor na venda de vagas deste campeonato. 100 = 1%, máximo 2000 = 20%.';

comment on column public.tokens.manager_comissao_bps is
  'Comissão sugerida no convite de vendedor. 100 = 1%, máximo 2000 = 20%.';

comment on column public.campeonato_manager_convites.comissao_bps is
  'Comissão combinada no convite/pedido de manager para este campeonato. 100 = 1%, máximo 2000 = 20%.';
