import AsyncStorage from '@react-native-async-storage/async-storage'
import * as SecureStore from 'expo-secure-store'

const secureAvailable = SecureStore.isAvailableAsync()

export const secureStorage = {
  async getItem(key: string) {
    if (await secureAvailable) return SecureStore.getItemAsync(key)
    return AsyncStorage.getItem(key)
  },
  async setItem(key: string, value: string) {
    if (await secureAvailable) return SecureStore.setItemAsync(key, value)
    return AsyncStorage.setItem(key, value)
  },
  async removeItem(key: string) {
    if (await secureAvailable) return SecureStore.deleteItemAsync(key)
    return AsyncStorage.removeItem(key)
  },
}
