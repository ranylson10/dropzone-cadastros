import type { StreamOverlay } from '../types/stream.types'

/** Snapshot JSON da overlay para vMix / integração. */
export function buildOverlayExportPayload(overlay: StreamOverlay, campeonatoId: string) {
  return {
    version: 1,
    campeonatoId,
    exportedAt: new Date().toISOString(),
    overlay: {
      id: overlay.id,
      name: overlay.name,
      template: overlay.template,
      blocks: overlay.blocks,
    },
    notes: {
      cellRefs: 'Use planilha DropZone (Equipes!B2, Classificacao!F2, MVP!C2, Quedas!C1…)',
      browserSource: 'Importe o HTML exportado no vMix Browser Source',
    },
  }
}

export function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/** HTML simples para Browser Source (preview estático do JSON embutido). */
export function buildOverlayBrowserHtml(overlay: StreamOverlay, previewNote: string) {
  const safe = JSON.stringify({
    name: overlay.name,
    template: overlay.template,
    blocks: overlay.blocks.map((b) => ({
      id: b.id,
      type: b.type,
      name: b.name,
      data: b.data,
    })),
  })
  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>${overlay.name.replace(/</g, '')} · DropZone Stream</title>
  <style>
    html, body { margin: 0; background: transparent; font-family: Rajdhani, Segoe UI, Arial, sans-serif; color: #fff; }
    .wrap { padding: 16px; }
    h1 { margin: 0 0 8px; font-size: 22px; letter-spacing: .06em; text-transform: uppercase; color: #e8c547; }
    p { margin: 0 0 12px; opacity: .8; font-size: 13px; }
    .block { margin-bottom: 10px; padding: 10px 12px; border: 1px solid rgba(201,162,39,.45); background: rgba(18,20,28,.72); border-radius: 6px; }
    .block b { display: block; font-size: 11px; letter-spacing: .08em; text-transform: uppercase; color: #c9a227; }
    .block span { font-size: 14px; }
  </style>
</head>
<body>
  <div class="wrap">
    <h1 id="title"></h1>
    <p id="note"></p>
    <div id="blocks"></div>
  </div>
  <script>
    const data = ${safe};
    document.getElementById('title').textContent = data.name || 'Overlay';
    document.getElementById('note').textContent = ${JSON.stringify(previewNote)};
    const root = document.getElementById('blocks');
    for (const block of data.blocks || []) {
      const el = document.createElement('div');
      el.className = 'block';
      el.innerHTML = '<b>' + (block.type === 'card' ? 'CARD' : 'TABELA') + '</b><span>' + (block.name || block.id) + '</span>';
      root.appendChild(el);
    }
  </script>
</body>
</html>`
}

export function downloadHtml(filename: string, html: string) {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
