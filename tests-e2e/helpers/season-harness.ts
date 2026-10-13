import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import type {Page} from '@playwright/test'
function bundle(){
 const definitions:string[]=[],known=new Set<string>(),define=(id:string,code:string)=>{known.add(id);definitions.push(`define(${JSON.stringify(id)},function(require,module,exports){${code}\n});`)}
 for(const [id,file] of Object.entries({react:'react/cjs/react.development.js','react/jsx-runtime':'react/cjs/react-jsx-runtime.development.js','react-dom':'react-dom/cjs/react-dom.development.js','react-dom/client':'react-dom/cjs/react-dom-client.development.js',scheduler:'scheduler/cjs/scheduler.development.js'}))define(id,fs.readFileSync(path.join(process.cwd(),'node_modules',file),'utf8'))
 define('@/lib/supabase-browser',`const listeners=[];window.fixtureSession={user:{id:'00000000-0000-4000-8000-000000000001'},access_token:'fixture-token'};
 exports.supabase={auth:{getSession:async()=>{if(window.fixtureSessionDelay)await window.fixtureSessionDelay;return{data:{session:window.fixtureSession}}},onAuthStateChange:fn=>{listeners.push(fn);return{data:{subscription:{unsubscribe(){listeners.splice(listeners.indexOf(fn),1)}}}}}}};
 window.changeSeasonActor=id=>{window.fixtureSession=id?{user:{id},access_token:'fixture-token'}:null;listeners.slice().forEach(fn=>fn('SIGNED_IN',window.fixtureSession))};`)
 define('@/components/feedback',`exports.confirmAction=async()=>{if(window.fixtureConfirmation)await window.fixtureConfirmation;return window.fixtureConfirm===true};`)
 define('@/features/campeonatos/equipes/services/campeonato-equipes.service',`exports.campeonatoEquipesService={listar:async id=>{const r=await fetch('/__season-board/'+id);if(!r.ok)throw Error('Fixture board failed');return r.json()}};`)
 const resolve=(parent:string,value:string)=>{if(!value.startsWith('.'))return value;return path.posix.normalize(path.posix.join(path.posix.dirname(parent),value))}
 function include(id:string){if(known.has(id))return;const base=id.startsWith('@/')?'web/'+id.slice(2):id.startsWith('@backend/')?'backend/src/'+id.slice(9):null;if(!base)throw Error('Unknown fixture module '+id)
  const file=['.ts','.tsx'].map(ext=>base+ext).find(name=>fs.existsSync(name));if(!file)throw Error('Missing fixture module '+id)
  const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;define(id,code)
  for(const match of code.matchAll(/require\(["']([^"']+)["']\)/g))include(resolve(id,match[1]))
 }
 include('@/features/campeonatos/equipes/components/LeagueSeasonPanel');include('@/features/campeonatos/equipes/hooks/useCampeonatoEquipes')
 return `const factories={},cache={},process={env:{NODE_ENV:'development'}};function define(id,factory){factories[id]=factory}function require(id){if(cache[id])return cache[id].exports;if(!factories[id])throw Error('Missing module '+id);const m=cache[id]={exports:{}};factories[id](v=>{if(!v.startsWith('.'))return require(v);const parts=id.split('/').slice(0,-1);for(const s of v.split('/')){if(s==='..')parts.pop();else if(s!=='.')parts.push(s)}return require(parts.join('/'))},m,m.exports);return m.exports}
 ${definitions.join('\n')}
 const React=require('react'),root=require('react-dom/client').createRoot(document.getElementById('root'));let props={},key=0;
 function Board(){const b=require('@/features/campeonatos/equipes/hooks/useCampeonatoEquipes').useCampeonatoEquipes(props.testRead?props.championshipId:'');return React.createElement('output',{'data-testid':'private-board'},b.data?.privateLabel||'')}
 window.renderSeason=p=>{props={...props,...p};require('react-dom').flushSync(()=>root.render(React.createElement(React.Fragment,{key},React.createElement(require('@/features/campeonatos/equipes/components/LeagueSeasonPanel').LeagueSeasonPanel,{...props,onRefresh:async()=>window.fixtureRefreshOK!==false}),React.createElement(Board))))};
 window.remountSeason=()=>{key++;window.renderSeason({})};window.unmountSeason=()=>require('react-dom').flushSync(()=>root.render(null));window.seasonApi=require('@/lib/league-season-write');`
}
let source:string|undefined
export async function mountSeason(page:Page,props:Record<string,unknown>){
 await page.route('**/__season-harness',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html lang="pt-BR"><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="root"></div></body></html>'}))
 await page.goto('/__season-harness');await page.addScriptTag({content:source||=bundle()});await page.evaluate(p=>(window as any).renderSeason(p),props)
}
