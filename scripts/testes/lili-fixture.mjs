import { fixtureLoader } from './ts-fixture-loader.mjs'

export function liliFixture() {
  const state = { user: null, databaseWrites: [], paymentCalls: [], reads: [] }
  const accounts = [{ id: 'team-own', profile_type: 'equipe', auth_user_id: 'user-own', name: 'Equipe', data: {} }]
  const database = { from(table) {
    let single = false
    const query = {}
    for (const method of ['select', 'eq', 'neq', 'is', 'in', 'order', 'limit', 'range', 'ilike', 'or', 'gte', 'lte', 'not']) query[method] = () => query
    for (const method of ['maybeSingle', 'single']) query[method] = () => { single = true; return query }
    for (const method of ['insert', 'update', 'delete', 'upsert']) query[method] = () => { state.databaseWrites.push({ table, method }); return query }
    query.then = (resolve, reject) => Promise.resolve({ data: single ? null : [], error: null }).then(value => { state.reads.push(table); return value }).then(resolve, reject)
    return query
  } }
  const payment = (...methods) => Object.fromEntries(methods.map(method => [method, async () => { state.paymentCalls.push(method); throw new Error(`Operação indisponível na fixture: ${method}`) }]))
  class AsaasNotConfiguredError extends Error {}
  const overrides = {
    '@backend/auth/server-auth': {
      getBearerUser: async () => { if (!state.user) throw new Error('Sessao ausente.'); return state.user },
      getAccountsForUser: async () => accounts, getAccountsByUserId: async () => accounts,
      getActiveAccount: async () => { if (!state.user) throw new Error('Sessao ausente.'); return accounts[0] },
    },
    '@backend/shared/supabase-admin': { supabaseAdmin: database },
    '@backend/equipes/manager-team-access': { listControllableEquipes: async () => [] },
    '@backend/campeonatos/rulebook': { getPublishedRulebook: async () => null, getRulebook: async () => null },
    '@backend/campeonatos/campeonato-permissions': { getCampeonatoPermission: async () => null },
    '@backend/agenda/agenda.service': { listAgenda: async () => [] },
    '@backend/billing/asaas': { AsaasNotConfiguredError, isPaidStatus: () => false },
    '@backend/billing/lili-slot-reservation': payment('reserveSlotForLili', 'confirmLiliReservation'),
    '@backend/billing/lili-payment': payment('createLiliAsaasPayment', 'getLiliPaymentStatus'),
    '@backend/billing/paypal': { ...payment('captureLiliPayPalOrder', 'captureVacancyPayPalOrder', 'createLiliPayPalOrder', 'getLiliPayPalPaymentStatus', 'getVacancyPayPalPaymentStatus'), paypalConfigured: () => false },
    '@backend/billing/vacancy-purchase': payment('cancelPendingVacancyPurchase', 'claimVacancyPurchase', 'createVacancyPurchase', 'loadClaimContext', 'listVacancyFinancialReviews', 'resolveVacancyFinancialReview'),
    '@backend/billing/currency': { createInternationalQuote: async () => { throw new Error('Cotação indisponível na fixture.') }, formatMoney: value => String(value) },
    '@/features/lili/currency': { createInternationalQuote: async () => { throw new Error('Cotação indisponível na fixture.') }, formatMoney: value => String(value) },
  }
  return { state, overrides, load: fixtureLoader(overrides) }
}
