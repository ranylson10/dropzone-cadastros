import type { StreamOverlay } from '../types/stream.types'

/** Snapshot JSON da overlay para vMix / integração. */
export function buildOverlayExportPayload(overlay: StreamOverlay, campeonatoId: string) {
  return {
    version: 2,
    campeonatoId,
    exportedAt: new Date().toISOString(),
    overlay: {
      id: overlay.id,
      name: overlay.name,
      template: overlay.template,
      blocks: overlay.blocks,
      share_token: overlay.share_token || null,
    },
    liveUrl: overlay.share_token ? `/stream/live/${overlay.share_token}` : null,
    notes: {
      browserSourcePreferLive: 'Prefira a URL /stream/live/[token] no vMix (dados ao vivo).',
      cellRefs: 'Planilha: Equipes!B2, Classificacao!F2, MVP!C2, Quedas!C2…',
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

/**
 * HTML para Browser Source.
 * Se houver share_token: redireciona/carrega a página live (melhor fidelidade).
 * Senão: snapshot embutido com nota de estrutura.
 */
export function buildOverlayBrowserHtml(
  overlay: StreamOverlay,
  options?: { origin?: string; previewNote?: string },
) {
  const origin = (options?.origin || '').replace(/\/$/, '')
  const note = options?.previewNote || 'DropZone Stream'
  const token = overlay.share_token

  if (token) {
    const livePath = `${origin}/stream/live/${token}`
    return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(overlay.name)} · DropZone Live</title>
  <meta http-equiv="refresh" content="0;url=${livePath}" />
  <style>
    html, body { margin: 0; background: transparent; font-family: Rajdhani, Segoe UI, Arial, sans-serif; color: #fff; }
    a { color: #e8c547; }
    .box { padding: 20px; }
  </style>
</head>
<body>
  <div class="box">
    <p>${escapeHtml(note)}</p>
    <p>Abrindo Browser Source live…</p>
    <p><a href="${livePath}">${livePath}</a></p>
    <script>location.replace(${JSON.stringify(livePath)});</script>
  </div>
</body>
</html>`
  }

  // Fallback sem token: documento estático com blocos (sem dados ao vivo)
  const safe = JSON.stringify({
    name: overlay.name,
    template: overlay.template,
    blocks: (overlay.blocks || []).map((b) => ({
      id: b.id,
      type: b.type,
      name: b.name,
      data: b.data,
      box: b.box,
    })),
  })

  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(overlay.name)} · DropZone Stream</title>
  <style>
    html, body { margin: 0; background: transparent; font-family: Rajdhani, Segoe UI, Arial, sans-serif; color: #fff; }
    .wrap { padding: 16px; max-width: 960px; }
    h1 { margin: 0 0 8px; font-size: 22px; letter-spacing: .06em; text-transform: uppercase; color: #e8c547; }
    p { margin: 0 0 12px; opacity: .85; font-size: 13px; }
    .stage { display: flex; flex-wrap: wrap; gap: 12px; }
    .card, .table { min-width: 180px; border: 2px solid #c9a227; border-radius: 6px; overflow: hidden; background: #1a1208; }
    .card { display: grid; grid-template-rows: 100px auto auto; flex: 1; }
    .card .art { display: grid; place-items: center; background: #111; }
    .card .title { padding: 8px; text-align: center; background: #e8c547; color: #c62828; font-weight: 900; }
    .card .metrics { display: grid; grid-template-columns: 1fr 1fr; }
    .card .metrics span { padding: 8px; text-align: center; background: #c62828; font-weight: 800; font-size: 13px; }
    .table { flex: 2; min-width: 280px; }
    .row { display: grid; grid-template-columns: 40px 1fr 48px 48px; gap: 6px; padding: 8px; border-bottom: 1px solid rgba(255,255,255,.08); font-size: 13px; font-weight: 700; }
    .row.head { background: #e8c547; color: #1a1208; text-transform: uppercase; font-size: 11px; }
    .warn { color: #f5e6a8; font-size: 12px; }
  </style>
</head>
<body>
  <div class="wrap">
    <h1 id="title"></h1>
    <p class="warn">Sem share_token — salve no servidor (SQL stream) para HTML live com dados reais.</p>
    <p id="note"></p>
    <div class="stage" id="stage"></div>
  </div>
  <script>
    const data = ${safe};
    document.getElementById('title').textContent = data.name || 'Overlay';
    document.getElementById('note').textContent = ${JSON.stringify(note)};
    const stage = document.getElementById('stage');
    for (const block of data.blocks || []) {
      if (block.type === 'card') {
        const el = document.createElement('div');
        el.className = 'card';
        el.innerHTML = '<div class="art">DZ</div><div class="title"></div><div class="metrics"><span>0 PTS</span><span>0 ABT</span></div>';
        el.querySelector('.title').textContent = (block.data && block.data.titleFixed) || block.name || 'Card';
        stage.appendChild(el);
      } else {
        const el = document.createElement('div');
        el.className = 'table';
        el.innerHTML = '<div class="row head"><span>#</span><span>Nome</span><span>ABT</span><span>PTS</span></div>';
        for (let i = 1; i <= Math.min(8, (block.data && block.data.rows) || 8); i++) {
          const r = document.createElement('div');
          r.className = 'row';
          r.innerHTML = '<span>' + String(i).padStart(2,'0') + '</span><span>—</span><span>0</span><span>0</span>';
          el.appendChild(r);
        }
        stage.appendChild(el);
      }
    }
  </script>
</body>
</html>`
}

function escapeHtml(value: string) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
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
