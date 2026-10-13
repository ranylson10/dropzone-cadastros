import fs from 'node:fs'
import path from 'node:path'
import { hasResponsiveCss } from './lib/project-source.mjs'

const root = process.cwd()
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8')
const checks = []
const ok = (label, condition) => checks.push({ label, condition: Boolean(condition) })

const cardComponent = read('web/components/championship/ChampionshipCard.tsx')
const listComponent = read('web/components/championship/ChampionshipListRow.tsx')
const sharedCss = read('web/styles/championship-card.css')
const directoryCss = read('web/features/directory/components/championship-directory.css')
const layout = read('web/app/layout.tsx')
const home = read('web/features/home/AuthenticatedHomeFeed.tsx')
const directory = read('web/features/directory/components/DirectoryListClient.tsx')
const vacancy = read('web/features/vacancies/VacancyCard.tsx')
const vacanciesPage = read('web/app/vagas/page.tsx')
const seller = read('web/app/vendedores/[managerId]/page.tsx')

ok('componente ChampionshipCard existe para contexto de card', cardComponent.includes('export function ChampionshipCard'))
ok('componente ChampionshipListRow existe para contexto de lista', listComponent.includes('export function ChampionshipListRow'))
ok('modelo compartilhado de card existe', cardComponent.includes('export type ChampionshipCardModel'))
ok('modelo compartilhado de lista existe', listComponent.includes('export type ChampionshipListRowModel'))
ok('CSS do card continua carregado globalmente', layout.includes("@/styles/championship-card.css"))
ok('arte do card usa tamanho natural', sharedCss.includes('.dz-champ-card-art>img') && sharedCss.includes('height:auto'))
ok('Home continua usando ChampionshipCard', home.includes('<ChampionshipCard'))
ok('/campeonatos usa ChampionshipListRow', directory.includes('<ChampionshipListRow'))
ok('/campeonatos não usa ChampionshipCard', !directory.includes('<ChampionshipCard'))
ok('lista de campeonatos possui raiz canônica', listComponent.includes('data-championship-list-row'))
ok('CSS da lista possui layout desktop e mobile', directoryCss.includes('.dz-champ-list-row') && hasResponsiveCss(directoryCss, '.dz-champ-list-row'))
ok('/vagas redireciona para /campeonatos com filtro de vagas', vacanciesPage.includes("redirect(`/campeonatos?") && vacanciesPage.includes("params.set('vagas', '1')"))
ok('VacancyCard permanece como adapter para contextos comerciais específicos', vacancy.includes('<ChampionshipCard'))
ok('/vendedores herda o card via VacancyCard', seller.includes('<VacancyCard'))
ok('Home não renderiza card legado', !home.includes('championship-poster-card'))

console.log('Auditoria R197/R208 — campeonato por contexto: card + lista')
for (const check of checks) console.log(`${check.condition ? 'OK ' : 'ERRO'} ${check.label}`)
const failed = checks.filter((check) => !check.condition)
if (failed.length) {
  console.error(`ERRO: ${failed.length} verificação(ões) falharam.`)
  process.exit(1)
}
console.log(`OK: ${checks.length}/${checks.length} verificações passaram.`)
