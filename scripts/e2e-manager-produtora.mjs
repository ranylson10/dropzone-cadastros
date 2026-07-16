/**
 * E2E cuidadoso: fluxo manager ↔ produtora (estrutura, permissões, convites, token).
 * Uso:
 *   node scripts/e2e-manager-produtora.mjs
 *   E2E_BASE_URL=https://dropzone-cadastros.vercel.app node scripts/e2e-manager-produtora.mjs
 *
 * Não apaga dados de produção reais. Cria apenas:
 *  - convite de manager (cancela no final)
 *  - token de equipe (marca expirado/cancelado no final, se criado)
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

const BASE = (process.env.E2E_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://dropzone-cadastros.vercel.app').replace(/\/$/, '')
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const CAMP_ID = process.env.E2E_CAMP_ID || '84ffca8c-0e9d-46bd-91b8-71dd55933cc6'
const MANAGER_EMAIL = process.env.E2E_MANAGER_EMAIL || 'ranylson.santos@gmail.com' // six.vendas
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || 'blackxl.santos@gmail.com' // produtora SIX BLACK

const report = {
  ok: true,
  base: BASE,
  camp_id: CAMP_ID,
  started_at: new Date().toISOString(),
  steps: [],
  failures: [],
  cleanup: [],
}

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

if (!url || !serviceKey || !anonKey) {
  console.error('Missing Supabase env in web/.env.local')
  process.exit(1)
}

const sb = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })

async function sessionForEmail(email) {
  const { data, error } = await sb.auth.admin.generateLink({ type: 'magiclink', email })
  if (error) throw error
  const tokenHash = data?.properties?.hashed_token
  if (!tokenHash) throw new Error(`Sem hashed_token para ${email}`)
  const anon = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: verified, error: vErr } = await anon.auth.verifyOtp({
    type: 'email',
    token_hash: tokenHash,
  })
  if (vErr) throw vErr
  const access = verified?.session?.access_token
  if (!access) throw new Error(`Sem access_token para ${email}`)
  return { access, userId: verified.session.user.id, email }
}

async function api(path, { token, method = 'GET', body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  let json = null
  try {
    json = await res.json()
  } catch {
    json = null
  }
  return { status: res.status, ok: res.ok, json }
}

async function main() {
  // 0) schema sanity: grupos sem status
  {
    const { error } = await sb
      .from('campeonato_grupos')
      .select('id,nome,fase_id,slots,whatsapp_url,created_at')
      .eq('campeonato_id', CAMP_ID)
      .limit(1)
    assert('schema.grupos_sem_status', !error, error?.message)
    const bad = await sb
      .from('campeonato_grupos')
      .select('id,status')
      .eq('campeonato_id', CAMP_ID)
      .limit(1)
    assert(
      'schema.grupos_status_ausente',
      Boolean(bad.error),
      'esperava erro de coluna status ausente',
      { got: bad.error?.message },
    )
  }

  // 1) sessions
  let manager
  let admin
  try {
    manager = await sessionForEmail(MANAGER_EMAIL)
    step('auth.manager', { ok: true, summary: manager.email })
  } catch (e) {
    assert('auth.manager', false, e.message)
  }
  try {
    admin = await sessionForEmail(ADMIN_EMAIL)
    step('auth.admin', { ok: true, summary: admin.email })
  } catch (e) {
    assert('auth.admin', false, e.message)
  }
  if (!manager || !admin) {
    finish()
    return
  }

  // 2) estrutura (bug reportado)
  {
    const r = await api(`/api/campeonatos/${CAMP_ID}/estrutura`, { token: manager.access })
    assert(
      'manager.estrutura',
      r.ok && Array.isArray(r.json?.fases) && Array.isArray(r.json?.grupos),
      r.json?.error || `HTTP ${r.status}`,
      {
        fases: r.json?.fases?.length,
        grupos: r.json?.grupos?.length,
        slots: r.json?.resumo?.slots_total,
        role: r.json?.permission?.role,
      },
    )
  }

  // 3) listagem de equipes (manager)
  {
    const r = await api(`/api/campeonatos/${CAMP_ID}/equipes`, { token: manager.access })
    assert('manager.equipes.list', r.ok, r.json?.error || `HTTP ${r.status}`, {
      keys: r.json ? Object.keys(r.json).slice(0, 12) : [],
    })
  }

  // 4) permissões efetivas do six.vendas neste camp
  const { data: sellerRow } = await sb
    .from('campeonato_vendedores')
    .select('id,manager_id,permissoes,limite_vagas,status')
    .eq('campeonato_id', CAMP_ID)
    .eq('manager_auth_user_id', manager.userId)
    .eq('status', 'ativo')
    .maybeSingle()
  assert('manager.seller_row', Boolean(sellerRow), 'manager não está liberado no campeonato')
  const perms = sellerRow?.permissoes || {}
  step('manager.perms', {
    ok: true,
    summary: JSON.stringify(perms),
    limite: sellerRow?.limite_vagas,
  })

  // 5) gerar convite de equipe (se permitido)
  let createdTokenId = null
  if (perms.gerar_convites_equipe !== false) {
    // precisa de slot livre
    const { data: freeSlot } = await sb
      .from('campeonato_slots')
      .select('id,grupo_id,slot_letra,status')
      .eq('campeonato_id', CAMP_ID)
      .eq('status', 'livre')
      .is('line_id', null)
      .limit(1)
      .maybeSingle()

    if (!freeSlot) {
      step('manager.token.skip', { ok: true, summary: 'sem slot livre para testar token' })
    } else {
      // tenta API de convites-equipe se existir
      const r = await api(`/api/campeonatos/${CAMP_ID}/convites-equipe`, {
        token: manager.access,
        method: 'POST',
        body: {
          grupo_id: freeSlot.grupo_id,
          slot_id: freeSlot.id,
          fixar_slot: true,
          nome_equipe_reservada: 'E2E MANAGER TOKEN',
          nome_line_reservada: `LINE E2E ${Date.now()}`,
        },
      })
      if (r.ok) {
        createdTokenId = r.json?.token?.id || r.json?.convite?.id || r.json?.id || null
        // tenta achar token pelo nome se id não veio
        if (!createdTokenId) {
          const { data: tok } = await sb
            .from('tokens')
            .select('id')
            .eq('campeonato_id', CAMP_ID)
            .eq('tipo', 'convite_equipe_campeonato')
            .eq('nome_equipe_reservada', 'E2E MANAGER TOKEN')
            .eq('status', 'ativo')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()
          createdTokenId = tok?.id || null
        }
        if (createdTokenId) report.cleanup.push({ type: 'token', id: createdTokenId })
        // libera slot se ficou reservado pelo token
        if (freeSlot.id) {
          report.cleanup.push({ type: 'slot_livre', id: freeSlot.id })
        }
        assert('manager.token.create', true, null, {
          summary: `token criado ${createdTokenId || '(id n/d)'}`,
          status: r.status,
        })
      } else {
        step('manager.token.create', {
          ok: false,
          error: r.json?.error || `HTTP ${r.status}`,
          body: r.json,
        })
      }
    }
  } else {
    step('manager.token.skip', { ok: true, summary: 'sem permissão gerar_convites_equipe' })
  }

  // 6) adicionar equipe direto — deve falhar se adicionar_equipes=false
  {
    const { data: freeSlot } = await sb
      .from('campeonato_slots')
      .select('id,grupo_id')
      .eq('campeonato_id', CAMP_ID)
      .eq('status', 'livre')
      .is('line_id', null)
      .limit(1)
      .maybeSingle()
    if (freeSlot) {
      const r = await api(`/api/campeonatos/${CAMP_ID}/equipes`, {
        token: manager.access,
        method: 'POST',
        body: {
          slot_id: freeSlot.id,
          grupo_id: freeSlot.grupo_id,
          nome_line: `E2E NO ADD ${Date.now()}`,
        },
      })
      if (perms.adicionar_equipes === true) {
        // se conseguiu, limpa
        if (r.ok && r.json?.participacao?.id) {
          report.cleanup.push({ type: 'participacao', id: r.json.participacao.id })
        }
        step('manager.add_team.allowed', {
          ok: r.ok,
          error: r.ok ? undefined : r.json?.error || `HTTP ${r.status}`,
          summary: r.ok ? 'add permitido ok' : undefined,
        })
      } else {
        assert(
          'manager.add_team.blocked',
          !r.ok,
          'deveria bloquear add equipe sem permissão',
          { status: r.status, error: r.json?.error },
        )
      }
    } else {
      step('manager.add_team.skip', { ok: true, summary: 'sem slot livre' })
    }
  }

  // 7) admin lista convites de managers
  {
    const r = await api(`/api/campeonatos/${CAMP_ID}/managers/convites`, { token: admin.access })
    assert('admin.managers.convites.list', r.ok, r.json?.error || `HTTP ${r.status}`, {
      convites: r.json?.convites?.length,
      vendedores: r.json?.vendedores?.length,
    })
  }

  // 8) admin envia convite para o próprio six.vendas (deve falhar se já ativo)
  {
    const r = await api(`/api/campeonatos/${CAMP_ID}/managers/convites`, {
      token: admin.access,
      method: 'POST',
      body: {
        manager_username: 'six.vendas',
        mensagem: 'E2E convite (deve bloquear se já ativo)',
        validade_dias: 1,
        limite_vagas: 0,
        permissoes: {
          gerar_convites_equipe: true,
          ver_estrutura: true,
          adicionar_equipes: false,
        },
      },
    })
    if (sellerRow) {
      assert(
        'admin.invite.already_active_blocked',
        !r.ok,
        'convite deveria falhar para manager já liberado',
        { status: r.status, error: r.json?.error },
      )
    } else {
      step('admin.invite.create', {
        ok: r.ok,
        error: r.ok ? undefined : r.json?.error,
        summary: r.ok ? 'convite criado' : undefined,
      })
      if (r.ok && r.json?.convite?.id) {
        report.cleanup.push({ type: 'champ_invite', id: r.json.convite.id })
      }
    }
  }

  // 9) manager pede acesso de novo (deve bloquear se já ativo)
  {
    const { data: mgr } = await sb
      .from('managers')
      .select('id')
      .eq('auth_user_id', manager.userId)
      .maybeSingle()
    if (mgr?.id) {
      const r = await api(`/api/managers/${mgr.id}/campeonatos/pedidos`, {
        token: manager.access,
        method: 'POST',
        body: { campeonato_id: CAMP_ID, mensagem: 'E2E pedido duplicado' },
      })
      assert(
        'manager.pedido.already_active_blocked',
        !r.ok,
        'pedido deveria falhar se já liberado',
        { status: r.status, error: r.json?.error },
      )
    }
  }

  // 10) notificacoes do manager
  {
    const r = await api('/api/notificacoes?limit=10', { token: manager.access })
    assert('manager.notificacoes', r.ok, r.json?.error || `HTTP ${r.status}`, {
      items: r.json?.items?.length ?? r.json?.notificacoes?.length,
    })
  }

  // cleanup best-effort
  for (const item of report.cleanup) {
    try {
      if (item.type === 'token' && item.id) {
        await sb.from('tokens').update({ status: 'expirado', usado: true }).eq('id', item.id)
        step('cleanup.token', { ok: true, summary: item.id })
      }
      if (item.type === 'slot_livre' && item.id) {
        await sb
          .from('campeonato_slots')
          .update({ status: 'livre', updated_at: new Date().toISOString() })
          .eq('id', item.id)
          .eq('status', 'reservado')
          .is('line_id', null)
        step('cleanup.slot_livre', { ok: true, summary: item.id })
      }
      if (item.type === 'champ_invite' && item.id) {
        await sb
          .from('campeonato_manager_convites')
          .update({ status: 'cancelado', updated_at: new Date().toISOString() })
          .eq('id', item.id)
        step('cleanup.champ_invite', { ok: true, summary: item.id })
      }
      if (item.type === 'participacao' && item.id) {
        await sb
          .from('campeonato_equipes')
          .update({ status: 'removido', updated_at: new Date().toISOString() })
          .eq('id', item.id)
        step('cleanup.participacao', { ok: true, summary: item.id })
      }
    } catch (e) {
      step('cleanup.error', { ok: false, error: e.message, item })
    }
  }

  finish()
}

function finish() {
  report.finished_at = new Date().toISOString()
  const out = resolve('scripts/e2e-manager-produtora-report.json')
  writeFileSync(out, JSON.stringify(report, null, 2))
  console.log('\n=== RESULT ===')
  console.log(report.ok ? 'PASS' : 'FAIL')
  console.log('report:', out)
  console.log('failures:', report.failures.length)
  process.exit(report.ok ? 0 : 1)
}

main().catch((e) => {
  assert('fatal', false, e.message || String(e))
  finish()
})
