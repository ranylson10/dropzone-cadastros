import fs from 'node:fs'
import {sql,directory,runFile} from './docker-lab.mjs'
import {seed,championship} from './fixtures.mjs'
const database=process.argv[2]||'dropzone_validation_final'
if(!/^dropzone_validation_[a-z0-9_]+$/.test(database))throw new Error('Invalid fixture DB name.')
await sql(`create database ${database};`,{database:'dropzone_audit'})
process.env.DROPZONE_FIXTURE_DB=database
const source=fs.readFileSync(directory+'/schema-reconstruction.sql','utf8').replace(/^create role .*;\r?\n/gm,'')
await sql(source,{timeout:60000})
await seed();await championship(1000)
await runFile('docs/sql/20261011_slot_mirror_guard_candidate.sql')
await runFile('docs/sql/20261011_atomic_enrollment_candidate.sql')
if(process.argv.includes('--slot-transfer')||process.argv.includes('--group-choice')||process.argv.includes('--slot-batch')||process.argv.includes('--participation')){
  await runFile('docs/sql/20261011_slot_permissions_candidate.sql')
  // Emulate permissive Supabase defaults: the candidate must explicitly revoke them.
  await sql('alter default privileges in schema public grant all on tables to anon,authenticated,service_role;')
  await runFile('docs/sql/20261011_slot_plan_candidate.sql')
  await sql('alter default privileges in schema public revoke all on tables from anon,authenticated,service_role;')
  await runFile('docs/sql/20261011_slot_transfer_candidate.sql')
  if(process.argv.includes('--slot-batch')) await runFile('docs/sql/20261011_slot_batch_candidate.sql')
  if(process.argv.includes('--participation')) {
    await runFile('docs/sql/20261011_rejoin_index_candidate.sql')
    await sql('alter default privileges in schema public grant all on tables to anon,authenticated,service_role;')
    await runFile('docs/sql/20261011_participation_write_candidate.sql')
    await sql('alter default privileges in schema public revoke all on tables from anon,authenticated,service_role;')
  }
  if(process.argv.includes('--group-choice')){
    // Fixture only: native notification trigger calls infrastructure absent in this lab.
    // Capture transactional broadcasts locally; this does NOT certify Supabase Realtime delivery.
    await sql(`create schema realtime;create table realtime.fixture_events(payload jsonb,event text,topic text,private boolean);
      create function realtime.send(payload jsonb,event text,topic text,private boolean) returns void language sql
      as $$insert into realtime.fixture_events values(payload,event,topic,private);$$;`)
    await runFile('docs/sql/20261011_group_choice_candidate.sql')
  }
}
console.log('Fresh isolated validation DB prepared: '+database)
