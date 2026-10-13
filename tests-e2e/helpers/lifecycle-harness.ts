import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import type { Page } from '@playwright/test'
function bundle() {
 const definitions: string[] = [], known = new Set<string>()
 const define = (id: string, code: string) => { known.add(id); definitions.push(`define(${JSON.stringify(id)},function(require,module,exports){${code}\n});`) }
 for (const [id, file] of Object.entries({ react: 'react/cjs/react.development.js', 'react/jsx-runtime': 'react/cjs/react-jsx-runtime.development.js', 'react-dom': 'react-dom/cjs/react-dom.development.js', 'react-dom/client': 'react-dom/cjs/react-dom-client.development.js', scheduler: 'scheduler/cjs/scheduler.development.js' })) define(id, fs.readFileSync(path.join(process.cwd(), 'node_modules', file), 'utf8'))
 define('@/lib/supabase-browser', `const listeners=[];window.fixtureActor='00000000-0000-4000-8000-000000000001';
 exports.supabase={auth:{getSession:async()=>({data:{session:window.fixtureActor?{user:{id:window.fixtureActor},access_token:'fixture-token'}:null}}),onAuthStateChange:fn=>{listeners.push(fn);return{data:{subscription:{unsubscribe(){listeners.splice(listeners.indexOf(fn),1)}}}}}}};
 window.changeLifecycleActor=id=>{window.fixtureActor=id;listeners.slice().forEach(fn=>fn('SIGNED_IN',id?{user:{id}}:null))};`)
 define('@/components/feedback', `exports.confirmAction=async()=>{if(window.fixtureConfirmation)await window.fixtureConfirmation;return window.fixtureConfirm===true};`)
 const resolve = (parent: string, value: string) => value.startsWith('.') ? path.posix.normalize(path.posix.join(path.posix.dirname(parent), value)) : value
 function include(id: string) {
  if (known.has(id)) return
  const base = id.startsWith('@/') ? 'web/' + id.slice(2) : id.startsWith('@backend/') ? 'backend/src/' + id.slice(9) : null
  if (!base) throw Error('Unknown module ' + id)
  const file = ['.ts', '.tsx'].map(ext => base + ext).find(name => fs.existsSync(name))
  if (!file) throw Error('Missing module ' + id)
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText
  define(id, code); for (const match of code.matchAll(/require\(["']([^"']+)["']\)/g)) include(resolve(id, match[1]))
 }
 include('@/features/campeonatos/estrutura-avancada/EditionLifecycleStatus')
 return `const factories={},cache={},process={env:{NODE_ENV:'development'}};function define(id,factory){factories[id]=factory}function require(id){if(cache[id])return cache[id].exports;const m=cache[id]={exports:{}};factories[id](v=>{if(!v.startsWith('.'))return require(v);const parts=id.split('/').slice(0,-1);for(const s of v.split('/')){if(s==='..')parts.pop();else if(s!=='.')parts.push(s)}return require(parts.join('/'))},m,m.exports);return m.exports}
 ${definitions.join('\n')}
 const React=require('react'),root=require('react-dom/client').createRoot(document.getElementById('root')),flush=require('react-dom').flushSync;
 window.renderLifecycle=id=>flush(()=>root.render(React.createElement(require('@/features/campeonatos/estrutura-avancada/EditionLifecycleStatus').EditionLifecycleStatus,{championshipId:id})));
 window.unmountLifecycle=()=>flush(()=>root.render(null));
 const realFetch=window.fetch.bind(window);window.pauseNextLifecycle=false;window.fetch=async(...args)=>{const pause=window.pauseNextLifecycle;window.pauseNextLifecycle=false;const response=await realFetch(...args);if(pause){window.lifecyclePaused=true;await new Promise(resolve=>window.releaseLifecycleRead=resolve)}return response};`
}
let source: string | undefined
export async function mountLifecycle(page: Page, championshipId: string) {
 await page.route('**/__lifecycle-harness', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="pt-BR"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div></body></html>' }))
 await page.goto('/__lifecycle-harness'); await page.addScriptTag({ content: source ||= bundle() }); await page.evaluate(id => (window as any).renderLifecycle(id), championshipId)
}
