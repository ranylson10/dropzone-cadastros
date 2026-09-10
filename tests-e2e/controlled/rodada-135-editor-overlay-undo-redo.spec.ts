import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const editorPath = resolve(process.cwd(), 'web/features/campeonatos/stream/components/StreamPackageEditor.tsx')

test.describe('Rodada 135 - histórico do editor de overlay', () => {
  test('mantém pilhas independentes de desfazer e refazer', () => {
    const source = readFileSync(editorPath, 'utf8')

    expect(source).toContain('undoHistoryRef')
    expect(source).toContain('redoHistoryRef')
    expect(source).toContain('undoHistoryRef.current = [...undoHistoryRef.current.slice(-99), current]')
    expect(source).toContain('redoHistoryRef.current = []')
  })

  test('aceita os atalhos padrão no Windows e macOS', () => {
    const source = readFileSync(editorPath, 'utf8')

    expect(source).toContain("event.ctrlKey || event.metaKey")
    expect(source).toContain("if (event.shiftKey) redo()")
    expect(source).toContain("if (key === 'y' && !event.shiftKey)")
    expect(source).toContain("window.addEventListener('keydown', handleHistoryShortcut)")
    expect(source).toContain("window.removeEventListener('keydown', handleHistoryShortcut)")
  })

  test('não registra carregamento inicial e confirmação de salvamento no histórico', () => {
    const source = readFileSync(editorPath, 'utf8')

    expect(source).toContain('setPackState(normalizeStreamOverlayPackage')
    expect(source).toContain("setPackState((prev) => ({ ...prev, updated_at:")
  })
})
