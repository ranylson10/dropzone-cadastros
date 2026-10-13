import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import type {Page} from '@playwright/test'
function bundle(){
  const definitions:string[]=[]
  const define=(id:string,code:string)=>{new Function('require','module','exports',code);definitions.push(`define(${JSON.stringify(id)},function(require,module,exports){${code}\n});`)}
  for(const [id,file] of Object.entries({react:'react/cjs/react.development.js','react/jsx-runtime':'react/cjs/react-jsx-runtime.development.js','react-dom':'react-dom/cjs/react-dom.development.js','react-dom/client':'react-dom/cjs/react-dom-client.development.js',scheduler:'scheduler/cjs/scheduler.development.js'}))define(id,fs.readFileSync(path.join(process.cwd(),'node_modules',file),'utf8'))
  for(const relative of ['hooks/useScopedState.ts','hooks/useGroupChoiceMutation.ts','lib/group-choice-attempt.ts','components/campeonatos/PendingGroupChoice.tsx','components/campeonatos/ChampionshipCentral.tsx','features/campeonatos/estrutura-avancada/AdvancedStructureTab.tsx'])define('@/'+relative.replace(/\.tsx?$/,''),ts.transpileModule(fs.readFileSync(path.join(process.cwd(),'web',relative),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText)
  define('@/lib/supabase-browser',`const listeners=[];window.choiceSession={user:{id:'00000000-0000-4000-8000-000000000001'},access_token:'fixture-session'};
    function subscribe(fn){listeners.push(fn);return {data:{subscription:{unsubscribe(){const i=listeners.indexOf(fn);if(i>=0)listeners.splice(i,1)}}}}}
    exports.supabase={auth:{getSession:async()=>({data:{session:window.choiceSession}}),onAuthStateChange:subscribe}};
    window.changeChoiceActor=id=>{window.choiceSession={user:{id},access_token:'fixture-other'};listeners.forEach(fn=>fn('SIGNED_IN',window.choiceSession))};`)
  define('@/components/feedback',`exports.promptAction=async()=>null;exports.confirmAction=async()=>{window.choiceConfirmations=(window.choiceConfirmations||0)+1;return true};`)
  define('@/components/ui/Field',`const React=require('react');exports.Input=p=>React.createElement('input',p);exports.Select=p=>React.createElement('select',p);`)
  define('lucide-react',`module.exports=new Proxy({},{get:(_,name)=>name==='__esModule'?true:()=>null});`)
  define('@/features/auth/auth-return',`exports.currentInternalPath=()=>'/fixture';exports.redirectToLogin=()=>{};`)
  define('@/components/campeonatos/championship-central.css','')
  return `const process={env:{NODE_ENV:'development'}},factories={},cache={};function define(id,factory){factories[id]=factory}function require(id){if(cache[id])return cache[id].exports;if(!factories[id])throw Error('Missing module '+id);const m=cache[id]={exports:{}};factories[id](v=>{if(!v.startsWith('.'))return require(v);const parts=id.split('/').slice(0,-1);for(const s of v.split('/')){if(s==='..')parts.pop();else if(s!=='.')parts.push(s)}return require(parts.join('/'))},m,m.exports);return m.exports}
    ${definitions.join('\n')}
    const React=require('react'),root=require('react-dom/client').createRoot(document.getElementById('root'));let props={};window.renderChoice=p=>{props={...props,...p};const module=props.screen==='central'?'@/components/campeonatos/ChampionshipCentral':'@/features/campeonatos/estrutura-avancada/AdvancedStructureTab',name=props.screen==='central'?'ChampionshipCentral':'AdvancedStructureTab';root.render(React.createElement(require(module)[name],props))};`
}
let source:string|undefined
export async function mountGroupChoice(page:Page,props:Record<string,unknown>){
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message))
  await page.route('**/__group-choice-harness',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html lang="pt-BR"><body><div id="root"></div></body></html>'}))
  await page.goto('/__group-choice-harness');await page.addScriptTag({content:source||=bundle()})
  if(!await page.evaluate(()=>typeof (window as any).renderChoice==='function'))throw new Error('Harness initialization failed: '+errors.join('; '))
  await page.evaluate(p=>(window as any).renderChoice(p),props)
}
