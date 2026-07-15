-- Convites de equipe passam a reservar o SLOT estrutural (fase>grupo>letra),
-- alinhados ao modelo line-first. vaga_id permanece opcional (legado).

alter table public.tokens
  add column if not exists slot_id uuid references public.campeonato_slots(id) on delete set null;

create index if not exists tokens_slot_id_idx
  on public.tokens (slot_id)
  where slot_id is not null and status = 'ativo' and usado = false;

create index if not exists tokens_campeonato_slot_ativo_idx
  on public.tokens (campeonato_id, slot_id, status)
  where tipo = 'convite_equipe_campeonato';
