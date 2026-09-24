-- DropZone R146 — índices de apoio para as FKs de quem enviou o convite.
create index if not exists produtora_membros_convidado_por_idx
  on public.produtora_membros (convidado_por_auth_user_id)
  where convidado_por_auth_user_id is not null;

create index if not exists produtora_convites_convidado_por_idx
  on public.produtora_convites (convidado_por_auth_user_id)
  where convidado_por_auth_user_id is not null;
