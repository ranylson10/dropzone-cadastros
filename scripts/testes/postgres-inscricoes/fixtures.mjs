import {sql} from './docker-lab.mjs'
export const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
export const quote=s=>"'"+String(s).replaceAll("'","''")+"'"
export const service="set request.jwt.claim.role='service_role'; set role service_role;"
export async function seed(){
  await sql(`set request.jwt.claim.role='service_role';
    insert into auth.users(id,email) select ('00000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'fixture-'||n||'@example.invalid' from generate_series(1,12)n;
    insert into public.produtoras(id,auth_user_id,username,nome,aprovacao_status) values('${id(50)}','${id(1)}','audit-fixture','Audit Fixture','aprovado');
    insert into public.equipes(id,auth_user_id,dono_auth_user_id,nome,tag) select ('00000000-0000-4000-8000-'||lpad((99+n)::text,12,'0'))::uuid,('00000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,('00000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'Fixture Team '||n,'F'||n from generate_series(1,10)n;
    insert into public.equipe_lines(id,equipe_id,nome) select ('00000000-0000-4000-8000-'||lpad((199+n)::text,12,'0'))::uuid,('00000000-0000-4000-8000-'||lpad((99+n)::text,12,'0'))::uuid,'Fixture Line '||n from generate_series(1,10)n;
    insert into public.managers(id,auth_user_id,username,nome) values('${id(300)}','${id(11)}','audit-staff','Fixture Staff');
    insert into public.manager_equipe(id,manager_id,equipe_id,pode_ver,pode_escalar) values('${id(301)}','${id(300)}','${id(100)}',true,true);`)
}
export async function championship(n,slots=4,limit=slots){
  const camp=id(n),group=id(n+1),phase=id(n+2),link=id(n+3),token=id(n+4)
  const slotIds=Array.from({length:slots},(_,i)=>id(n+10+i))
  await sql(`set request.jwt.claim.role='service_role';
    insert into public.campeonatos(id,nome,criado_por,produtora_id,aprovacao_status) values('${camp}','Fixture ${n}','${id(1)}','${id(50)}','aprovado');
    insert into public.campeonato_configuracoes(campeonato_id,numero_vagas,valor_inscricao) values('${camp}',${slots},25);
    insert into public.campeonato_fases(id,campeonato_id,nome) values('${phase}','${camp}','Entry');
    insert into public.campeonato_grupos(id,campeonato_id,nome,fase_id,slots) values('${group}','${camp}','Group','${phase}',${slots});
    ${slotIds.map((s,i)=>`insert into public.campeonato_slots(id,campeonato_id,grupo_id,fase_id,slot_numero,slot_letra,status) values('${s}','${camp}','${group}','${phase}',${i+1},'${i<26?String.fromCharCode(65+i):'S'+(i+1)}','livre');`).join('\n')}
    insert into public.campeonato_links(id,campeonato_id,grupo_id,fase_id,token,tipo,metadata,descricao) values('${link}','${camp}','${group}','${phase}','fixture-group-${n}','inscricao_equipes_grupo','{"limite_vagas":${limit},"usos":0,"entradas":[],"expected_teams":[],"fixture_keep":true}','Fixture description');
    insert into public.tokens(id,token,tipo,campeonato_id,grupo_id,fase_id) values('${token}','fixture-team-${n}','team_invite','${camp}','${group}','${phase}');`)
  return {n,camp,group,phase,link,token,slots:slotIds,groupToken:`fixture-group-${n}`,teamToken:`fixture-team-${n}`}
}
