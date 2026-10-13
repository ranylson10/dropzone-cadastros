import * as Crypto from 'expo-crypto'
import { secureStorage } from './secureStorage'
import { createOperationAttempts } from '../../../backend/src/shared/operation-attempt'
import { lifecycleIntent } from '../../../backend/src/campeonatos/lifecycle-contract'

/** Only the original intent, opaque fence and UUID are persisted; never bearer credentials. */
export const mobileLifecycleAttempts = createOperationAttempts('lifecycle', 'confirmação de encerramento', lifecycleIntent, {
  get: key => secureStorage.getItem(key),
  set: (key, value) => secureStorage.setItem(key, value),
  remove: key => secureStorage.removeItem(key),
  hash: value => Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, value),
  uuid: () => Crypto.randomUUID(),
})
