-- =============================================================================
-- DROPZONE · Pacote único de overlays por campeonato
-- Modelo compartilhado: identidade + assets + tabela + cards + animação.
-- As overlays passam a ser tipos do pacote, não projetos visuais independentes.
-- =============================================================================

alter table public.campeonato_stream_pack
  add column if not exists enabled_overlay_types jsonb not null default '[]'::jsonb,
  add column if not exists assets jsonb not null default '{}'::jsonb,
  add column if not exists shared_config jsonb not null default '{}'::jsonb,
  add column if not exists overlay_configs jsonb not null default '{}'::jsonb,
  add column if not exists schema_version integer not null default 2;

comment on column public.campeonato_stream_pack.enabled_overlay_types is
  'Tipos de overlay oficiais habilitados no pacote do campeonato.';
comment on column public.campeonato_stream_pack.assets is
  'Assets compartilhados do pacote. Cada imagem é armazenada uma vez e reutilizada pelas overlays.';
comment on column public.campeonato_stream_pack.shared_config is
  'Configuração global herdada pelas overlays: identidade, imagem/texto soltos, tabelas, cards e animação.';
comment on column public.campeonato_stream_pack.overlay_configs is
  'Somente opções específicas/overrides de cada tipo de overlay do pacote.';
comment on column public.campeonato_stream_pack.schema_version is
  'Versão do modelo do pacote de overlays.';

-- Modelo antigo de composição por cenas não possui consumidor no código atual.
-- O pacote único substituiu essa estrutura em 20260719; removemos agora para não
-- manter duas fontes de verdade para a composição da transmissão.
drop table if exists public.campeonato_stream_scenes cascade;
