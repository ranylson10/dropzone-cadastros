import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import type { Page } from '@playwright/test'

// Real React/ReactDOM and actual app code; only native rendering and authentication
// are adapted to DOM. These tests certify request/state behavior, not native layout.
function bundle() {
  const definitions: string[] = []
  const define = (id: string, code: string) => definitions.push(`define(${JSON.stringify(id)},function(require,module,exports){\n${code}\n});`)
  for (const [id,file] of Object.entries({react:'react/cjs/react.development.js','react/jsx-runtime':'react/cjs/react-jsx-runtime.development.js','react-dom':'react-dom/cjs/react-dom.development.js','react-dom/client':'react-dom/cjs/react-dom-client.development.js',scheduler:'scheduler/cjs/scheduler.development.js'})) define(id,fs.readFileSync(path.join(process.cwd(),'node_modules',file),'utf8'))
  for (const relative of ['hooks/usePagedDirectory.ts','components/DirectoryStatus.tsx','lib/api.ts','lib/slot-transfer-attempt.ts','lib/slot-transfer-write.ts','lib/participation-attempt.ts','lib/participation-write.ts','lib/championship-session.ts','lib/championship-discard.ts','lib/vacancies.ts','theme/tokens.ts','screens/GlobalSearchScreen.tsx','screens/LineManagementScreen.tsx','screens/ChampionshipTeamsPanel.tsx']) define('@/'+relative.replace(/\.tsx?$/,''),ts.transpileModule(fs.readFileSync(path.join(process.cwd(),'app/src',relative),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText)
  for (const relative of ['participation-contract','participation-attempt','slot-movement-contract','championship-operation']) define('backend/src/campeonatos/'+relative,ts.transpileModule(fs.readFileSync(path.join(process.cwd(),'backend/src/campeonatos',relative+'.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)
  define('@/lib/supabase',`exports.supabase={auth:{getSession:async()=>({data:{session:window.harnessSession}})}};`)
  // Browser adapters exercise persistence/reload behavior; not SecureStore/device QA.
  define('@/lib/secureStorage',`exports.secureStorage={getItem:async key=>{if(window.slotStorageBlocked)throw new Error('Storage blocked');return localStorage.getItem(key)},setItem:async(key,value)=>{if(window.slotStorageBlocked)throw new Error('Storage blocked');localStorage.setItem(key,value)},removeItem:async key=>{if(window.slotStorageBlocked)throw new Error('Storage blocked');localStorage.removeItem(key)}};`)
  define('expo-crypto',`exports.CryptoDigestAlgorithm={SHA256:'SHA-256'};exports.randomUUID=()=>crypto.randomUUID();exports.digestStringAsync=async(_,value)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))).map(v=>v.toString(16).padStart(2,'0')).join('');`)
  define('@/config/env','exports.apiUrl=path=>location.origin+path; exports.externalUrl=value=>value||"";')
  define('@/lib/auth','exports.useAuth=()=>({session:{access_token:window.harnessToken||"fixture-session"}});')
  define('@expo/vector-icons/Ionicons',"module.exports=function Icon(){return require('react').createElement('span',{'aria-hidden':true},'Icon')};")
  define('expo-image-picker','module.exports={};'); define('expo-image-manipulator','module.exports={};')
  define('react-native', `const React=require('react');
    const element=(tag, extra={})=>({children,disabled,placeholder,value,onChangeText,onSubmitEditing,onPress,accessibilityRole,accessibilityLabel,...props})=>React.createElement(tag,{...extra,disabled,placeholder,value,role:accessibilityRole||extra.role,'aria-label':accessibilityLabel,onChange:onChangeText?event=>onChangeText(event.target.value):undefined,onKeyDown:onSubmitEditing?event=>{if(event.key==='Enter')onSubmitEditing()}:undefined,onClick:disabled?undefined:onPress},children);
    exports.View=element('div'); exports.ScrollView=element('div'); exports.Text=element('span'); exports.TextInput=element('input'); exports.TouchableOpacity=element('div',{role:'button',tabIndex:0}); exports.Image=()=>null; exports.ActivityIndicator=()=>React.createElement('span',{role:'status'},'Carregando'); exports.RefreshControl=()=>null; exports.StyleSheet={create:value=>value}; exports.Alert={alert:(title,message,buttons)=>{window.harnessAlerts=(window.harnessAlerts||0)+1;window.harnessLastAlert={title,message,buttons}}};`)
  return `const process={env:{NODE_ENV:'development'}}; const factories={},cache={}; function define(id,factory){factories[id]=factory} function require(id){if(cache[id])return cache[id].exports; if(!factories[id])throw new Error('Missing harness module '+id); const module=cache[id]={exports:{}};const localRequire=value=>{if(!value.startsWith('.'))return require(value);const parts=id.split('/').slice(0,-1);for(const part of value.split('/')){if(part==='..')parts.pop();else if(part!=='.')parts.push(part)}return require(parts.join('/'))};factories[id](localRequire,module,module.exports);return module.exports}
  ${definitions.join('\n')}
  const React=require('react'), root=require('react-dom/client').createRoot(document.getElementById('root')); let props={};
  window.harnessSession={user:{id:'00000000-0000-4000-8000-000000000001'},access_token:'fixture-session'};
  window.changeMobileSession=(actor,token)=>{window.manualSessionOverride=true;window.harnessSession=actor?{user:{id:actor},access_token:token||'fixture-session'}:null};
  window.mobileOperations={api:require('@/lib/api').mobileApi,participation:require('@/lib/participation-write'),movement:require('@/lib/slot-transfer-attempt')};
  const nativeFetch=window.fetch; window.harnessAborts=0; window.fetch=(url,options)=>{options?.signal?.addEventListener('abort',()=>window.harnessAborts++,{once:true});return nativeFetch(url,options)};
  function Probe(p){const page=require('@/hooks/usePagedDirectory').usePagedDirectory(p.endpoint,p.query,p.options); window.harnessPage=page; return React.createElement('div',null,page.items.map(item=>React.createElement('span',{key:item.id},item.nome)),React.createElement(require('@/components/DirectoryStatus').DirectoryStatus,{page}))}
  window.renderHarness=p=>{props={...props,...p};if(!window.manualSessionOverride)window.harnessSession={user:{id:props.actorId||'00000000-0000-4000-8000-000000000001'},access_token:props.token||'fixture-session'}; const Component=props.screen==='hook'?Probe:require('@/screens/'+props.screen)[props.screen]; root.render(React.createElement(Component,props));}; window.unmountHarness=()=>root.unmount();`
}
let source: string | undefined
export async function mountMobileHarness(page: Page, props: Record<string,unknown>) {
  await page.route('**/__mobile-directory-harness',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html><body><div id="root"></div></body></html>'}))
  await page.goto('/__mobile-directory-harness')
  await page.addScriptTag({content:source ||= bundle()})
  await renderMobileHarness(page,props)
}
export async function renderMobileHarness(page: Page, props: Record<string,unknown>) {
  await page.evaluate(value=>(window as any).renderHarness(value),props)
}
