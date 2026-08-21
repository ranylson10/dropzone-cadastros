import { spawnSync } from 'node:child_process'

function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit', shell: process.platform === 'win32' })
  return result.status ?? 1
}

// Os testes controlados criam dados no projeto vinculado. A limpeza roda no
// finally para não deixar resíduos mesmo quando o teste falha no meio do fluxo.
let status = 1
try {
  status = run('npx', ['playwright', 'test', 'tests-e2e/controlled'])
} finally {
  const cleanup = run('npx', ['supabase', 'db', 'query', '--linked', '--file', 'database/auditoria/limpar_residuos_e2e.sql'])
  if (cleanup !== 0) status = cleanup
}
process.exit(status)
