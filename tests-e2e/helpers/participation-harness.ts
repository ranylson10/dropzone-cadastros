import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import type {Page} from '@playwright/test'
function bundle(){
 const definitions:string[]=[],define=(id:string,code:string)=>definitions.push(`define(${JSON.stringify(id)},function(require,module,exports){${code}\n});`)
 for(const [id,file] of Object.entries({react:'react/cjs/react.development.js','react/jsx-runtime':'react/cjs/react-jsx-runtime.development.js','react-dom':'react-dom/cjs/react-dom.development.js','react-dom/client':'react-dom/cjs/react-dom-client.development.js',scheduler:'scheduler/cjs/scheduler.development.js'}))define(id,fs.readFileSync(path.join(process.cwd(),'node_modules',file),'utf8'))
 for(const relative of ['lib/participation-write.ts','lib/championship-operation.ts','lib/slot-movement-attempt.ts','features/campeonatos/equipes/components/ParticipationRecovery.tsx'])define('@/'+relative.replace(/\.tsx?$/,''),ts.transpileModule(fs.readFileSync(path.join(process.cwd(),'web',relative),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText)
 for(const relative of ['participation-contract','participation-attempt','slot-movement-contract','slot-movement-attempt','championship-operation'])define('@backend/campeonatos/'+relative,ts.transpileModule(fs.readFileSync(path.join(process.cwd(),'backend/src/campeonatos',relative+'.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)
 define('@/lib/supabase-browser',`const listeners=[];window.fixtureSession={user:{id:'00000000-0000-4000-8000-000000000001'},access_token:'fixture-session'};
 exports.supabase={auth:{getSession:async()=>({data:{session:window.fixtureSession}}),onAuthStateChange:fn=>{listeners.push(fn);return{data:{subscription:{unsubscribe(){listeners.splice(listeners.indexOf(fn),1)}}}}}}};
 window.changeParticipationActor=id=>{window.fixtureSession=id?{user:{id},access_token:'other-session'}:null;listeners.forEach(fn=>fn('SIGNED_IN',window.fixtureSession))};`)
 define('@/components/feedback',`exports.confirmAction=async()=>true;`)
 return `const factories={},cache={},process={env:{NODE_ENV:'development'}};function define(id,factory){factories[id]=factory}function require(id){if(cache[id])return cache[id].exports;if(!factories[id])throw Error('Missing module '+id);const m=cache[id]={exports:{}};factories[id](v=>{if(!v.startsWith('.'))return require(v);const parts=id.split('/').slice(0,-1);for(const s of v.split('/')){if(s==='..')parts.pop();else if(s!=='.')parts.push(s)}return require(parts.join('/'))},m,m.exports);return m.exports}
 ${definitions.join('\n')}
 const React=require('react'),root=require('react-dom/client').createRoot(document.getElementById('root'));let props={};
 window.participationApi=require('@/lib/participation-write');window.confirmed=0;
 window.renderParticipation=p=>{props={...props,...p};root.render(React.createElement(require('@/features/campeonatos/equipes/components/ParticipationRecovery').ParticipationRecovery,{...props,onConfirmed:()=>window.confirmed++}))};`
}
let source:string|undefined
export async function mountParticipation(page:Page,props:Record<string,unknown>){
 await page.route('**/__participation-harness',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html lang="pt-BR"><body><div id="root"></div></body></html>'}))
 await page.goto('/__participation-harness');await page.addScriptTag({content:source||=bundle()});await page.evaluate(p=>(window as any).renderParticipation(p),props)
}
