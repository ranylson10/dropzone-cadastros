-- DROPZONE · PayPal para pagamentos iniciados pela Lili
-- Rode depois de 20260719_carteira_asaas.sql e 20260724_lili_reservas_temporarias.sql.

alter table public.sistema_pagamentos
  add column if not exists provider text not null default 'asaas',
  add column if not exists moeda text not null default 'BRL',
  add column if not exists paypal_order_id text,
  add column if not exists paypal_capture_id text,
  add column if not exists paypal_status text,
  add column if not exists paypal_approval_url text;

create unique index if not exists ux_sistema_pagamentos_paypal_order
  on public.sistema_pagamentos(paypal_order_id)
  where paypal_order_id is not null;

create index if not exists idx_sistema_pagamentos_provider
  on public.sistema_pagamentos(provider, status, created_at desc);

alter table public.sistema_pagamentos
  drop constraint if exists sistema_pagamentos_provider_check;
alter table public.sistema_pagamentos
  add constraint sistema_pagamentos_provider_check check (provider in ('asaas','paypal'));

alter table public.sistema_pagamentos
  drop constraint if exists sistema_pagamentos_moeda_check;
alter table public.sistema_pagamentos
  add constraint sistema_pagamentos_moeda_check check (moeda in ('BRL','USD','EUR'));
