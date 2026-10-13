import { createSlotMovementAttempts } from '@backend/campeonatos/slot-movement-attempt'
export const slotMovementAttempts = createSlotMovementAttempts({
  get: async key => sessionStorage.getItem(key), set: async (key, value) => { sessionStorage.setItem(key, value) }, remove: async key => { sessionStorage.removeItem(key) },
  uuid: () => crypto.randomUUID(), hash: async value => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))].map(n => n.toString(16).padStart(2, '0')).join(''),
})
