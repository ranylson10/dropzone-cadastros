-- =============================================================================
-- DROPZONE — HARDENING DE SEGURANÇA
-- 2026-08-07
--
-- Objetivos:
-- 1) Remover privilégios diretos de escrita do papel anon em objetos public.
-- 2) Evitar que novas tabelas herdem escrita para anon.
-- 3) Fechar acesso direto de authenticated à tabela campeonato_export_overrides.
--    Essa tabela é manipulada exclusivamente pela API server-side, que valida
--    permissão de campeonato e usa supabaseAdmin/service_role.
--
-- Idempotente: pode ser executada mais de uma vez.
-- =============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1) ANON: nunca deve escrever diretamente nas tabelas do schema public.
--    SELECT não é removido aqui; leitura pública continua dependendo dos grants
--    existentes + RLS/policies específicas.
-- ---------------------------------------------------------------------------
revoke insert, update, delete, truncate, references, trigger
  on all tables in schema public
  from anon;

revoke all
  on all sequences in schema public
  from anon;

-- Impede que objetos futuros voltem a nascer com escrita para anon.
alter default privileges in schema public
  revoke insert, update, delete, truncate, references, trigger
  on tables
  from anon;

alter default privileges in schema public
  revoke all
  on sequences
  from anon;

-- ---------------------------------------------------------------------------
-- 2) campeonato_export_overrides
--
-- A rota:
--   /api/campeonatos/[id]/export/overrides
-- autentica o usuário, verifica a permissão no campeonato e só então usa
-- service_role. Portanto acesso direto pelo cliente authenticated é desnecessário.
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.campeonato_export_overrides') is not null then
    execute 'drop policy if exists campeonato_export_overrides_write_auth on public.campeonato_export_overrides';
    execute 'drop policy if exists campeonato_export_overrides_select_auth on public.campeonato_export_overrides';

    execute 'revoke all on table public.campeonato_export_overrides from anon, authenticated, public';

    -- Garantia explícita para o backend administrativo.
    execute 'grant select, insert, update, delete on table public.campeonato_export_overrides to service_role';

    execute 'alter table public.campeonato_export_overrides enable row level security';
  end if;
end
$$;

commit;
