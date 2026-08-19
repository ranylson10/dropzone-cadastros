-- Login: o fallback de legado procura uma equipe ainda sem dono por e-mail e
-- ordena por criação. Este índice evita varredura da tabela nesse caminho raro.
create index if not exists equipes_unowned_email_lookup_idx
  on public.equipes (email_contato, created_at)
  where auth_user_id is null and dono_auth_user_id is null;
