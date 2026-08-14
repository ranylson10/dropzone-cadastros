-- O MatchResult pode criar jogadores temporarios. Eles precisam pertencer ao
-- elenco/line da equipe para aparecer no painel da equipe, mesmo sem auth.
begin;

alter table public.equipe_jogadores
  add column if not exists jogador_id uuid references public.jogadores(id) on delete set null,
  add column if not exists jogador_temporario_id uuid references public.jogadores_temporarios(id) on delete set null;

create index if not exists equipe_jogadores_jogador_idx
  on public.equipe_jogadores (jogador_id)
  where jogador_id is not null;

create index if not exists equipe_jogadores_temporario_idx
  on public.equipe_jogadores (jogador_temporario_id)
  where jogador_temporario_id is not null;

create unique index if not exists equipe_jogadores_jogador_equipe_unique
  on public.equipe_jogadores (equipe_id, jogador_id)
  where jogador_id is not null;

create unique index if not exists equipe_jogadores_temporario_equipe_unique
  on public.equipe_jogadores (equipe_id, jogador_temporario_id)
  where jogador_temporario_id is not null;

update public.equipe_jogadores elenco
set jogador_id = jogador.id,
    updated_at = now()
from public.jogadores jogador
where elenco.jogador_id is null
  and elenco.jogador_auth_user_id = jogador.auth_user_id;

-- Repara MatchResults ja confirmados, criando o membro de elenco quando falta.
insert into public.equipe_jogadores (
  equipe_id, jogador_auth_user_id, jogador_id, jogador_temporario_id,
  nick, foto_url, id_jogo, funcao, localidade, origem, status
)
select distinct on (formacao.equipe_id, coalesce(formacao.jogador_id::text, formacao.jogador_temporario_id::text))
  formacao.equipe_id,
  jogador.auth_user_id,
  formacao.jogador_id,
  formacao.jogador_temporario_id,
  formacao.nick,
  coalesce(jogador.avatar_url, temporario.foto_url),
  formacao.id_jogo,
  formacao.funcao,
  jogador.localidade,
  'matchresult',
  'ativo'
from public.campeonato_jogadores formacao
left join public.jogadores jogador on jogador.id = formacao.jogador_id
left join public.jogadores_temporarios temporario on temporario.id = formacao.jogador_temporario_id
where formacao.equipe_id is not null
  and (formacao.jogador_id is not null or formacao.jogador_temporario_id is not null)
  and not exists (
    select 1
    from public.equipe_jogadores existente
    where existente.equipe_id = formacao.equipe_id
      and (
        (formacao.jogador_id is not null and existente.jogador_id = formacao.jogador_id)
        or (formacao.jogador_temporario_id is not null and existente.jogador_temporario_id = formacao.jogador_temporario_id)
      )
  )
order by formacao.equipe_id, coalesce(formacao.jogador_id::text, formacao.jogador_temporario_id::text), formacao.created_at desc;

-- Associa os membros importados a sua line e guarda o elo na formacao.
with formacoes as (
  select
    formacao.id as campeonato_jogador_id,
    formacao.equipe_id,
    formacao.line_id,
    elenco.id as equipe_jogador_id
  from public.campeonato_jogadores formacao
  join public.equipe_jogadores elenco on elenco.equipe_id = formacao.equipe_id
    and (
      (formacao.jogador_id is not null and elenco.jogador_id = formacao.jogador_id)
      or (formacao.jogador_temporario_id is not null and elenco.jogador_temporario_id = formacao.jogador_temporario_id)
    )
  where formacao.line_id is not null
)
insert into public.equipe_line_jogadores (equipe_id, line_id, equipe_jogador_id, status)
select distinct formacao.equipe_id, formacao.line_id, formacao.equipe_jogador_id, 'ativo'
from formacoes formacao
where not exists (
  select 1
  from public.equipe_line_jogadores membro_line
  where membro_line.line_id = formacao.line_id
    and membro_line.equipe_jogador_id = formacao.equipe_jogador_id
    and membro_line.status = 'ativo'
);

update public.campeonato_jogadores formacao
set equipe_jogador_id = elenco.id,
    updated_at = now()
from public.equipe_jogadores elenco
where formacao.equipe_jogador_id is null
  and formacao.equipe_id = elenco.equipe_id
  and (
    (formacao.jogador_id is not null and elenco.jogador_id = formacao.jogador_id)
    or (formacao.jogador_temporario_id is not null and elenco.jogador_temporario_id = formacao.jogador_temporario_id)
  );

alter table public.equipe_jogadores
  drop constraint if exists equipe_jogadores_identidade_check;

alter table public.equipe_jogadores
  add constraint equipe_jogadores_identidade_check
  check (jogador_auth_user_id is not null or jogador_id is not null or jogador_temporario_id is not null) not valid;

commit;
