import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import type {Page} from '@playwright/test'
function bundle(){
 const definitions:string[]=[],define=(id:string,code:string)=>{new Function('require','module','exports',code);definitions.push(`define(${JSON.stringify(id)},function(require,module,exports){${code}\n});`)}
 for(const [id,file] of Object.entries({react:'react/cjs/react.development.js','react/jsx-runtime':'react/cjs/react-jsx-runtime.development.js','react-dom':'react-dom/cjs/react-dom.development.js','react-dom/client':'react-dom/cjs/react-dom-client.development.js',scheduler:'scheduler/cjs/scheduler.development.js'}))define(id,fs.readFileSync(path.join(process.cwd(),'node_modules',file),'utf8'))
 for(const relative of ['hooks/usePagedSearch.ts','lib/participation-write.ts','lib/championship-operation.ts','lib/slot-movement-attempt.ts','lib/slot-movement-write.ts','components/ui/Field.tsx','features/campeonatos/equipes/components/ParticipationRecovery.tsx','features/campeonatos/equipes/components/LigaOriginField.tsx','features/campeonatos/equipes/services/campeonato-equipes.service.ts','features/campeonatos/fases/components/CampeonatoEstruturaTab.tsx','components/lili/LiliChampionshipHub.tsx','components/lili/LiliPhaseDistributor.tsx','components/lili/SlotMovementRecovery.tsx'])define('@/'+relative.replace(/\.tsx?$/,''),ts.transpileModule(fs.readFileSync(path.join(process.cwd(),'web',relative),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText)
 for(const relative of ['participation-contract','participation-attempt','liga-plan','slot-movement-contract','slot-movement-attempt','championship-operation'])define('@backend/campeonatos/'+relative,ts.transpileModule(fs.readFileSync(path.join(process.cwd(),'backend/src/campeonatos',relative+'.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)
 define('@/lib/supabase-browser',`const listeners=[];window.fixtureSession={user:{id:'00000000-0000-4000-8000-000000000001'},access_token:'fixture-session'};
 exports.supabase={auth:{getSession:async()=>({data:{session:window.fixtureSession}}),onAuthStateChange:fn=>{listeners.push(fn);return{data:{subscription:{unsubscribe(){listeners.splice(listeners.indexOf(fn),1)}}}}}}};
 window.changeLigaActor=id=>{window.fixtureSession={user:{id},access_token:'other-session'};listeners.forEach(fn=>fn('SIGNED_IN',window.fixtureSession))};`)
 define('@/components/feedback',`exports.confirmAction=async()=>window.fixtureConfirm?window.fixtureConfirm():true;`)
 define('@/features/dropzone/components/form-fields',`const React=require('react');exports.Field=({label,children})=>React.createElement('label',null,label,children);`)
 define('@/components/layout/SystemModal',`const React=require('react');exports.SystemModal=({open,title,children})=>open?React.createElement('section',{'role':'dialog','aria-label':title},React.createElement('h2',null,title),children):null;`)
 define('@/lib/dropzone-constants',`exports.GROUP_LETTERS=['A','B','C'];`)
 define('lucide-react',`const React=require('react');module.exports=new Proxy({},{get:(_,name)=>name==='__esModule'?true:()=>React.createElement('span',{'aria-hidden':true,style:{display:'inline-block',width:15,height:15}},' ') });`)
 define('@/features/campeonatos/fases/components/campeonato-estrutura-batch.css','')
 define('@/components/lili/LiliLinksManager',`exports.LiliLinksManager=()=>null;`)
 define('@/components/forms/campeonato',`exports.CampeonatoForm=()=>null;exports.emptyCampeonatoForm={};`)
 return `const factories={},cache={},process={env:{NODE_ENV:'development'}};function define(id,factory){factories[id]=factory}function require(id){if(cache[id])return cache[id].exports;if(!factories[id])throw Error('Missing module '+id);const m=cache[id]={exports:{}};factories[id](v=>{if(!v.startsWith('.'))return require(v);const parts=id.split('/').slice(0,-1);for(const s of v.split('/')){if(s==='..')parts.pop();else if(s!=='.')parts.push(s)}return require(parts.join('/'))},m,m.exports);return m.exports}
 ${definitions.join('\n')}
 const React=require('react'),root=require('react-dom/client').createRoot(document.getElementById('root'));let props={};
 window.movementApi=require('@/lib/slot-movement-write');window.participationApi=require('@/lib/participation-write');
 window.renderLiga=p=>{props={...props,...p};const lili=props.screen==='lili';root.render(React.createElement(require(lili?'@/components/lili/LiliChampionshipHub':'@/features/campeonatos/fases/components/CampeonatoEstruturaTab')[lili?'LiliChampionshipHub':'CampeonatoEstruturaTab'],props))};`
}
let source:string|undefined
export async function mountLiga(page:Page,props:Record<string,unknown>){
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message))
 await page.route('**/__liga-web-harness',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html lang="pt-BR"><meta name="viewport" content="width=device-width,initial-scale=1"><body><div id="root"></div></body></html>'}))
 await page.goto('/__liga-web-harness');await page.addScriptTag({content:source||=bundle()})
 if(!await page.evaluate(()=>typeof(window as any).renderLiga==='function'))throw Error('Harness failed: '+errors.join('; '))
 await page.evaluate(p=>(window as any).renderLiga(p),props)
}
