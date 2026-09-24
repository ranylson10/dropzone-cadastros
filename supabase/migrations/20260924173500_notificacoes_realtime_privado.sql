-- Rodada 142 — notificações em tempo real sem expor a tabela public.notificacoes ao navegador.
-- O cliente entra somente no tópico privado do próprio auth.uid(). O payload do Broadcast
-- contém apenas o id/operação; os dados completos continuam vindo de /api/notificacoes.

create or replace function public.dropzone_broadcast_notificacao_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  recipient uuid;
  notification_id uuid;
begin
  recipient := coalesce(new.destinatario_auth_user_id, old.destinatario_auth_user_id);
  notification_id := coalesce(new.id, old.id);

  if recipient is null or notification_id is null then
    return null;
  end if;

  perform realtime.send(
    jsonb_build_object(
      'id', notification_id,
      'operation', tg_op
    ),
    'notification_changed',
    'user:' || recipient::text || ':notifications',
    true
  );

  return null;
end;
$$;

revoke all on function public.dropzone_broadcast_notificacao_change() from public;

-- A trigger só avisa que algo mudou; ele não envia título, corpo, payload ou dados pessoais.
drop trigger if exists dropzone_notificacoes_realtime_trigger on public.notificacoes;
create trigger dropzone_notificacoes_realtime_trigger
after insert or update or delete on public.notificacoes
for each row execute function public.dropzone_broadcast_notificacao_change();

-- A policy é restrita a Broadcast e ao tópico exato do próprio usuário.
-- Não há policy de INSERT: o navegador não publica eventos, apenas recebe.
drop policy if exists "dropzone_receive_own_notification_broadcasts" on realtime.messages;
create policy "dropzone_receive_own_notification_broadcasts"
on realtime.messages
for select
to authenticated
using (
  realtime.messages.extension = 'broadcast'
  and (select realtime.topic()) = 'user:' || (select auth.uid())::text || ':notifications'
);
