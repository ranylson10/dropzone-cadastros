alter table public.campeonato_configuracoes
  add column if not exists contatos_whatsapp jsonb not null default '[]'::jsonb;

alter table public.campeonato_configuracoes
  drop constraint if exists campeonato_configuracoes_contatos_whatsapp_array;

alter table public.campeonato_configuracoes
  add constraint campeonato_configuracoes_contatos_whatsapp_array
  check (jsonb_typeof(contatos_whatsapp) = 'array');
