import fs from 'node:fs'
import { createHash } from 'node:crypto'
import { directory, sql } from './docker-lab.mjs'
if(!['relatorios-testes/progressao-transacao-2026-10-12','relatorios-testes/season-transacao-2026-10-12','relatorios-testes/diario-vinculo-2026-10-12','relatorios-testes/edicao-franquia-2026-10-12','relatorios-testes/lifecycle-transacao-2026-10-12','relatorios-testes/estrutura-grupo-2026-10-12'].includes(directory))throw Error('Explicit current transactional evidence directory required')
fs.mkdirSync(directory,{recursive:true})
const catalogFile='relatorios-testes/banco-atual-2026-10-12/catalog-metadata.json',permissionsFile='relatorios-testes/banco-atual-2026-10-12/permissions-metadata.json'
const historicalFile='relatorios-testes/banco-publicado.json'
const catalog=JSON.parse(fs.readFileSync(catalogFile,'utf8')),permissions=JSON.parse(fs.readFileSync(permissionsFile,'utf8')),historical=JSON.parse(fs.readFileSync(historicalFile,'utf8'))
const quote=value=>'"'+value.replaceAll('"','""')+'"',base=catalog.tables.filter(row=>row.kind==='r'),names=new Set(base.map(row=>row.table_name))
let ddl=`-- Current public catalog reconstruction; historical function bodies match every current MD5/signature.
-- Synthetic auth/JWT/Realtime, no production user data or connection.
begin;
create schema auth;create schema extensions;create schema realtime;
create extension pgcrypto with schema extensions;create extension pg_trgm with schema extensions;
set search_path=public,extensions;
create role anon nologin;create role authenticated nologin;create role service_role nologin bypassrls;
create role supabase_admin nologin bypassrls;create role authenticator nologin;
create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb,raw_app_meta_data jsonb,created_at timestamptz default now(),updated_at timestamptz default now());
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
create function auth.role() returns text language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claim.role',true),''),current_setting('role',true))$$;
create table realtime.fixture_events(payload jsonb,event text,topic text,private boolean);
create function realtime.send(payload jsonb,event text,topic text,private boolean) returns void language sql as $$insert into realtime.fixture_events values(payload,event,topic,private);$$;
create sequence public.dropzone_public_id_seq;
`
for(const table of base){
 const columns=catalog.columns.filter(row=>row.table_name===table.table_name).sort((a,b)=>a.ordinal_position-b.ordinal_position)
 ddl+=`create table public.${quote(table.table_name)} (\n`+columns.map(column=>{
  if(!column.type||column.type==='USER-DEFINED')throw Error('Unknown exact type')
  const generated=column.generated?` generated always as (${column.default}) stored`:column.identity?` generated ${column.identity==='a'?'always':'by default'} as identity`:column.default?' default '+column.default:''
  return ` ${quote(column.column_name)} ${column.type}${generated}${column.not_null?' not null':''}`
 }).join(',\n')+'\n);\n'
}
for(const row of [...catalog.constraints.filter(row=>row.kind!=='f'),...catalog.constraints.filter(row=>row.kind==='f')])if(names.has(row.table_name))ddl+=`alter table public.${quote(row.table_name)} add constraint ${quote(row.constraint_name)} ${row.definition};\n`
const constraintNames=new Set(catalog.constraints.filter(row=>['p','u'].includes(row.kind)).map(row=>row.constraint_name))
for(const row of catalog.indexes)if(names.has(row.table_name)&&!constraintNames.has(row.index_name))ddl+=row.definition+';\n'
ddl+='set check_function_bodies=off;\n';for(const row of catalog.functions){
 const definition=historical.functions.find(before=>before.function_name===row.function_name&&before.identity_arguments===row.arguments)?.definition
 if(!definition||createHash('md5').update(definition).digest('hex')!==row.definition_md5)throw Error('Historical function does not match current metadata: '+row.function_name)
 ddl+=definition+';\n'
}ddl+='set check_function_bodies=on;\n'
const pending=[...permissions.views],done=new Set(),viewNames=new Set(pending.map(row=>row.name))
while(pending.length){const index=pending.findIndex(row=>[...row.definition.matchAll(/\b(?:FROM|JOIN)\s+(?:public\.)?([a-z_][a-z_0-9]*)/gi)].every(match=>!viewNames.has(match[1])||done.has(match[1])))
 if(index<0)throw Error('View dependency cycle/unparsed dependency')
 const [row]=pending.splice(index,1);ddl+=`create view public.${quote(row.name)}${row.options?.length?' with ('+row.options.join(',')+')':''} as ${row.definition.replace(/;\s*$/,'')};\n`;done.add(row.name)
}
for(const row of catalog.triggers){ddl+=row.definition+';\n';if(row.enabled!=='O')ddl+=`alter table public.${quote(row.table_name)} ${row.enabled==='D'?'disable':row.enabled==='A'?'enable always':'enable replica'} trigger ${quote(row.trigger_name)};\n`}
for(const row of base)if(row.rls){ddl+=`alter table public.${quote(row.table_name)} enable row level security;\n`;if(row.force_rls)ddl+=`alter table public.${quote(row.table_name)} force row level security;\n`}
for(const row of catalog.policies)if(names.has(row.tablename))ddl+=`create policy ${quote(row.policyname)} on public.${quote(row.tablename)} as ${row.permissive} for ${row.cmd} to ${row.roles.map(role=>role==='public'?'public':quote(role)).join(',')}${row.qual?' using ('+row.qual+')':''}${row.with_check?' with check ('+row.with_check+')':''};\n`
ddl+=`grant usage on schema public,auth,extensions to anon,authenticated,service_role;
grant all on all tables in schema public to service_role;grant all on all sequences in schema public to service_role;
revoke all on all functions in schema public from public,anon,authenticated;grant execute on all functions in schema public to service_role;
`
for(const row of permissions.views){if(row.anon_select)ddl+=`grant select on public.${quote(row.name)} to anon;\n`;if(row.authenticated_select)ddl+=`grant select on public.${quote(row.name)} to authenticated;\n`}
ddl+='commit;\n'
if(process.argv.includes('--without-roles'))ddl=ddl.replace(/create role [a-z_]+ [^;]+;\s*/g,'')
fs.writeFileSync(directory+'/schema-reconstruction.sql',ddl)
if(!process.argv.includes('--emit-only'))await sql(ddl,{timeout:60000})
fs.writeFileSync(directory+'/schema-sources.json',JSON.stringify({generatedAt:new Date().toISOString(),metadataAt:catalog.generated_at,baseTables:base.length,views:permissions.views.length,columnsExactTypes:true,identityGeneratedExact:true,triggersExact:true,historicalFunctionsMatchedToCurrent:catalog.functions.length,sourceFiles:[catalogFile,permissionsFile,historicalFile].map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')})),scope:'Fresh saved public types/identity/generated/constraints/indexes/triggers/policies/views. Historical function definitions verified against every current MD5/signature. Synthetic auth/JWT/Realtime and broad service fixture grants; not full managed schemas/data backup or actual Supabase ownership/ACL/infra/staging. No new remote calls.'},null,2)+'\n')
console.log('Current public schema emitted'+(process.argv.includes('--emit-only')?'':' and loaded')+': '+base.length+' tables/'+permissions.views.length+' exact views, synthetic infrastructure.')
