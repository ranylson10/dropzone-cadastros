import JSZip from 'jszip'
import type { CampeonatoExportPayload, ExportPacoteModo } from '../types/campeonato-export.types'

function csvEscape(value: unknown) {
  const text = value == null ? '' : String(value)
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`
  return text
}

function toCsv(rows: Array<Record<string, unknown>>) {
  if (!rows.length) return '\uFEFF'
  const headers = Object.keys(rows[0])
  const lines = [
    headers.join(','),
    ...rows.map((row) => headers.map((key) => csvEscape(row[key])).join(',')),
  ]
  return `\uFEFF${lines.join('\n')}`
}

function slugify(value: string) {
  return String(value || 'export')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
    .slice(0, 48) || 'export'
}

function buildEquipesRows(data: CampeonatoExportPayload) {
  // CSV enxuto: só nome e tag da equipe (uma linha por equipe)
  const rows: Array<Record<string, unknown>> = []
  const seen = new Set<string>()
  for (const eq of data.equipes || []) {
    if (seen.has(eq.id)) continue
    seen.add(eq.id)
    rows.push({
      nome_equipe: eq.nome || '',
      tag: eq.tag || '',
    })
  }
  return rows
}

function buildJogadoresRows(data: CampeonatoExportPayload) {
  // CSV enxuto: tag da equipe, nick, id de jogo, função, localidade
  const rows: Array<Record<string, unknown>> = []
  for (const eq of data.equipes || []) {
    const tag = eq.tag || ''
    for (const line of eq.lines || []) {
      // se a line tiver tag própria, prioriza a da line (padrão de escalação)
      const tagLine = line.tag || tag
      for (const jog of line.jogadores || []) {
        rows.push({
          tag_equipe: tagLine,
          nick: jog.nick || '',
          id_jogo: jog.id_jogo || '',
          funcao: jog.funcao || '',
          localidade: jog.localidade || '',
        })
      }
    }
  }
  return rows
}

function buildListaTxt(data: CampeonatoExportPayload) {
  const lines: string[] = []
  lines.push(`CAMPEONATO: ${data.campeonato.nome}`)
  lines.push(`Exportado em: ${data.exported_at}`)
  lines.push(`Escopo: ${data.filtro?.escopo || 'campeonato'}`)
  lines.push('')
  lines.push(`Equipes: ${data.resumo.total_equipes}`)
  lines.push(`Lines: ${data.resumo.total_lines}`)
  lines.push(`Jogadores: ${data.resumo.total_jogadores}`)
  lines.push(`Mídias: ${data.resumo.total_midias}`)
  lines.push('')
  lines.push('=== EQUIPES / LINES ===')
  for (const eq of data.equipes || []) {
    lines.push(`- ${eq.nome}${eq.tag ? ` [${eq.tag}]` : ''}`)
    for (const line of eq.lines || []) {
      const slot = line.slot?.numero != null ? `slot ${line.slot.numero}` : 'sem slot'
      const grupo = line.grupo?.nome ? `grupo ${line.grupo.nome}` : 'sem grupo'
      const fase = line.grupo?.fase_nome ? `fase ${line.grupo.fase_nome}` : ''
      lines.push(
        `    · ${line.nome} | ${slot} | ${grupo}${fase ? ` | ${fase}` : ''} | ${line.quantidade_jogadores} jogadores`,
      )
    }
  }
  lines.push('')
  lines.push('=== JOGADORES ===')
  for (const eq of data.equipes || []) {
    for (const line of eq.lines || []) {
      for (const jog of line.jogadores || []) {
        lines.push(
          `- ${jog.nick || 'sem nick'} | id ${jog.id_jogo || '-'} | ${eq.nome} / ${line.nome} | ${jog.funcao || '-'}`,
        )
      }
    }
  }
  return lines.join('\n')
}

async function fetchAsBlob(url: string): Promise<Blob | null> {
  try {
    const res = await fetch(url, { mode: 'cors', cache: 'no-store' })
    if (!res.ok) return null
    return await res.blob()
  } catch {
    // fallback no-cors não permite ler body — tenta via proxy same-origin se existir
    try {
      const res = await fetch(url, { cache: 'no-store' })
      if (!res.ok) return null
      return await res.blob()
    } catch {
      return null
    }
  }
}

export type BuildZipProgress = {
  done: number
  total: number
  label: string
}

export async function buildExportZip(
  data: CampeonatoExportPayload,
  modo: ExportPacoteModo,
  onProgress?: (p: BuildZipProgress) => void,
): Promise<{ blob: Blob; filename: string }> {
  const zip = new JSZip()
  const root = slugify(
    [
      data.campeonato.nome,
      data.filtro?.escopo !== 'campeonato' ? data.filtro?.escopo : '',
      data.filtro?.grupo_id
        ? data.estrutura.grupos.find((g) => g.id === data.filtro.grupo_id)?.nome
        : data.filtro?.fase_id
          ? data.estrutura.fases.find((f) => f.id === data.filtro.fase_id)?.nome
          : '',
    ]
      .filter(Boolean)
      .join('-'),
  )

  const folder = zip.folder(root) || zip

  if (modo === 'completo' || modo === 'tabelas') {
    const tabelas = folder.folder('tabelas')!
    tabelas.file('equipes-lines.csv', toCsv(buildEquipesRows(data)))
    tabelas.file('jogadores.csv', toCsv(buildJogadoresRows(data)))
    tabelas.file('lista.txt', buildListaTxt(data))
    tabelas.file(
      'resumo.json',
      JSON.stringify(
        {
          campeonato: data.campeonato,
          filtro: data.filtro,
          resumo: data.resumo,
          exported_at: data.exported_at,
        },
        null,
        2,
      ),
    )
  }

  if (modo === 'completo' || modo === 'midias') {
    const midias = data.midias || []
    let done = 0
    const total = midias.length
    onProgress?.({ done: 0, total, label: 'Baixando mídias...' })

    // baixa em lotes para não estourar conexões
    const batchSize = 6
    for (let i = 0; i < midias.length; i += batchSize) {
      const batch = midias.slice(i, i + batchSize)
      await Promise.all(
        batch.map(async (item) => {
          const path = item.zip_path || `midias/${item.tipo}/${slugify(item.nome)}.png`
          const blob = await fetchAsBlob(item.url)
          if (blob) {
            folder.file(path, blob)
          } else {
            // registra falha na pasta de logs
            folder.file(
              `midias/_falhas/${slugify(item.nome)}.txt`,
              `Não foi possível baixar:\n${item.url}\nTipo: ${item.tipo}\nNome: ${item.nome}`,
            )
          }
          done += 1
          onProgress?.({ done, total, label: `Mídia ${done}/${total}` })
        }),
      )
    }
  }

  // pacote JSON completo sempre no modo completo
  if (modo === 'completo') {
    folder.file('dados-completos.json', JSON.stringify(data, null, 2))
  }

  onProgress?.({ done: 1, total: 1, label: 'Gerando ZIP...' })
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' })
  const filename = `dropzone-${modo}-${root}.zip`
  return { blob, filename }
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export { toCsv, buildEquipesRows, buildJogadoresRows, buildListaTxt, slugify }
