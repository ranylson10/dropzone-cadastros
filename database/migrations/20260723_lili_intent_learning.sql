-- Base de padrões da Lili. Não dá acesso da IA ao banco; apenas registra intenções aprovadas/candidatas.
create table if not exists public.lili_intent_patterns (
  id uuid primary key default gen_random_uuid(),
  intent_code text not null,
  frase text not null,
  frase_normalizada text not null,
  confianca numeric(5,4) not null default 1,
  origem text not null default 'admin' check (origem in ('admin','sistema','gemini')),
  quantidade_usos integer not null default 0,
  aprovado boolean not null default false,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists lili_intent_patterns_unique_idx on public.lili_intent_patterns (intent_code, frase_normalizada);
create index if not exists lili_intent_patterns_lookup_idx on public.lili_intent_patterns (frase_normalizada) where ativo and aprovado;

create table if not exists public.lili_pattern_candidates (
  id uuid primary key default gen_random_uuid(),
  mensagem_original text not null,
  frase_normalizada text not null,
  intent_sugerida text not null,
  confianca numeric(5,4) not null default 0,
  quantidade_repeticoes integer not null default 1,
  status text not null default 'pendente' check (status in ('pendente','aprovado','rejeitado')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists lili_pattern_candidates_review_idx on public.lili_pattern_candidates (status, intent_sugerida, created_at desc);

alter table public.lili_intent_patterns enable row level security;
alter table public.lili_pattern_candidates enable row level security;
-- Sem policies públicas: acesso somente pelo backend service_role.
