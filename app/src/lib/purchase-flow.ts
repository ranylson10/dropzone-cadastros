import AsyncStorage from '@react-native-async-storage/async-storage'
import { VacancyPaymentResult } from '@/lib/payments'
import { ChampionshipCard } from '@/types/dropzone'

const KEY = 'dropzone:mobile:pending-vacancy-purchase:v1'

export type PendingVacancyPurchase = {
  championship: ChampionshipCard
  payment: VacancyPaymentResult
  createdAt: string
}

export async function savePendingVacancyPurchase(championship: ChampionshipCard, payment: VacancyPaymentResult) {
  const payload: PendingVacancyPurchase = {
    championship,
    payment,
    createdAt: new Date().toISOString(),
  }
  await AsyncStorage.setItem(KEY, JSON.stringify(payload))
  return payload
}

export async function getPendingVacancyPurchase(): Promise<PendingVacancyPurchase | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed?.championship?.id || !parsed?.payment?.compra?.token) return null
    return parsed as PendingVacancyPurchase
  } catch {
    return null
  }
}

export async function clearPendingVacancyPurchase() {
  await AsyncStorage.removeItem(KEY)
}
