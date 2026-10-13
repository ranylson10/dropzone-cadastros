import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
export function webComponentBundle(entry,exportName){
 const definitions=[],known=new Set(),define=(name,source)=>{new Function('require','module','exports',source);known.add(name);definitions.push(`define(${JSON.stringify(name)},function(require,module,exports){${source}\n});`)}
 for(const [name,file]of Object.entries({react:'react/cjs/react.development.js','react/jsx-runtime':'react/cjs/react-jsx-runtime.development.js','react-dom':'react-dom/cjs/react-dom.development.js','react-dom/client':'react-dom/cjs/react-dom-client.development.js',scheduler:'scheduler/cjs/scheduler.development.js'}))define(name,fs.readFileSync(path.join('node_modules',file),'utf8'))
 define('lucide-react',`module.exports=new Proxy({}, {get:(_,name)=>name==='__esModule'?true:()=>null});`)
 define('web/components/ui',`module.exports={...require('web/components/ui/Field'),...require('web/components/ui/Form')};`)
 const resolve=(parent,value)=>value.startsWith('@/')?'web/'+value.slice(2):value.startsWith('.')?path.posix.normalize(path.posix.join(path.posix.dirname(parent),value)):value
 function include(name){if(known.has(name))return;const file=['.ts','.tsx'].map(ext=>name+ext).find(file=>fs.existsSync(file));if(!file)throw Error('Missing fixture import '+name);const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;define(name,code);for(const m of code.matchAll(/require\(["']([^"']+)["']\)/g))include(resolve(name,m[1]))}include(entry);include('web/components/ui/Form')
 return `const factories={},cache={},process={env:{NODE_ENV:'development'}};function define(id,fn){factories[id]=fn}function require(id){if(cache[id])return cache[id].exports;const m=cache[id]={exports:{}};factories[id](v=>{if(v.startsWith('@/'))return require('web/'+v.slice(2));if(!v.startsWith('.'))return require(v);const parts=id.split('/').slice(0,-1);for(const x of v.split('/')){if(x==='..')parts.pop();else if(x!=='.')parts.push(x)}return require(parts.join('/'))},m,m.exports);return m.exports}${definitions.join('\n')}
 const React=require('react'),root=require('react-dom/client').createRoot(document.getElementById('root'));require('react-dom').flushSync(()=>root.render(React.createElement(require(${JSON.stringify(entry)})[${JSON.stringify(exportName)}])));window.unmountFixture=()=>require('react-dom').flushSync(()=>root.render(null));`
}
