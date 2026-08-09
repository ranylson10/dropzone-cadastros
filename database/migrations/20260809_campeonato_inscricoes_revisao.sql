begin;

alter table public.campeonato_equipes
  add column if not exists solicitado_em timestamptz,
  add column if not exists revisado_em timestamptz,
  add column if not exists revisado_por uuid references auth.users(id) on delete set null,
  add column if not exists motivo_rejeicao text;

update public.campeonato_equipes
set solicitado_em = coalesce(solicitado_em, created_at)
where origem_entrada in ('inscricao','link','token','compra_online')
  and solicitado_em is null;

create index if not exists campeonato_equipes_revisao_idx
  on public.campeonato_equipes (campeonato_id, status, solicitado_em desc);

create unique index if not exists campeonato_equipes_line_pendente_unique
  on public.campeonato_equipes (campeonato_id, line_id)
  where line_id is not null and status = 'pendente';

comment on column public.campeonato_equipes.solicitado_em is 'Data da solicitação de inscrição quando a entrada depende de revisão.';
comment on column public.campeonato_equipes.revisado_em is 'Data da última decisão administrativa sobre a solicitação.';
comment on column public.campeonato_equipes.revisado_por is 'Usuário que aprovou ou rejeitou a solicitação.';
comment on column public.campeonato_equipes.motivo_rejeicao is 'Motivo informado ao rejeitar a inscrição.';

commit;
