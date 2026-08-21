alter table public.agenda_eventos add column if not exists cor_texto text not null default '#ffffff'
  check (cor_texto ~ '^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$');
