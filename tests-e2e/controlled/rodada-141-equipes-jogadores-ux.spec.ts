import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8')

const team = read('web/features/dropzone/panels/equipe/EquipePanel.tsx')
const player = read('web/features/dropzone/panels/jogador/JogadorPanel.tsx')
const request = read('web/components/equipes/PlayerTeamRequest.tsx')
const styles = read('web/app/globals.css')

test.describe('Rodada 141 — Equipes e Jogadores com hierarquia simples', () => {
  test('equipe reduz navegação principal para cinco áreas', () => {
    expect(team).toContain('aria-label="Áreas da equipe"')
    expect(team).toContain('>Início</button>')
    expect(team).toContain('>Elenco</button>')
    expect(team).toContain('>Competições</button>')
    expect(team).toContain('>Desempenho</button>')
    expect(team).toContain('>Mais</button>')
  })

  test('ferramentas de elenco ficam em navegação contextual', () => {
    expect(team).toContain('aria-label="Ferramentas de elenco"')
    expect(team).toContain('>Jogadores</button>')
    expect(team).toContain('>Lines</button>')
    expect(team).toContain('>Convites</button>')
  })

  test('staff e configurações deixam o primeiro nível', () => {
    expect(team).toContain('aria-label="Mais opções da equipe"')
    expect(team).toContain('showStaffTools ? <button type="button"')
    expect(team).toContain('>Configurações</button>')
  })

  test('início da equipe prioriza agenda elenco e descoberta de competição', () => {
    expect(team).toContain('aria-label="Acesso rápido da equipe"')
    expect(team).toContain('href="/agenda"')
    expect(team).toContain('Gerenciar elenco')
    expect(team).toContain('href="/campeonatos?vagas=1"')
  })

  test('jogador passa a ter área própria de equipe', () => {
    expect(player).toContain("'resumo' | 'competicoes' | 'equipe' | 'desempenho' | 'perfil'")
    expect(player).toContain('aria-label="Áreas do jogador"')
    expect(player).toContain("onClick={() => setTab('equipe')}>Equipe</button>")
  })

  test('início do jogador mostra só ações prioritárias e próximo passo', () => {
    expect(player).toContain('aria-label="Acesso rápido do jogador"')
    expect(player).toContain('Minha agenda')
    expect(player).toContain('Minhas competições')
    expect(player).toContain('Próximo passo: entre em uma equipe')
  })

  test('equipe lines e token de escalação ficam juntos no contexto Equipe', () => {
    expect(player).toContain("{tab === 'equipe' ? <>")
    expect(player).toContain('className="panel span-2 player-team-workspace"')
    expect(player).toContain('Usar token de escalação')
    expect(player).toContain('<PlayerTeamRequest mode="request_join"/>')
  })

  test('busca de equipe e jogador acontece automaticamente com debounce', () => {
    expect(request).toContain('useEffect, useRef, useState')
    expect(request).toContain('window.setTimeout(() => void search(value), 420)')
    expect(request).toContain('Digite ao menos 2 caracteres. A busca acontece automaticamente')
    expect(request).toContain('searchGeneration.current')
  })

  test('mobile transforma atalhos em uma coluna', () => {
    expect(styles).toContain('body .team-start-actions,body .player-start-actions{grid-template-columns:1fr}')
    expect(styles).toContain('body .team-primary-nav{grid-template-columns:repeat(5,minmax(74px,1fr));overflow-x:auto}')
  })
})
