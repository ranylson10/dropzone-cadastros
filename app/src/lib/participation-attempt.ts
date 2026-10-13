import * as Crypto from 'expo-crypto'
import { secureStorage } from './secureStorage'
import { createParticipationAttempts } from '../../../backend/src/campeonatos/participation-attempt'
export const participationAttempts = createParticipationAttempts({
  get: key => secureStorage.getItem(key), set: (key, value) => secureStorage.setItem(key, value), remove: key => secureStorage.removeItem(key),
  hash: value => Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, value), uuid: () => Crypto.randomUUID(),
})
