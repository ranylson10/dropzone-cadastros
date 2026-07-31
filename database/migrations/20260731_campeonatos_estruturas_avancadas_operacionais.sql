-- Rodada 85C — integração operacional das estruturas avançadas.
-- Vincula participações às etapas e registra a origem operacional da vaga.

create table if not exists public.campeonato_etapa_equipes (
  id uuid primary key default gen_random_uuid(),
  campeonato_id uuid not null references public.campeonatos(id) on delete cascade,
  etapa_id uuid not null references public.campeonato_etapas(id) on delete cascade,
  campeonato_equipe_id uuid not null references public.campeonato_equipes(id) on delete cascade,
  tipo_origem text not null default 'manual' check (tipo_origem in ('qualificatoria', 'promocao', 'venda_direta', 'convite', 'manual', 'outra_etapa')),
  etapa_origem_id uuid references public.campeonato_etapas(id) on delete set null,
  posicao_origem integer check (posicao_origem is null or posicao_origem > 0),
  status text not null default 'ativa' check (status in ('ativa', 'classificada', 'promovida', 'eliminada', 'retirada')),
  observacao text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (etapa_id, campeonato_equipe_id),
  check (etapa_origem_id is null or etapa_origem_id <> etapa_id)
);

create index if not exists campeonato_etapa_equipes_campeonato_idx
  on public.campeonato_etapa_equipes (campeonato_id, etapa_id, status);

create index if not exists campeonato_etapa_equipes_participacao_idx
  on public.campeonato_etapa_equipes (campeonato_equipe_id);

alter table public.campeonato_etapa_equipes enable row level security;

create or replace function public.fn_validar_campeonato_etapa_equipe_85c()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  etapa_campeonato uuid;
  participacao_campeonato uuid;
  limite integer;
  ocupadas integer;
begin
  select ce.campeonato_id, e.capacidade_total
    into etapa_campeonato, limite
    from public.campeonato_etapas e
    join public.campeonato_edicoes ed on ed.id = e.edicao_id
    join public.campeonatos ce on ce.id = ed.campeonato_id
   where e.id = new.etapa_id;

  select campeonato_id into participacao_campeonato
    from public.campeonato_equipes
   where id = new.campeonato_equipe_id;

  if etapa_campeonato is null or participacao_campeonato is null
     or etapa_campeonato <> new.campeonato_id
     or participacao_campeonato <> new.campeonato_id then
    raise exception 'Etapa e participação devem pertencer ao mesmo campeonato.';
  end if;

  if new.status <> 'retirada' and limite is not null then
    select count(*) into ocupadas
      from public.campeonato_etapa_equipes
     where etapa_id = new.etapa_id
       and status <> 'retirada'
       and id <> coalesce(new.id, gen_random_uuid());
    if ocupadas >= limite then
      raise exception 'Capacidade da etapa atingida (% vagas).', limite;
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_campeonato_etapa_equipes_validar on public.campeonato_etapa_equipes;
create trigger trg_campeonato_etapa_equipes_validar
before insert or update on public.campeonato_etapa_equipes
for each row execute function public.fn_validar_campeonato_etapa_equipe_85c();
