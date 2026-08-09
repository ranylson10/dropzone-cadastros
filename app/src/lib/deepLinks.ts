export type MobileDeepLink =
  | { kind:'ignore' }
  | { kind:'route'; route:'home'|'search'|'vacancies'|'rank' }
  | { kind:'championship'; id:string }
  | { kind:'team'; id:string }
  | { kind:'player'; id:string }
  | { kind:'token'; token:string }

const HOSTS=new Set(['dropzone-cadastros.vercel.app','www.dropzone-cadastros.vercel.app'])
const TOKEN_PREFIXES=[
  ['convite','equipe'],
  ['convite','grupo'],
  ['escala'],
  ['i'],
  ['equipe','entrar'],
  ['vendedor'],
]

function clean(value:string|undefined|null){
  try{return decodeURIComponent(String(value||'')).trim()}catch{return String(value||'').trim()}
}

function partsFromUrl(raw:string){
  const url=String(raw||'').trim()
  if(!url)return {scheme:'',host:'',parts:[] as string[]}

  try{
    const parsed=new URL(url)
    const scheme=parsed.protocol.replace(':','').toLowerCase()
    const host=parsed.hostname.toLowerCase()

    if(scheme==='dropzone'){
      const hostPart=clean(parsed.hostname)
      const pathParts=parsed.pathname.split('/').filter(Boolean).map(clean)
      return {scheme,host:'',parts:[hostPart,...pathParts].filter(Boolean)}
    }

    return {
      scheme,
      host,
      parts:parsed.pathname.split('/').filter(Boolean).map(clean),
    }
  }catch{
    return {scheme:'',host:'',parts:url.split(/[?#]/)[0].split('/').filter(Boolean).map(clean)}
  }
}

export function parseMobileDeepLink(raw:string|null|undefined):MobileDeepLink{
  if(!raw)return {kind:'ignore'}
  const {scheme,host,parts}=partsFromUrl(raw)

  if(scheme==='https'||scheme==='http'){
    if(!HOSTS.has(host))return {kind:'ignore'}
  }else if(scheme&&scheme!=='dropzone'){
    return {kind:'ignore'}
  }

  const lower=parts.map(item=>item.toLowerCase())
  if(lower[0]==='auth'&&lower[1]==='callback')return {kind:'ignore'}

  if(!lower.length||lower[0]==='home')return {kind:'route',route:'home'}
  if(lower[0]==='search'||lower[0]==='buscar')return {kind:'route',route:'search'}
  if(lower[0]==='vagas'||lower[0]==='campeonatos') {
    if(lower[0]==='campeonatos'&&parts[1])return {kind:'championship',id:parts[1]}
    return {kind:'route',route:'vacancies'}
  }
  if(lower[0]==='rank'||lower[0]==='ranking')return {kind:'route',route:'rank'}
  if(lower[0]==='equipes'&&parts[1])return {kind:'team',id:parts[1]}
  if(lower[0]==='jogadores'&&parts[1])return {kind:'player',id:parts[1]}

  for(const prefix of TOKEN_PREFIXES){
    const matches=prefix.every((part,index)=>lower[index]===part)
    if(!matches)continue
    const token=parts[prefix.length]
    if(token)return {kind:'token',token}
  }

  return {kind:'ignore'}
}
