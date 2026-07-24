-- DROPZONE · Reservas temporárias de slot iniciadas pela Lili
-- Idempotente. Mantém convite/inscrição existentes e evita dupla compra do mesmo slot.

create table if not exists public.lili_reservas_slot (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  campeonato_id uuid not null references public.campeonatos(id) on delete cascade,
  grupo_id uuid not null references public.campeonato_grupos(id) on delete cascade,
  slot_id uuid not null references public.campeonato_slots(id) on delete cascade,
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  equipe_id uuid null references public.equipes(id) on delete set null,
  line_id uuid null,
  nome_line text null,
  convite_token text null,
  metodo text not null check (metodo in ('pix','cartao','paypal','whatsapp')),
  status text not null default 'ativa' check (status in ('ativa','confirmada','cancelada','expirada')),
  pagamento_id uuid null references public.sistema_pagamentos(id) on delete set null,
  compra_vaga_id uuid null references public.sistema_compras_vaga(id) on delete set null,
  expira_em timestamptz not null,
  confirmado_em timestamptz null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_lili_reservas_slot_expira
  on public.lili_reservas_slot(status, expira_em);
create index if not exists idx_lili_reservas_slot_user
  on public.lili_reservas_slot(auth_user_id, created_at desc);
create unique index if not exists ux_lili_reserva_slot_ativa
  on public.lili_reservas_slot(slot_id)
  where status = 'ativa';

alter table public.lili_reservas_slot enable row level security;
alter table public.lili_reservas_slot force row level security;

do $$
begin
  drop policy if exists lili_reservas_slot_service_all on public.lili_reservas_slot;
  create policy lili_reservas_slot_service_all on public.lili_reservas_slot
    for all using (
      coalesce(current_setting('request.jwt.claim.role', true), current_setting('role', true))
        in ('service_role','supabase_admin','postgres')
    ) with check (
      coalesce(current_setting('request.jwt.claim.role', true), current_setting('role', true))
        in ('service_role','supabase_admin','postgres')
    );
  revoke all on public.lili_reservas_slot from anon, authenticated;
exception when others then
  raise notice 'RLS lili_reservas_slot: %', sqlerrm;
end $$;

create or replace function public.fn_lili_reservar_slot(
  p_codigo text,
  p_campeonato_id uuid,
  p_grupo_id uuid,
  p_slot_id uuid,
  p_auth_user_id uuid,
  p_equipe_id uuid,
  p_line_id uuid,
  p_nome_line text,
  p_convite_token text,
  p_metodo text,
  p_minutos integer,
  p_meta jsonb default '{}'::jsonb
) returns public.lili_reservas_slot
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slot public.campeonato_slots%rowtype;
  v_reserva public.lili_reservas_slot%rowtype;
  v_expira timestamptz := now() + make_interval(mins => greatest(1, least(coalesce(p_minutos, 15), 120)));
begin
  update public.lili_reservas_slot
     set status='expirada', updated_at=now()
   where status='ativa' and expira_em <= now();

  select * into v_slot
    from public.campeonato_slots
   where id=p_slot_id
   for update;

  if not found then raise exception 'Slot não encontrado.'; end if;
  if v_slot.campeonato_id <> p_campeonato_id or v_slot.grupo_id <> p_grupo_id then
    raise exception 'O slot não pertence ao campeonato e grupo selecionados.';
  end if;
  if v_slot.equipe_id is not null or v_slot.line_id is not null or v_slot.status='ocupado' then
    raise exception 'Este slot já foi ocupado por outra equipe.';
  end if;

  select * into v_reserva
    from public.lili_reservas_slot
   where slot_id=p_slot_id and status='ativa' and expira_em > now()
   for update;

  if found and v_reserva.auth_user_id <> p_auth_user_id then
    raise exception 'Este slot acabou de ser reservado por outro usuário.';
  end if;

  if found then
    update public.lili_reservas_slot
       set equipe_id=p_equipe_id, line_id=p_line_id, nome_line=p_nome_line,
           convite_token=p_convite_token, metodo=p_metodo, expira_em=v_expira,
           meta=coalesce(p_meta,'{}'::jsonb), updated_at=now()
     where id=v_reserva.id
     returning * into v_reserva;
  else
    insert into public.lili_reservas_slot(
      codigo,campeonato_id,grupo_id,slot_id,auth_user_id,equipe_id,line_id,nome_line,
      convite_token,metodo,expira_em,meta
    ) values (
      p_codigo,p_campeonato_id,p_grupo_id,p_slot_id,p_auth_user_id,p_equipe_id,p_line_id,p_nome_line,
      p_convite_token,p_metodo,v_expira,coalesce(p_meta,'{}'::jsonb)
    ) returning * into v_reserva;
  end if;

  update public.campeonato_slots
     set status='reservado', updated_at=now()
   where id=p_slot_id and equipe_id is null and line_id is null;

  return v_reserva;
end;
$$;

create or replace function public.fn_lili_liberar_reservas_expiradas()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
begin
  with expired as (
    update public.lili_reservas_slot
       set status='expirada', updated_at=now()
     where status='ativa' and expira_em <= now()
     returning slot_id
  )
  select count(*) into v_count from expired;

  update public.campeonato_slots s
     set status='livre', updated_at=now()
   where s.status='reservado'
     and s.equipe_id is null and s.line_id is null
     and not exists (
       select 1 from public.lili_reservas_slot r
        where r.slot_id=s.id and r.status='ativa' and r.expira_em>now()
     )
     and not exists (
       select 1 from public.tokens t
        where t.slot_id=s.id and t.status='ativo' and coalesce(t.usado,false)=false
          and (t.expira_em is null or t.expira_em>now())
     );
  return v_count;
end;
$$;
