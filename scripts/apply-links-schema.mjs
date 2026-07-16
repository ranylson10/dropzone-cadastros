/**
 * Aplica schema mínimo de campeonato_links via SQL se possível.
 * Tenta: 1) SUPABASE_DB_URL / DATABASE_URL com pg
 *        2) fallback: documentar o que falta
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'

function loadEnv(filePath) {
  try {
    const text = readFileSync(filePath, 'utf8')
    for (const line of text.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
      if (!m) continue
      let v = m[2].trim()
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
      if (!process.env[m[1]]) process.env[m[1]] = v
    }
  } catch {}
}

loadEnv(resolve('web/.env.local'))

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const dbUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL || process.env.POSTGRES_URL

const SQL = `
-- schema mínimo para links de inscrição funcionarem 100%
alter table public.campeonato_links
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table public.campeonato_links
  add column if not exists deleted_at timestamptz;

-- Reescreve triggers para NÃO quebrar se metadata falhar (defensivo)
create or replace function public.fn_fechar_link_grupo_se_cheio()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_campeonato_id uuid;
  v_grupo_id uuid;
  v_total int;
  v_livres int;
  v_has_metadata boolean;
begin
  v_campeonato_id := coalesce(new.campeonato_id, old.campeonato_id);
  v_grupo_id := coalesce(new.grupo_id, old.grupo_id);
  if v_campeonato_id is null or v_grupo_id is null then
    return coalesce(new, old);
  end if;

  select count(*)::int into v_total
  from public.campeonato_slots s
  where s.campeonato_id = v_campeonato_id and s.grupo_id = v_grupo_id;
  if coalesce(v_total, 0) < 1 then
    return coalesce(new, old);
  end if;

  select count(*)::int into v_livres
  from public.campeonato_slots s
  where s.campeonato_id = v_campeonato_id
    and s.grupo_id = v_grupo_id
    and s.line_id is null
    and s.equipe_id is null;

  if coalesce(v_livres, 0) = 0 then
    select exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'campeonato_links' and column_name = 'metadata'
    ) into v_has_metadata;

    if v_has_metadata then
      update public.campeonato_links l
         set ativo = false,
             metadata = coalesce(l.metadata, '{}'::jsonb)
                        || jsonb_build_object('closed_reason', 'grupo_cheio', 'closed_at', now()),
             updated_at = now()
       where l.campeonato_id = v_campeonato_id
         and l.grupo_id = v_grupo_id
         and l.tipo = 'inscricao_equipes_grupo'
         and coalesce(l.ativo, true) is true;
    else
      update public.campeonato_links l
         set ativo = false,
             updated_at = now()
       where l.campeonato_id = v_campeonato_id
         and l.grupo_id = v_grupo_id
         and l.tipo = 'inscricao_equipes_grupo'
         and coalesce(l.ativo, true) is true;
    end if;
  end if;

  return coalesce(new, old);
end;
$$;

create or replace function public.fn_fechar_link_grupo_apos_participacao()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_has_metadata boolean;
begin
  if tg_op = 'UPDATE' and new.grupo_id is not null then
    if not exists (
      select 1 from public.campeonato_slots s
      where s.campeonato_id = new.campeonato_id
        and s.grupo_id = new.grupo_id
        and s.line_id is null
        and s.equipe_id is null
    ) then
      select exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'campeonato_links' and column_name = 'metadata'
      ) into v_has_metadata;

      if v_has_metadata then
        update public.campeonato_links l
           set ativo = false,
               metadata = coalesce(l.metadata, '{}'::jsonb)
                          || jsonb_build_object('closed_reason', 'grupo_cheio', 'closed_at', now()),
               updated_at = now()
         where l.campeonato_id = new.campeonato_id
           and l.grupo_id = new.grupo_id
           and l.tipo = 'inscricao_equipes_grupo'
           and coalesce(l.ativo, true) is true;
      else
        update public.campeonato_links l
           set ativo = false,
               updated_at = now()
         where l.campeonato_id = new.campeonato_id
           and l.grupo_id = new.grupo_id
           and l.tipo = 'inscricao_equipes_grupo'
           and coalesce(l.ativo, true) is true;
      end if;
    end if;
  end if;
  return new;
end;
$$;
`

async function tryPg() {
  if (!dbUrl) return { ok: false, reason: 'no DATABASE_URL' }
  try {
    const pg = await import('pg')
    const client = new pg.default.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })
    await client.connect()
    await client.query(SQL)
    await client.end()
    return { ok: true, via: 'pg' }
  } catch (e) {
    return { ok: false, reason: e.message }
  }
}

async function probe() {
  const sb = createClient(url, serviceKey, { auth: { persistSession: false } })
  const meta = await sb.from('campeonato_links').select('id,metadata').limit(1)
  const del = await sb.from('campeonato_links').select('id,deleted_at').limit(1)
  return {
    metadata: !meta.error,
    deleted_at: !del.error,
    meta_err: meta.error?.message,
    del_err: del.error?.message,
  }
}

const before = await probe()
console.log('before', before)

const pgResult = await tryPg()
console.log('pg_apply', pgResult)

// If still missing metadata, try creating via PostgREST won't work.
// Write SQL file for one-click apply
import { writeFileSync } from 'fs'
writeFileSync(resolve('database/migrations/20260716_fix_triggers_metadata_obrigatorio.sql'), SQL)
console.log('wrote database/migrations/20260716_fix_triggers_metadata_obrigatorio.sql')

const after = await probe()
console.log('after', after)

if (!after.metadata) {
  console.error('\nACTION REQUIRED: run the SQL in Supabase SQL Editor:')
  console.error('database/migrations/20260716_fix_triggers_metadata_obrigatorio.sql')
  console.error('OR: database/migrations/20260716_links_soft_delete_e_consumo_atomico.sql')
  process.exit(2)
}
console.log('Schema OK')
