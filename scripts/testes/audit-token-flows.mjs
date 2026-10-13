import fs from 'node:fs'
import path from 'node:path'
import { readProjectSource } from './lib/project-source.mjs'

const root = process.cwd()
const read = (file) => readProjectSource(root, file)
const exists = (file) => fs.existsSync(path.join(root, file))
let failed = 0

function check(label, ok, detail = '') {
  if (ok) console.log(`OK  ${label}${detail ? ` — ${detail}` : ''}`)
  else { console.error(`ERRO ${label}${detail ? ` — ${detail}` : ''}`); failed += 1 }
}

const foundation = [
  'web/features/token-flow/TokenFlow.tsx',
  'web/features/token-flow/routes.ts',
  'web/features/token-flow/session.ts',
  'web/features/token-flow/index.ts',
  'web/features/token-flow/token-flow.css',
]
for (const file of foundation) check(`existe ${file}`, exists(file))

const layout = read('web/app/layout.tsx')
const authReturn = read('web/features/auth/auth-return.ts')
const flowUi = read('web/features/token-flow/TokenFlow.tsx')
const routesSource = read('web/features/token-flow/routes.ts')
const sessionSource = read('web/features/token-flow/session.ts')

check('layout carrega CSS único dos fluxos por token', layout.includes("@/features/token-flow/token-flow.css"))
check('TokenFlowPage marca raiz canônica', flowUi.includes('data-dz-token-flow="page"'))
check('TokenFlowCard marca card canônico', flowUi.includes('data-dz-token-flow="card"'))
check('gate de autenticação reaproveita Dialog global', flowUi.includes('<Dialog') && flowUi.includes('<SocialLogin'))
check('sessão por token possui helper único', sessionSource.includes('getTokenFlowSession') && sessionSource.includes('requireTokenFlowAccessToken'))
check('headers bearer passam pela camada de token', sessionSource.includes('tokenFlowAuthHeaders'))
check('falha de sessão degrada para visitante sem bloquear link público', sessionSource.includes('if (error)') && sessionSource.includes('authenticated: false'))
check('auth-return delega fluxos diretos ao registry', authReturn.includes('isDirectTokenAuthReturnPath(path)'))
check('registry possui compra de vaga', routesSource.includes("vagaCompra: '/vagas/compra'"))

const pages = [
  ['web/app/convite/equipe/[token]/page.tsx', 'conviteEquipe'],
  ['web/app/convite/grupo/[token]/page.tsx', 'conviteGrupo'],
  ['web/app/convite/produtora/[token]/page.tsx', 'conviteProdutora'],
  ['web/app/equipe/entrar/[token]/page.tsx', 'equipeEntrar'],
  ['web/app/equipe/reivindicar/[token]/page.tsx', 'equipeReivindicar'],
  ['web/app/escala/[token]/page.tsx', 'escala'],
  ['web/app/i/[token]/page.tsx', 'inscricao'],
  ['web/app/vendedor/[token]/page.tsx', 'vendedor'],
  ['web/app/vendas/[token]/page.tsx', 'venda'],
  ['web/app/vagas/compra/[token]/page.tsx', 'vagaCompra'],
]

let registryCount = 0
let directSessionCount = 0
for (const [file, kind] of pages) {
  const source = read(file)
  const registry = source.includes(`tokenFlowPath('${kind}', token)`)
  if (registry) registryCount += 1
  if (source.includes('supabase.auth.getSession()')) directSessionCount += 1
  check(`${file} usa rota canônica ${kind}`, registry)
}
check('todos os 10 fluxos usam registry de retorno', registryCount === pages.length, `${registryCount}/${pages.length}`)
check('nenhum fluxo por token consulta sessão Supabase diretamente', directSessionCount === 0, `${directSessionCount} direto(s)`)

const sharedShellPages = [
  'web/app/convite/equipe/[token]/page.tsx',
  'web/app/convite/grupo/[token]/page.tsx',
  'web/app/escala/[token]/page.tsx',
  'web/app/vendas/[token]/page.tsx',
  'web/app/convite/produtora/[token]/page.tsx',
  'web/app/equipe/entrar/[token]/page.tsx',
  'web/app/equipe/reivindicar/[token]/page.tsx',
  'web/app/i/[token]/page.tsx',
  'web/app/vendedor/[token]/page.tsx',
  'web/app/vagas/compra/[token]/page.tsx',
]
const shellCount = sharedShellPages.filter((file) => read(file).includes('TokenFlowPage')).length
check('todos os fluxos usam composição compartilhada', shellCount === sharedShellPages.length, `${shellCount}/${sharedShellPages.length}`)

const gatePages = ['web/app/i/[token]/page.tsx', 'web/app/vendedor/[token]/page.tsx']
check('gates duplicados foram substituídos pelo gate compartilhado', gatePages.every((file) => read(file).includes('TokenFlowAccessGate')))
check('gates antigos não permanecem nos fluxos migrados', gatePages.every((file) => !read(file).includes('vacancies-access-gate')))

if (failed) {
  console.error(`\nFalhou: ${failed} verificação(ões).`)
  process.exit(1)
}
console.log(`\nOK: fundação R205 íntegra. ${registryCount}/${pages.length} fluxos usam registry único e 0 consultam sessão diretamente.`)
