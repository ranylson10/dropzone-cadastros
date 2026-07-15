-- Coluna opcional: o app funciona SEM ela (meta vai em descricao).
-- Rode no SQL Editor do Supabase se quiser metadata nativa.
alter table public.campeonato_links
  add column if not exists metadata jsonb not null default '{}'::jsonb;

comment on column public.campeonato_links.metadata is
  'Meta do link (limite_vagas, usos, entradas). Fallback: descricao com __dz_meta__.';
