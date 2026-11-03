// R09: offline structural/contract checks, NOT PostgreSQL execution or concurrency proof.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { join, resolve } from 'node:path'
const root=resolve(import.meta.dirname,'../..')
const src=p=>fs.readFileSync(join(root,p),'utf8')
const plan=src('docs/sql/20261011_slot_plan_candidate.sql')
const enrollment=src('docs/sql/20261011_atomic_enrollment_candidate.sql')
const readiness=src('docs/sql/20261026_round9_atomic_readiness_readonly.sql')
const policy=src('backend/src/campeonatos/legacy-slot-eligibility.ts')
const errors=src('backend/src/campeonatos/invites/atomic-enrollment.ts')
let checks=0
const check=(condition,reason)=>{assert.ok(condition,reason);checks++}
const section=(text,start,end)=>{
 const a=text.indexOf(start);assert.ok(a>=0,`Missing ${start}`)
 const b=text.indexOf(end,a+start.length);assert.ok(b>a,`Missing ${end}`)
 return text.slice(a,b)
}
const guard=(text)=>{
 check(/campeonato_grupo_escolha_bloqueios\s+b/.test(text),'blocks in SQL target')
 check(/b\.ativo\s+and\s*\(b\.grupo_id\s*=/.test(text),'only active blocked group/slot')
 check(/b\.fase_id\s*=/.test(text),'phase-scoped block')
 check(/lili_reservas_slot\s+r/.test(text),'Lili reservation')
 check(/r\.status='ativa'\s+and\s+r\.expira_em>clock_timestamp\(\)/.test(text),'non-expired Lili')
 check(/public\.tokens\s+(?:t|k)/.test(text),'invite reservation')
 check(/'team_invite','convite_equipe_campeonato'/.test(text),'both invite types')
 check(/coalesce\((?:t|k)\.usado,false\)=false/.test(text),'unused invitation')
 check(/expira_em\s+is null\s+or\s+(?:t|k)\.expira_em>clock_timestamp\(\)/.test(text),'non-expired invitation')
}
// The pre-write check MUST follow row locks and precede the first participation mutation.
const pre=section(plan,"      -- R09: the atomic admin path", "      if not ((v_slot.status='livre'")
guard(pre)
check(plan.indexOf('for update;\n  perform 1 from public.equipe_lines')<plan.indexOf('-- R09: the atomic admin path'),'slot lock comes before guard')
check(plan.indexOf('-- R09: the atomic admin path') < plan.indexOf('update public.campeonato_equipes set grupo_id=null'),'guard before mutation')
const post=section(plan,'  -- R09 final recheck','  insert into public.movimentacao_recibos(')
guard(post)
check(plan.indexOf('update public.campeonato_equipes set grupo_id=null')<plan.indexOf('  -- R09 final recheck'),'post-check after writes')
const invitePre=section(enrollment,'  -- R09: a manual block','  -- Recheck in a NEW READ COMMITTED statement')
check(/campeonato_grupo_escolha_bloqueios/.test(invitePre),'invite check before mutation')
check(enrollment.indexOf('  -- R09: a manual block') < enrollment.indexOf('  insert into public.campeonato_equipes('),'invite check before insert')
const invitePost=section(enrollment,'  -- R09: repeat the block check','  insert into public.inscricao_recibos(')
check(/campeonato_grupo_escolha_bloqueios/.test(invitePost),'invite recheck before receipt')
check(/'Grupo ou slot bloqueado pela administração\.': 409/.test(errors),'domain error handled 409')
// Consistency with the legacy R08 validator's three categories.
for(const name of ['campeonato_grupo_escolha_bloqueios','lili_reservas_slot','tokens']){
 check(policy.includes(name)&&plan.includes(name),'shared legacy/atomic exclusions '+name)
}
check(/begin transaction read only;/i.test(readiness),'readiness SQL read-only')
check(/ready_for_atomic_live_use',false/.test(readiness),'never asserts readiness automatically')
check(/invalid_active_mirrors/.test(readiness),'mirror diagnostics included')
check(/conflicting_open_lines/.test(readiness),'open line diagnostics included')
check(!/\b(create|alter|drop|insert|update|delete|truncate)\s+(table|index|function|into|public\.)/i.test(readiness),'no mutating SQL in readiness')
console.log(`R09: ${checks} offline SQL contract assertions passed. PostgreSQL concurrency NOT executed.`)
