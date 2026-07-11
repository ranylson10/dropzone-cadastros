begin;

alter table public.campeonato_configuracoes
add column if not exists valor_inscricao numeric(12,2);

alter table public.campeonato_configuracoes
add column if not exists descricao_premiacao text;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'campeonato_configuracoes'
      and column_name = 'premiacao'
      and data_type <> 'numeric'
  ) then
    alter table public.campeonato_configuracoes
    alter column premiacao type numeric(12,2)
    using (
      case
        when premiacao is null or trim(premiacao) = '' then null
        else replace(trim(premiacao), ',', '.')::numeric
      end
    );
  end if;
end $$;

alter table public.campeonato_configuracoes
drop constraint if exists campeonato_configuracoes_premiacao_check;

alter table public.campeonato_configuracoes
add constraint campeonato_configuracoes_premiacao_check
check (premiacao is null or premiacao >= 0);

alter table public.campeonato_configuracoes
drop constraint if exists campeonato_configuracoes_valor_inscricao_check;

alter table public.campeonato_configuracoes
add constraint campeonato_configuracoes_valor_inscricao_check
check (valor_inscricao is null or valor_inscricao >= 0);

alter table public.campeonato_configuracoes
drop constraint if exists campeonato_configuracoes_tipo_premiacao_check;

alter table public.campeonato_configuracoes
add constraint campeonato_configuracoes_tipo_premiacao_check
check (
  tipo_premiacao is null
  or tipo_premiacao in ('sem_premiacao', 'pix', 'dinheiro', 'brinde')
);

commit;
