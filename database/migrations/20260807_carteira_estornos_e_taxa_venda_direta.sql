-- Hardening da carteira:
-- 1) permite estornos específicos no ledger;
-- 2) permite saldo disponível negativo quando chargeback acontece após saque;
-- 3) tenta proteger auditoria de split contra duplicidade por pagamento.

begin;

do $$
declare
  c record;
begin
  for c in
    select conname
      from pg_constraint
     where conrelid = 'public.sistema_carteira_lancamentos'::regclass
       and contype = 'c'
       and pg_get_constraintdef(oid) like '%credito_pagamento%'
       and pg_get_constraintdef(oid) like '%debito_saque%'
  loop
    execute format('alter table public.sistema_carteira_lancamentos drop constraint %I', c.conname);
  end loop;

  alter table public.sistema_carteira_lancamentos
    add constraint sistema_carteira_lancamentos_tipo_check
    check (tipo in (
      'credito_pagamento',
      'credito_comissao',
      'debito_saque',
      'debito_taxa',
      'estorno',
      'estorno_comissao',
      'estorno_pagamento',
      'ajuste_admin',
      'bloqueio',
      'desbloqueio'
    ));
end $$;

do $$
declare
  c record;
begin
  for c in
    select conname
      from pg_constraint
     where conrelid = 'public.sistema_carteiras'::regclass
       and contype = 'c'
       and pg_get_constraintdef(oid) like '%saldo_disponivel_centavos%'
       and pg_get_constraintdef(oid) like '%>=%'
  loop
    execute format('alter table public.sistema_carteiras drop constraint %I', c.conname);
  end loop;
end $$;

comment on column public.sistema_carteiras.saldo_disponivel_centavos is
  'Saldo disponível em centavos. Pode ficar negativo após estorno/chargeback de valor já sacado, registrando dívida financeira.';

do $$
begin
  if not exists (
    select 1
      from public.sistema_comissoes
     where pagamento_id is not null
     group by pagamento_id
    having count(*) > 1
  ) then
    create unique index if not exists sistema_comissoes_pagamento_unico_idx
      on public.sistema_comissoes (pagamento_id)
      where pagamento_id is not null;
  else
    raise notice 'sistema_comissoes possui pagamentos duplicados; saneie o histórico antes de criar índice único.';
  end if;
end $$;

insert into public.sistema_precos (chave, rotulo, descricao, categoria, valor_centavos, meta)
values (
  'taxa_venda_direta_vaga_bps',
  'Taxa venda direta de vaga (bps)',
  'Taxa de tráfego/plataforma quando a vaga é comprada diretamente no sistema sem vendedor. 500 = 5%.',
  'recurso',
  500,
  '{"unit":"bps","fixed_for_direct_vacancy_sale":true}'::jsonb
)
on conflict (chave) do update
set valor_centavos = excluded.valor_centavos,
    meta = public.sistema_precos.meta || excluded.meta;

commit;
