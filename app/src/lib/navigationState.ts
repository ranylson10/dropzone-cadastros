import AsyncStorage from '@react-native-async-storage/async-storage'
import { ChampionshipCard, MobileRoute } from '@/types/dropzone'

const KEY='dropzone.mobile.navigation.v1'

const RESTORABLE_ROUTES=new Set<MobileRoute>([
  'home',
  'search',
  'vacancies',
  'championship_public',
  'team_directory',
  'team_public',
  'player_directory',
  'player_public',
  'rank',
])

export type PersistedNavigationState={
  route:MobileRoute
  championship?:ChampionshipCard|null
  teamId?:string|null
  playerId?:string|null
}

export function isRestorableRoute(route:MobileRoute){
  return RESTORABLE_ROUTES.has(route)
}

export async function loadNavigationState():Promise<PersistedNavigationState|null>{
  try{
    const raw=await AsyncStorage.getItem(KEY)
    if(!raw)return null
    const parsed=JSON.parse(raw) as PersistedNavigationState
    if(!parsed?.route||!isRestorableRoute(parsed.route))return null
    if(parsed.route==='championship_public'&&!parsed.championship?.id)return null
    if(parsed.route==='team_public'&&!parsed.teamId)return null
    if(parsed.route==='player_public'&&!parsed.playerId)return null
    return parsed
  }catch{return null}
}

export async function saveNavigationState(state:PersistedNavigationState){
  if(!isRestorableRoute(state.route))return
  try{await AsyncStorage.setItem(KEY,JSON.stringify(state))}catch{}
}

export async function clearNavigationState(){
  try{await AsyncStorage.removeItem(KEY)}catch{}
}
