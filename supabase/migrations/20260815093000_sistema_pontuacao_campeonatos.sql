alter table public.campeonato_configuracoes
  add column if not exists sistema_pontuacao_tipo text not null default 'garena',
  add column if not exists sistema_pontuacao_nome text not null default 'Oficial Garena';

alter table public.campeonato_configuracoes
  drop constraint if exists campeonato_configuracoes_sistema_pontuacao_tipo_check;

alter table public.campeonato_configuracoes
  add constraint campeonato_configuracoes_sistema_pontuacao_tipo_check
  check (sistema_pontuacao_tipo = any (array['garena', 'personalizado']::text[]));

-- Configurações antigas que já divergiam da tabela oficial continuam personalizadas.
update public.campeonato_configuracoes
set
  sistema_pontuacao_tipo = 'personalizado',
  sistema_pontuacao_nome = case
    when nullif(trim(sistema_pontuacao_nome), '') is null or sistema_pontuacao_nome = 'Oficial Garena'
      then 'Personalizada'
    else sistema_pontuacao_nome
  end
where pontos_colocacao is distinct from array[12,9,8,7,6,5,4,3,2,1,0,0]::integer[]
   or pontos_por_abate is distinct from 1::numeric;

comment on column public.campeonato_configuracoes.sistema_pontuacao_tipo is
  'Preset usado pelo campeonato: garena ou personalizado.';
comment on column public.campeonato_configuracoes.sistema_pontuacao_nome is
  'Nome público/administrativo do sistema de pontuação escolhido.';
