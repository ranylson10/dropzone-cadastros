import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import type {Page} from '@playwright/test'
function bundle(){
 const definitions:string[]=[],define=(id:string,code:string)=>definitions.push(`define(${JSON.stringify(id)},function(require,module,exports){${code}\n});`)
 for(const [id,file] of Object.entries({react:'react/cjs/react.development.js','react/jsx-runtime':'react/cjs/react-jsx-runtime.development.js','react-dom':'react-dom/cjs/react-dom.development.js','react-dom/client':'react-dom/cjs/react-dom-client.development.js',scheduler:'scheduler/cjs/scheduler.development.js'}))define(id,fs.readFileSync(path.join(process.cwd(),'node_modules',file),'utf8'))
 for(const relative of ['lib/edition-write.ts','hooks/useEditionMutation.ts','features/campeonatos/estrutura-avancada/EditionPanel.tsx','lib/progression-write.ts','lib/daily-group-write.ts','lib/browser-operation-storage.ts','lib/championship-operation.ts','lib/group-choice-attempt.ts','hooks/useDailyGroupMutation.ts','hooks/useAccountResourceScope.ts','hooks/useProgressionMutation.ts','hooks/useGroupChoiceMutation.ts','hooks/useScopedState.ts','components/campeonatos/PendingGroupChoice.tsx','features/campeonatos/estrutura-avancada/DailyGroupPanel.tsx','features/campeonatos/estrutura-avancada/AdvancedStructureTab.tsx'])define('@/'+relative.replace(/\.tsx?$/,''),ts.transpileModule(fs.readFileSync(path.join(process.cwd(),'web',relative),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText)
 for(const relative of ['edition-contract','daily-group-contract','progression-contract','progression-attempt','championship-operation'])define('@backend/campeonatos/'+relative,ts.transpileModule(fs.readFileSync(path.join(process.cwd(),'backend/src/campeonatos',relative+'.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)
 for(const relative of ['operation-json','operation-attempt'])define('@backend/shared/'+relative,ts.transpileModule(fs.readFileSync(path.join(process.cwd(),'backend/src/shared',relative+'.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)
 define('@/lib/supabase-browser',`const listeners=[];window.fixtureSession={user:{id:'00000000-0000-4000-8000-000000000001'},access_token:'fixture-token'};
 exports.supabase={auth:{getSession:async()=>{if(window.fixtureSessionDelay)await window.fixtureSessionDelay;return{data:{session:window.fixtureSession}}},onAuthStateChange:fn=>{listeners.push(fn);return{data:{subscription:{unsubscribe(){listeners.splice(listeners.indexOf(fn),1)}}}}}}};
 window.changeProgressionActor=id=>{window.fixtureSession=id?{user:{id},access_token:'fixture-token'}:null;listeners.forEach(fn=>fn('SIGNED_IN',window.fixtureSession))};`)
 define('@/components/feedback',`exports.promptAction=async()=>window.fixtureReason??'Fixture reversal';exports.confirmAction=async()=>window.fixtureConfirm===true;`)
 define('@/components/ui/Field',`const React=require('react');exports.Input=props=>React.createElement('input',props);exports.Select=props=>React.createElement('select',props);`)
 define('lucide-react',`for(const name of ['Loader2','Plus','RefreshCw','Trash2'])exports[name]=()=>null;`)
 return `const factories={},cache={},process={env:{NODE_ENV:'development'}};function define(id,factory){factories[id]=factory}function require(id){if(cache[id])return cache[id].exports;if(!factories[id])throw Error('Missing module '+id);const m=cache[id]={exports:{}};factories[id](v=>{if(!v.startsWith('.'))return require(v);const parts=id.split('/').slice(0,-1);for(const s of v.split('/')){if(s==='..')parts.pop();else if(s!=='.')parts.push(s)}return require(parts.join('/'))},m,m.exports);return m.exports}
 ${definitions.join('\n')}
 const React=require('react'),root=require('react-dom/client').createRoot(document.getElementById('root'));let props={},key=0;
 window.progressionApi=require('@/lib/progression-write');window.renderProgression=p=>{props={...props,...p};root.render(React.createElement(require('@/features/campeonatos/estrutura-avancada/AdvancedStructureTab').AdvancedStructureTab,{...props,key}))};
 window.remountProgression=()=>{key++;window.renderProgression({})};`
}
let source:string|undefined
export async function mountProgression(page:Page,props:Record<string,unknown>){
 await page.route('**/__progression-harness',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html lang="pt-BR"><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="root"></div></body></html>'}))
 await page.goto('/__progression-harness');await page.addScriptTag({content:source||=bundle()});await page.evaluate(p=>(window as any).renderProgression(p),props)
}
