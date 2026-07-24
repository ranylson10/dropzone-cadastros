begin;

alter table public.campeonato_configuracoes
  add column if not exists pagamento_pix_ativo boolean not null default true,
  add column if not exists pagamento_cartao_ativo boolean not null default true,
  add column if not exists pagamento_paypal_ativo boolean not null default false,
  add column if not exists pagamento_whatsapp_ativo boolean not null default true,
  add column if not exists cartao_max_parcelas integer not null default 1,
  add column if not exists paypal_moedas text[] not null default array['BRL', 'USD', 'EUR']::text[];

alter table public.campeonato_configuracoes
  drop constraint if exists campeonato_configuracoes_cartao_max_parcelas_check,
  drop constraint if exists campeonato_configuracoes_paypal_moedas_check;

alter table public.campeonato_configuracoes
  add constraint campeonato_configuracoes_cartao_max_parcelas_check
    check (cartao_max_parcelas between 1 and 12),
  add constraint campeonato_configuracoes_paypal_moedas_check
    check (
      cardinality(paypal_moedas) between 1 and 3
      and paypal_moedas <@ array['BRL', 'USD', 'EUR']::text[]
    );

update public.campeonato_configuracoes
set pagamento_whatsapp_ativo = jsonb_array_length(contatos_whatsapp) > 0
where contatos_whatsapp is not null;

commit;
