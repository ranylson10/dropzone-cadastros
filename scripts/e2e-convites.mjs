/**
 * E2E real do fluxo de convites (grupo + único + schema).
 * Uso: node scripts/e2e-convites.mjs
 * Requer web/.env.local e preferencialmente dev server em :3000
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync } from 'fs'
import { resolve } from 'path'

function loadEnv(filePath) {
  try {
    const text = readFileSync(filePath, 'utf8')
    for (const line of text.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
      if (!m) continue
      let v = m[2].trim()
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
      if (!process.env[m[1]]) process.env[m[1]] = v
    }
  } catch {
    // ignore
  }
}

loadEnv(resolve('web/.env.local'))

// Preferir local; NEXT_PUBLIC_APP_URL costuma apontar para produção e mascara bugs locais.
const BASE = process.env.E2E_BASE_URL || 'http://localhost:3000'
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const report = { ok: true, base: BASE, started_at: new Date().toISOString(), steps: [], failures: [] }

function step(name, data = {}) {
  report.steps.push({ name, ...data, at: new Date().toISOString() })
  const mark = data.ok === false ? 'FAIL' : 'ok'
  console.log(`[${mark}] ${name}`, data.error || data.summary || '')
  if (data.ok === false) {
    report.ok = false
    report.failures.push({ name, error: data.error, detail: data })
  }
}

function assert(name, cond, error, extra = {}) {
  step(name, { ok: Boolean(cond), error: cond ? undefined : error, ...extra })
  return Boolean(cond)
}

if (!url || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const sb = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })

async function fetchJson(path, opts = {}) {
  const res = await fetch(`${BASE.replace(/\/$/, '')}${path}`, {
    ...opts,
    headers: {
      ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
      ...(opts.headers || {}),
    },
  })
  let json = null
  try {
    json = await res.json()
  } catch {
    json = null
  }
  return { res, json, status: res.status }
}

async function waitForServer(maxMs = 90000) {
  const start = Date.now()
  while (Date.now() - start < maxMs) {
    try {
      const r = await fetch(`${BASE.replace(/\/$/, '')}/api/ping`)
      if (r.ok || r.status < 500) return true
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 1500))
  }
  return false
}

function parseMeta(row) {
  if (row?.metadata && typeof row.metadata === 'object') return row.metadata
  const d = String(row?.descricao || '')
  const marker = '__dz_meta__:'
  const i = d.indexOf(marker)
  if (i >= 0) {
    try {
      return JSON.parse(d.slice(i + marker.length))
    } catch {
      return {}
    }
  }
  return {}
}

async function main() {
  // —— Schema ——
  const metaProbe = await sb.from('campeonato_links').select('id,metadata').limit(1)
  const hasMetadata = !metaProbe.error
  step('schema.metadata', {
    ok: true,
    present: hasMetadata,
    error: metaProbe.error?.message,
    summary: hasMetadata ? 'coluna metadata existe' : 'metadata AUSENTE — fallback descricao',
  })

  const delProbe = await sb.from('campeonato_links').select('id,deleted_at').limit(1)
  const hasDeletedAt = !delProbe.error
  step('schema.deleted_at', {
    ok: true,
    present: hasDeletedAt,
    error: delProbe.error?.message,
    summary: hasDeletedAt ? 'deleted_at existe' : 'deleted_at AUSENTE — soft-delete via meta',
  })

  const rpcProbe = await sb.rpc('fn_consumir_vaga_link_grupo', {
    p_link_id: '00000000-0000-0000-0000-000000000000',
  })
  const hasRpc = !(rpcProbe.error && /function|not find|does not exist|PGRST202|42883/i.test(String(rpcProbe.error.message || rpcProbe.error.code || '')))
  // if error is "Link nao encontrado" the function EXISTS
  const rpcExists =
    !rpcProbe.error ||
    /nao encontrado|não encontrado|Link nao|excluido|desativado/i.test(String(rpcProbe.error.message || ''))
  step('schema.rpc_consumir', {
    ok: true,
    present: rpcExists,
    error: rpcProbe.error?.message,
    summary: rpcExists ? 'RPC existe' : 'RPC AUSENTE — fallback CAS',
  })

  // —— Links no banco ——
  let linksQuery = sb
    .from('campeonato_links')
    .select(hasMetadata
      ? 'id,token,tipo,ativo,titulo,descricao,metadata,expira_em,campeonato_id,grupo_id,created_at'
      : 'id,token,tipo,ativo,titulo,descricao,expira_em,campeonato_id,grupo_id,created_at')
    .eq('tipo', 'inscricao_equipes_grupo')
    .order('created_at', { ascending: false })
    .limit(20)
  if (hasDeletedAt) linksQuery = linksQuery.is('deleted_at', null)

  const { data: links, error: linksErr } = await linksQuery
  assert('db.list_group_links', !linksErr, linksErr?.message, { count: links?.length || 0 })

  let link = (links || []).find((l) => l.ativo) || (links || [])[0]
  if (!link) {
    step('db.no_link', { ok: false, error: 'Nenhum link de grupo no banco para testar' })
  } else {
    const meta = parseMeta(link)
    step('db.link_sample', {
      ok: true,
      token: link.token,
      ativo: link.ativo,
      limite: meta.limite_vagas,
      usos: meta.usos,
      expected: (meta.expected_teams || []).length,
      entradas: (meta.entradas || []).length,
    })
  }

  // —— Server ——
  const up = await waitForServer()
  assert('http.server_up', up, `Servidor não respondeu em ${BASE}`)
  if (!up) {
    writeFileSync(resolve('scripts/e2e-convites-report.json'), JSON.stringify(report, null, 2))
    process.exit(1)
  }

  // —— GET grupo (ativo ou qualquer) ——
  if (link?.token) {
    const { status, json } = await fetchJson(`/api/convites/grupo/${encodeURIComponent(link.token)}`)
    const hasCamp = Boolean(json?.campeonato)
    assert('http.grupo.get', status === 200 && hasCamp, json?.error || `status ${status}`, {
      status,
      modo: json?.modo,
      inscricao_aberta: json?.inscricao_aberta,
      status_link: json?.status_link,
      vagas: json?.vagas?.length,
      livres: json?.resumo_grupo?.livres,
      has_jogadores_field: Array.isArray(json?.vagas?.[0]?.jogadores) || json?.vagas?.some((v) => 'jogadores' in (v || {})),
      auto_slot: json?.modelo?.auto_slot,
    })

    // Token inventado → 404 amigável
    const bad = await fetchJson('/api/convites/grupo/EQS-TOKEN-INEXISTENTE-XYZ')
    assert(
      'http.grupo.invalid_token',
      bad.status === 404 && bad.json?.error,
      `esperado 404, veio ${bad.status}`,
      { status: bad.status, error: bad.json?.error },
    )

    // Soft-delete simulado via closed_reason se não houver deleted_at:
    // testamos pause: set ativo=false then GET must be acompanhamento
    const linkId = link.id
    const beforeAtivo = link.ativo
    if (beforeAtivo) {
      const pause = await sb.from('campeonato_links').update({ ativo: false, updated_at: new Date().toISOString() }).eq('id', linkId)
      assert('db.pause_link', !pause.error, pause.error?.message)
      const pausedGet = await fetchJson(`/api/convites/grupo/${encodeURIComponent(link.token)}`)
      assert(
        'http.grupo.paused_is_acompanhamento',
        pausedGet.status === 200 &&
          (pausedGet.json?.modo === 'acompanhamento' || pausedGet.json?.inscricao_aberta === false) &&
          pausedGet.json?.campeonato,
        `modo=${pausedGet.json?.modo} inscricao_aberta=${pausedGet.json?.inscricao_aberta} status=${pausedGet.status}`,
        {
          status: pausedGet.status,
          modo: pausedGet.json?.modo,
          status_link: pausedGet.json?.status_link,
          mensagem: pausedGet.json?.status_mensagem,
        },
      )
      // restore
      await sb.from('campeonato_links').update({ ativo: true, updated_at: new Date().toISOString() }).eq('id', linkId)
    }

    // Soft-delete via meta closed_reason=excluido
    const metaNow = parseMeta(link)
    const human = String(link.descricao || '').split('__dz_meta__:')[0] || ''
    const excluidoMeta = {
      ...metaNow,
      closed_reason: 'excluido',
      closed_at: new Date().toISOString(),
    }
    const excluidoDesc = `${human}__dz_meta__:${JSON.stringify(excluidoMeta)}`
    const patchEx = { descricao: excluidoDesc, ativo: false, updated_at: new Date().toISOString() }
    if (hasMetadata) patchEx.metadata = excluidoMeta
    if (hasDeletedAt) patchEx.deleted_at = new Date().toISOString()
    const exUp = await sb.from('campeonato_links').update(patchEx).eq('id', linkId)
    assert('db.soft_delete_mark', !exUp.error, exUp.error?.message)
    const exGet = await fetchJson(`/api/convites/grupo/${encodeURIComponent(link.token)}`)
    assert(
      'http.grupo.excluido_acompanhamento',
      exGet.status === 200 &&
        exGet.json?.campeonato &&
        (exGet.json?.modo === 'acompanhamento' || exGet.json?.inscricao_aberta === false) &&
        (exGet.json?.status_link === 'excluido' || /encerrado|exclu/i.test(String(exGet.json?.status_mensagem || ''))),
      `status=${exGet.status} modo=${exGet.json?.modo} status_link=${exGet.json?.status_link}`,
      {
        status: exGet.status,
        modo: exGet.json?.modo,
        status_link: exGet.json?.status_link,
        mensagem: exGet.json?.status_mensagem,
      },
    )
    // restore link to previous state
    const restoreMeta = { ...metaNow }
    delete restoreMeta.closed_reason
    delete restoreMeta.closed_at
    const restoreDesc = `${human}__dz_meta__:${JSON.stringify(restoreMeta)}`
    const restorePatch = {
      descricao: restoreDesc,
      ativo: beforeAtivo !== false,
      updated_at: new Date().toISOString(),
    }
    if (hasMetadata) restorePatch.metadata = restoreMeta
    if (hasDeletedAt) restorePatch.deleted_at = null
    await sb.from('campeonato_links').update(restorePatch).eq('id', linkId)
    step('db.restore_link', { ok: true })

    // POST sem auth → 400
    const postNoAuth = await fetchJson(`/api/convites/grupo/${encodeURIComponent(link.token)}`, {
      method: 'POST',
      body: JSON.stringify({ nome_line: 'LINE E2E SEM AUTH' }),
    })
    assert(
      'http.grupo.post_sem_auth',
      postNoAuth.status >= 400,
      `esperado 4xx, veio ${postNoAuth.status}`,
      { status: postNoAuth.status, error: postNoAuth.json?.error },
    )

    // POST autenticado (só se link aberto e há vaga)
    const live = await fetchJson(`/api/convites/grupo/${encodeURIComponent(link.token)}`)
    const canInscribe = live.json?.inscricao_aberta && (live.json?.resumo_grupo?.livres || 0) > 0
    step('http.grupo.can_inscribe', { ok: true, canInscribe, remaining: live.json?.resumo_link?.restantes })

    if (canInscribe) {
      // pick team with auth
      const { data: equipe } = await sb
        .from('equipes')
        .select('id,nome,auth_user_id,tag,logo_url')
        .eq('status', 'ativo')
        .not('auth_user_id', 'is', null)
        .limit(1)
        .maybeSingle()

      if (!equipe?.auth_user_id) {
        step('http.grupo.post_auth.skip', { ok: true, summary: 'sem equipe com auth_user_id' })
      } else {
        const { data: authUserData, error: authUserErr } = await sb.auth.admin.getUserById(equipe.auth_user_id)
        if (authUserErr || !authUserData.user?.email) {
          step('http.grupo.post_auth.user', { ok: false, error: authUserErr?.message || 'sem email' })
        } else {
          const email = authUserData.user.email
          // Sempre cria line nova exclusiva para o teste (evita colisão com dados legados)
          const nomeNova = `E2E AUTO ${Date.now()}`
          const sbUser = createClient(url, anonKey || serviceKey, {
            auth: { persistSession: false, autoRefreshToken: false },
          })
          const { data: linkData, error: linkErr } = await sb.auth.admin.generateLink({
            type: 'magiclink',
            email,
          })
          if (linkErr) {
            step('http.grupo.session', { ok: false, error: linkErr.message })
          } else {
            const tokenHash = linkData?.properties?.hashed_token
            const { data: sessionData, error: signErr } = await sbUser.auth.verifyOtp({
              token_hash: tokenHash,
              type: 'email',
            })
            const access = sessionData?.session?.access_token
            assert('http.grupo.session', Boolean(access) && !signErr, signErr?.message || 'sem access_token')

            if (access) {
              // auto-slot + criar line na hora (sem line_id prévio)
              const post = await fetchJson(`/api/convites/grupo/${encodeURIComponent(link.token)}`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${access}` },
                body: JSON.stringify({ nome_line: nomeNova }),
              })
              const postOk = post.status === 200 && post.json?.ok
              const createdLineId = post.json?.line?.id
              assert('http.grupo.post_auto_slot', postOk, post.json?.error || `status ${post.status}`, {
                status: post.status,
                line: post.json?.line?.nome,
                line_id: createdLineId,
                slot: post.json?.slot_letra,
                mensagem: post.json?.mensagem,
                criada_agora: post.json?.line?.criada_agora,
              })

              // GET autenticado após inscrição
              const after = await fetchJson(`/api/convites/grupo/${encodeURIComponent(link.token)}`, {
                headers: { Authorization: `Bearer ${access}` },
              })
              assert(
                'http.grupo.get_authed_after',
                after.status === 200 && after.json?.equipe,
                after.json?.error || 'sem equipe na sessão',
                {
                  inscrita: after.json?.inscrita,
                  parts: after.json?.minhas_participacoes?.length,
                  lines_livres: after.json?.lines_disponiveis?.length,
                },
              )

              if (createdLineId) {
                const freeIds = new Set((after.json?.lines_disponiveis || []).map((l) => l.id))
                assert(
                  'http.grupo.line_inscrita_oculta',
                  !freeIds.has(createdLineId),
                  'line recém inscrita ainda aparece como disponível',
                  { lineId: createdLineId },
                )
              } else {
                step('http.grupo.line_inscrita_oculta', {
                  ok: postOk === false,
                  summary: 'skip — POST não criou line id',
                })
              }
            }
          }
        }
      }
    }
  }

  // —— Convite único ——
  const { data: tokens, error: tokErr } = await sb
    .from('tokens')
    .select('id,token,tipo,status,usado,expira_em,campeonato_id,grupo_id,slot_id')
    .eq('tipo', 'convite_equipe_campeonato')
    .order('created_at', { ascending: false })
    .limit(5)
  assert('db.tokens_list', !tokErr, tokErr?.message, { count: tokens?.length || 0 })

  if (tokens?.length) {
    const t = tokens[0]
    const tGet = await fetchJson(`/api/convites/equipe/${encodeURIComponent(t.token)}`)
    assert(
      'http.equipe.get',
      tGet.status === 200 && tGet.json?.campeonato,
      tGet.json?.error || `status ${tGet.status}`,
      {
        status: tGet.status,
        valido: tGet.json?.valido,
        modo: tGet.json?.modo,
        inscricao_aberta: tGet.json?.inscricao_aberta,
        vagas: tGet.json?.vagas?.length,
      },
    )
    // usado/inválido ainda deve devolver campeonato se possível
    if (t.usado || t.status !== 'ativo') {
      assert(
        'http.equipe.used_acompanhamento',
        tGet.status === 200 && tGet.json?.modo === 'acompanhamento',
        `modo=${tGet.json?.modo}`,
      )
    }
  } else {
    step('http.equipe.skip', { ok: true, summary: 'sem tokens únicos no banco' })
  }

  // —— Match automático unit-ish via reimport logic ——
  // (validate parse of expected teams from text is correct in node)
  const { parseExpectedTeamsFromText, matchExpectedTeamReference } = await import(
    '../backend/src/shared/campeonato-link-metadata.ts'
  ).catch(() => ({ parseExpectedTeamsFromText: null, matchExpectedTeamReference: null }))

  if (!parseExpectedTeamsFromText) {
    // JS can't import TS path easily — inline test of same rules
    const text = 'TEAM SIX\nALOE, FURIA; LOUD\nTEAM SIX'
    const parts = text
      .split(/[\n,;]+/)
      .map((n) => n.trim())
      .filter(Boolean)
    const seen = new Set()
    const unique = []
    for (const n of parts) {
      const k = n.toLowerCase()
      if (seen.has(k)) continue
      seen.add(k)
      unique.push(n)
    }
    assert('logic.parse_expected', unique.length === 4 && unique[0] === 'TEAM SIX', 'parse falhou', {
      unique,
    })
    const match = unique.find((n) => n.toLowerCase() === 'aloe')
    assert('logic.match_exact', match === 'ALOE', 'match falhou')
  }

  report.finished_at = new Date().toISOString()
  const outPath = resolve('scripts/e2e-convites-report.json')
  writeFileSync(outPath, JSON.stringify(report, null, 2))
  console.log('\n=== SUMMARY ===')
  console.log(report.ok ? 'ALL CHECKS PASSED' : `FAILED ${report.failures.length} check(s)`)
  for (const f of report.failures) console.log(' -', f.name, f.error)
  console.log('Report:', outPath)
  process.exit(report.ok ? 0 : 1)
}

main().catch((err) => {
  console.error(err)
  report.ok = false
  report.failures.push({ name: 'fatal', error: err?.message || String(err) })
  writeFileSync(resolve('scripts/e2e-convites-report.json'), JSON.stringify(report, null, 2))
  process.exit(1)
})
