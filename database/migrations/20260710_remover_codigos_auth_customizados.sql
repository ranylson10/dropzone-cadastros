-- Execute somente depois de confirmar que o cadastro e a recuperação
-- pelo Supabase Auth estão funcionando em produção.
-- A aplicação nova não usa mais esta tabela.

drop table if exists public.auth_verification_codes;
