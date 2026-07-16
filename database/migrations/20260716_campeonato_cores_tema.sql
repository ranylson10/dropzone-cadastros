-- Cores do layout do campeonato (adm escolhe identidade visual)
alter table public.campeonato_configuracoes
  add column if not exists cor_principal text,
  add column if not exists cor_secundaria text,
  add column if not exists cor_texto_clara text,
  add column if not exists cor_texto_escura text;

comment on column public.campeonato_configuracoes.cor_principal is 'Cor principal (#hex) do tema do campeonato';
comment on column public.campeonato_configuracoes.cor_secundaria is 'Cor secundária (#hex)';
comment on column public.campeonato_configuracoes.cor_texto_clara is 'Texto em fundo escuro (#hex)';
comment on column public.campeonato_configuracoes.cor_texto_escura is 'Texto em fundo claro (#hex)';
