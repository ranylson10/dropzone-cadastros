-- Backup das edições do ADM na aba Download/SPEC (por campeonato).
-- Só o que o ADM salvar fica guardado — não sobrescreve perfil global.

create table if not exists public.campeonato_export_overrides (
  campeonato_id uuid primary key references public.campeonatos(id) on delete cascade,
  -- fundos e margens gerais
  logo_bg_url text,
  photo_bg_url text,
  logo_margin jsonb not null default '{"top":24,"right":24,"bottom":24,"left":24}'::jsonb,
  photo_margin jsonb not null default '{"top":30,"right":30,"bottom":30,"left":30}'::jsonb,
  -- edições de texto: { [id]: { nome, tag } }
  equipes jsonb not null default '{}'::jsonb,
  -- edições de jogadores: { [key]: { nick, id_jogo, funcao, localidade, tag_equipe, equipe_id } }
  jogadores jsonb not null default '{}'::jsonb,
  -- só logos que o ADM marcou para backup: { [key]: { source_url, tint_color, codigo, slot_letra, equipe_nome, line_nome } }
  logos jsonb not null default '{}'::jsonb,
  -- só fotos salvas: { [id_jogo]: { source_url, nick, equipe_nome, key } }
  fotos jsonb not null default '{}'::jsonb,
  -- opções SPEC
  nation_source text not null default 'funcao',
  role_color text not null default '#000000',
  team_color text not null default '#000000',
  text_colors jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

comment on table public.campeonato_export_overrides is
  'Overrides de export/SPEC por campeonato (nicks, tags, logos, fotos, fundos). Não altera perfil global.';

create index if not exists campeonato_export_overrides_updated_at_idx
  on public.campeonato_export_overrides (updated_at desc);
