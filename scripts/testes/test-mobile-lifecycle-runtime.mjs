import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import { chromium } from '@playwright/test'
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
const actor = id(1), champ = id(20), edition = id(30), publication = id(40)
const fence = { edition_id:edition, revision:7, publication_id:null, plan_hash:'a'.repeat(64) }
const reopenFence = { ...fence,revision:10,publication_id:publication,plan_hash:'b'.repeat(64) }
const plan = { falls:1,total_equipes:1,groups:[],ranking:[{campeonato_equipe_id:id(80),colocacao:1,quedas:1,booyahs:1,abates:3,pontos_total:15,melhor_posicao:1}],champion_id:id(80),champion_name:'Team',phase_id:null,decisive_game_id:null,gold_reached:false,winner_fall_id:null }

function bundle() {
  const definitions = [], known = new Set()
  const define = (name,source) => { try { new Function('require','module','exports',source) } catch(error) { throw Error('Invalid test module '+name+': '+error.message) }; known.add(name); definitions.push(`define(${JSON.stringify(name)},function(require,module,exports){${source}\n});`) }
  for (const [name,file] of Object.entries({react:'react/cjs/react.development.js','react/jsx-runtime':'react/cjs/react-jsx-runtime.development.js','react-dom':'react-dom/cjs/react-dom.development.js','react-dom/client':'react-dom/cjs/react-dom-client.development.js',scheduler:'scheduler/cjs/scheduler.development.js'})) define(name,fs.readFileSync(path.join('node_modules',file),'utf8'))
  define('react-native',`const React=require('react');window.fixtureButtonHandlers={};function element(tag){return function(props){const {children,style,onPress,accessibilityRole,accessibilityLabel,accessibilityState,...rest}=props;if(accessibilityLabel)window.fixtureButtonHandlers[accessibilityLabel]=onPress;return React.createElement(tag,{...rest,onClick:onPress,'aria-label':accessibilityLabel,role:accessibilityRole,'aria-disabled':accessibilityState?.disabled},children)}}exports.View=element('div');exports.Text=element('span');exports.TouchableOpacity=element('button');exports.ActivityIndicator=()=>React.createElement('span',{},'Aguarde');exports.StyleSheet={create:v=>v};exports.Alert={alert:(title,text,buttons)=>{window.fixtureDialog={title,text,buttons}}};window.chooseLifecycleDialog=label=>{const dialog=window.fixtureDialog;window.fixtureDialog=null;dialog.buttons.find(b=>b.text===label).onPress?.()};`)
  define('app/src/lib/supabase',`const listeners=[];window.fixtureActor=${JSON.stringify(actor)};let counter=0;
    exports.supabase={auth:{
      getSession:async()=>({data:{session:window.fixtureActor?{user:{id:window.fixtureActor},access_token:'FRESH:'+window.fixtureActor+':'+(++counter)}:null}}),
      onAuthStateChange:fn=>{listeners.push(fn);return {data:{subscription:{unsubscribe:()=>{const n=listeners.indexOf(fn);if(n>=0)listeners.splice(n,1)}}}}}
    }};
    window.changeLifecycleActor=id=>{window.fixtureActor=id;listeners.slice().forEach(fn=>fn('SIGNED_IN',id?{user:{id}}:null))};`)
  define('@react-native-async-storage/async-storage',`window.fixtureStorage=new Map();module.exports={getItem:async k=>window.fixtureStorage.get(k)??null,setItem:async(k,v)=>window.fixtureStorage.set(k,v),removeItem:async k=>window.fixtureStorage.delete(k)};`)
  define('expo-secure-store',`exports.isAvailableAsync=async()=>false;`)
  define('expo-crypto',`exports.CryptoDigestAlgorithm={SHA256:'SHA-256'};exports.randomUUID=()=>crypto.randomUUID();exports.digestStringAsync=async(_,value)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))).map(v=>v.toString(16).padStart(2,'0')).join('');`)
  define('app/src/config/env',`exports.apiUrl=p=>location.origin+p;`)
  const resolve = (parent,value) => value.startsWith('.') ? path.posix.normalize(path.posix.join(path.posix.dirname(parent),value)) : value.startsWith('@/') ? 'app/src/'+value.slice(2) : value
  function include(name) {
    if (known.has(name)) return
    const file = ['.ts','.tsx'].map(ext=>name+ext).find(file=>fs.existsSync(file))
    if (!file) throw Error('Missing module '+name)
    const source = ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText
    define(name,source); for (const dependency of source.matchAll(/require\(["']([^"']+)["']\)/g)) include(resolve(name,dependency[1]))
  }
  include('app/src/screens/MobileLifecyclePanel')
  return `const factories={},cache={},process={env:{NODE_ENV:'development'}};function define(id,factory){factories[id]=factory}function require(id){if(cache[id])return cache[id].exports;const m=cache[id]={exports:{}};factories[id](v=>{if(v.startsWith('@/'))return require('app/src/'+v.slice(2));if(!v.startsWith('.'))return require(v);const parts=id.split('/').slice(0,-1);for(const s of v.split('/')){if(s==='..')parts.pop();else if(s!=='.')parts.push(s)}return require(parts.join('/'))},m,m.exports);return m.exports}${definitions.join('\n')}
  const React=require('react'),root=require('react-dom/client').createRoot(document.getElementById('root')),flush=require('react-dom').flushSync;window.renderLifecycle=id=>flush(()=>root.render(React.createElement(require('app/src/screens/MobileLifecyclePanel').MobileLifecyclePanel,{championshipId:id})));window.unmountLifecycle=()=>flush(()=>root.render(null));`
}
const source = bundle(), browser = await chromium.launch({headless:true})
let checks = 0
const evidence = process.env.MOBILE_LIFECYCLE_RUNTIME_REPORT
const cases = [
  ['disabled mode and missing management refuse new preview',async c => { c.mode='unavailable'; await c.mount(); await assertDisabled(c.page,'Conferir encerramento'); assert.equal(c.posts.length,0); c.mode='atomic'; c.manage=false; await c.remount(); await assertDisabled(c.page,'Conferir encerramento') }],
  ['preview and cancellation never mutate',async c => { await c.review(); await c.page.getByRole('button',{name:'Confirmar publicação final'}).click(); await c.page.evaluate(()=>window.chooseLifecycleDialog('Cancelar')); assert.equal(c.posts.length,1); assert.equal(c.commits,0); assert.equal(await c.page.evaluate(()=>window.fixtureStorage.size),0) }],
  ['confirmed publication survives failed GET reload',async c => { await c.review(); c.getFails=true; await c.confirm(); await c.page.getByText('Publicação final confirmada.',{exact:true}).waitFor(); await c.page.getByRole('alert').filter({hasText:'Operação confirmada.'}).waitFor(); assert.equal(c.commits,1); assert.deepEqual(c.posts[1].body.expected,fence) }],
  ['reopen explains ALL activation and closed enrollments',async c => { c.status='encerrada'; await c.review(false); await c.page.getByText('Ativar todas as etapas e divisões encerradas. Preservar canceladas e manter inscrições fechadas.',{exact:true}).waitFor(); await c.confirm(false); await c.page.getByText('Reabertura confirmada. Inscrições permanecem fechadas.',{exact:true}).waitFor(); assert.deepEqual(c.posts[1].body.expected,reopenFence); assert.equal(c.commits,1) }],
  ['lost response repeats original UUID and fence',async c => { await c.review(); c.lost=true; await c.confirm(); await enabled(c.page,'Repetir tentativa original'); const original=c.posts[1]; await c.page.getByRole('button',{name:'Repetir tentativa original'}).click(); await c.page.getByText('Publicação final confirmada.',{exact:true}).waitFor(); assert.deepEqual(c.posts[2],original); assert.equal(c.commits,1) }],
  ['downgrade keeps original attempt with dedicated endpoint',async c => { await c.review(); c.lost=true; await c.confirm(); await enabled(c.page,'Repetir tentativa original'); c.mode='unavailable'; await c.remount(); await enabled(c.page,'Repetir tentativa original'); await c.page.getByRole('button',{name:'Repetir tentativa original'}).click(); await c.page.getByRole('alert').filter({hasText:'Indisponível'}).waitFor(); assert.deepEqual(c.posts[2],c.posts[1]); assert.equal(c.commits,1); assert.equal(await c.page.evaluate(()=>window.fixtureStorage.size),1) }],
  ['initial GET failure still exposes saved retry',async c => { await c.review(); c.lost=true; await c.confirm(); await enabled(c.page,'Repetir tentativa original'); c.getFails=true; await c.remount(); await enabled(c.page,'Repetir tentativa original'); await c.page.getByRole('button',{name:'Repetir tentativa original'}).click(); await c.page.getByText('Publicação final confirmada.',{exact:true}).waitFor(); assert.equal(c.commits,1); assert.deepEqual(c.posts[2],c.posts[1]) }],
  ['account changes while confirmation dialog is open',async c => { await c.review(); await c.page.getByRole('button',{name:'Confirmar publicação final'}).click(); await c.page.evaluate(next=>{window.changeLifecycleActor(next);window.chooseLifecycleDialog('Confirmar')},id(99)); await enabled(c.page,'Conferir encerramento'); assert.equal(await c.page.getByText('Campeã: Team',{exact:true}).count(),0); assert.equal(c.posts.length,1); assert.equal(c.commits,0) }],
  ['A-B-A invalidates previous dialog and preview',async c => { await c.review(); await c.page.getByRole('button',{name:'Confirmar publicação final'}).click(); await c.page.evaluate(({a,b})=>{window.changeLifecycleActor(b);window.changeLifecycleActor(a);window.chooseLifecycleDialog('Confirmar')},{a:actor,b:id(99)}); await enabled(c.page,'Conferir encerramento'); assert.equal(await c.page.getByText('Campeã: Team',{exact:true}).count(),0); assert.equal(c.posts.length,1); assert.equal(c.commits,0) }],
  ['resource changes while dialog is open',async c => { await c.review(); await c.page.getByRole('button',{name:'Confirmar publicação final'}).click(); await c.page.evaluate(next=>{window.renderLifecycle(next);window.chooseLifecycleDialog('Confirmar')},id(21)); await enabled(c.page,'Conferir encerramento'); assert.equal(await c.page.getByText('Campeã: Team',{exact:true}).count(),0); assert.equal(c.posts.length,1); assert.equal(c.commits,0) }],
  ['unmount while in flight retains lost-response replay',async c => { await c.review(); c.lost=true; c.hold=new Promise(resolve=>c.release=resolve); await c.confirm(); await c.page.waitForFunction(()=>window.fixtureStorage.size===1); await waitUntil(()=>c.posts.length===2); await c.page.evaluate(()=>window.unmountLifecycle()); c.release(); await waitUntil(()=>c.commits===1); await c.remount(); await enabled(c.page,'Repetir tentativa original'); await c.page.getByRole('button',{name:'Repetir tentativa original'}).click(); await c.page.getByText('Publicação final confirmada.',{exact:true}).waitFor(); assert.deepEqual(c.posts[2],c.posts[1]); assert.equal(c.commits,1) }],
  ['explicit discard reviews GET and sends no mutation',async c => { await c.review(); c.lost=true; await c.confirm(); await enabled(c.page,'Encerrar tentativa local'); await c.page.getByRole('button',{name:'Encerrar tentativa local'}).click(); await c.page.evaluate(()=>window.chooseLifecycleDialog('Encerrar tentativa local')); await c.page.getByText('Tentativa local encerrada.',{exact:true}).waitFor(); assert.equal(c.posts.length,2); assert.equal(c.commits,1); assert.equal(await c.page.evaluate(()=>window.fixtureStorage.size),0) }],
  ['consumed Alert callback cannot publish a second UUID',async c => { await c.review(); await c.page.getByRole('button',{name:'Confirmar publicação final'}).click(); await c.page.evaluate(()=>{window.staleConfirm=window.fixtureDialog.buttons.find(b=>b.text==='Confirmar').onPress;window.chooseLifecycleDialog('Confirmar')}); await c.page.getByText('Publicação final confirmada.',{exact:true}).waitFor(); await enabled(c.page,'Conferir reabertura'); await c.page.evaluate(()=>window.staleConfirm()); await c.page.waitForTimeout(50); assert.equal(c.posts.length,2); assert.equal(c.commits,1); assert.equal(await c.page.evaluate(()=>window.fixtureStorage.size),0) }],
  ['stale retry callback cannot recreate completed attempt',async c => { await c.review(); c.lost=true; await c.confirm(); await enabled(c.page,'Repetir tentativa original'); await c.page.evaluate(()=>window.staleRetry=window.fixtureButtonHandlers['Repetir tentativa original']); await c.page.getByRole('button',{name:'Repetir tentativa original'}).click(); await c.page.getByText('Publicação final confirmada.',{exact:true}).waitFor(); await enabled(c.page,'Conferir reabertura'); await c.page.evaluate(()=>window.staleRetry()); await c.page.getByRole('alert').filter({hasText:'A tentativa mudou.'}).waitFor(); assert.equal(c.posts.length,3); assert.equal(c.commits,1); assert.equal(await c.page.evaluate(()=>window.fixtureStorage.size),0) }],
]
async function enabled(page,name) { const button=page.getByRole('button',{name,exact:true}); await button.waitFor(); await page.waitForFunction(label=>{const b=[...document.querySelectorAll('button')].find(el=>el.textContent===label);return b&&!b.disabled},name) }
async function assertDisabled(page,name) { await page.getByText('Encerramento e reabertura temporariamente indisponíveis.',{exact:true}).waitFor(); await page.waitForTimeout(25); assert.equal(await page.getByRole('button',{name,exact:true}).isDisabled(),true) }
async function waitUntil(condition) { for(let n=0;n<200;n++){if(condition())return;await new Promise(r=>setTimeout(r,10))}throw Error('Condition timeout') }
try {
  for (const viewport of [{width:390,height:844},{width:1280,height:900}]) for (const [name,work] of cases) {
    const page=await browser.newPage({viewport});page.setDefaultTimeout(10000);page.on('pageerror',error=>console.log('PAGE ERROR '+error.stack))
    const c={page,mode:'atomic',manage:true,status:'ativa',lost:false,getFails:false,posts:[],receipts:new Map(),commits:0,hold:null,release:null}
    await page.route('**/__mobile-lifecycle',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div></body></html>'}))
    await page.route('**/api/campeonatos/*/estrutura-avancada',route=>{
      const requestActor=route.request().headers().authorization.split(':')[1],requestChamp=new URL(route.request().url()).pathname.split('/')[3]
      return route.fulfill({status:c.getFails?503:200,contentType:'application/json',body:JSON.stringify(c.getFails?{error:'Leitura indisponível'}:{lifecycle_write_mode:c.mode,lifecycle_manage_allowed:c.manage,edition_actor_id:requestActor,edition:{id:edition,campeonato_id:requestChamp,status:c.status,data_fim:c.status==='encerrada'?'2026-10-12':null}})})
    })
    await page.route('**/api/campeonatos/*/estrutura-avancada/lifecycle-atomico',async route=>{
      const body=route.request().postDataJSON(),key=route.request().headers()['idempotency-key'];c.posts.push({body,key})
      if(c.mode!=='atomic'){await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Indisponível'})});return}
      const base={mode:'atomic',actor_id:actor,campeonato_id:champ,request_id:key,action:body.action}
      if(body.action.startsWith('preview_')){await route.fulfill({contentType:'application/json',body:JSON.stringify({...base,preview:{fence:c.status==='encerrada'?reopenFence:fence,edition:{id:edition,status:c.status,data_fim:null},plan,stages:3,divisions:2}})});return}
      if(c.hold)await c.hold
      let result=c.receipts.get(key)
      if(result)result={...result,repetida:true}
      else{c.commits++;c.status=body.action==='publish_final'?'encerrada':'ativa';result={...base,operation_confirmed:true,repetida:false,publication_id:publication,revision:11,edition:{id:edition,campeonato_id:champ,status:c.status,data_fim:c.status==='encerrada'?'2026-10-12':null},registrations_open:false,total_equipes:1,champion_id:c.status==='encerrada'?id(80):null};c.receipts.set(key,result)}
      if(c.lost){c.lost=false;await route.abort('failed');return}
      await route.fulfill({contentType:'application/json',body:JSON.stringify(result)})
    })
    c.mount=async()=>{await page.goto('http://127.0.0.1:43196/__mobile-lifecycle');await page.addScriptTag({content:source});await page.evaluate(id=>window.renderLifecycle(id),champ)}
    c.remount=async()=>{await page.evaluate(()=>window.unmountLifecycle());await page.evaluate(id=>window.renderLifecycle(id),champ)}
    c.review=async(publish=true)=>{await c.mount();const inspect=publish?'Conferir encerramento':'Conferir reabertura';await enabled(page,inspect);await page.getByRole('button',{name:inspect}).click();await enabled(page,publish?'Confirmar publicação final':'Confirmar reabertura')}
    c.confirm=async(publish=true)=>{await page.getByRole('button',{name:publish?'Confirmar publicação final':'Confirmar reabertura'}).click();await page.evaluate(()=>window.chooseLifecycleDialog('Confirmar'))}
    try { await work(c);checks++;console.log(`PASS ${viewport.width}px ${name}`) }
    catch(error){if(evidence){fs.writeFileSync(path.join(path.dirname(evidence),'runtime-failure.html'),await page.content());await page.screenshot({path:path.join(path.dirname(evidence),'runtime-failure.png'),fullPage:true})}throw error}
    finally { await page.close() }
  }
  if(evidence)fs.writeFileSync(evidence,JSON.stringify({checks,failures:0,scope:'Real React mobile lifecycle component/hook/transport/contracts in Chromium at 390px and 1280px; RN primitive/Alert, Auth, HTTP and storage adapters. No native-device UI/project calls.'},null,2)+'\n')
  console.log(`Mobile lifecycle React runtime: ${checks} checks passed.`)
} finally { await browser.close() }
