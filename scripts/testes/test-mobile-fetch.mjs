import assert from 'node:assert/strict'
import http from 'node:http'
import { fixtureLoader } from './ts-fixture-loader.mjs'

const server = http.createServer((req,res) => {
  const reply = () => { if(!res.destroyed) { res.writeHead(req.url==='/error'?403:200,{'Content-Type':'application/json'}); res.end(JSON.stringify(req.url==='/error'?{error:'Permissão negada'}:{ok:true})) } }
  if(req.url==='/slow') { const timer=setTimeout(reply,150); res.once('close',()=>clearTimeout(timer)) }
  else if(req.url==='/body') { res.writeHead(200,{'Content-Type':'application/json'}); res.write('{'); const timer=setTimeout(()=>res.end('"ok":true}'),150); res.once('close',()=>clearTimeout(timer)) }
  else reply()
})
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
const {dropzoneFetch}=fixtureLoader({'@/config/env':{apiUrl:path=>`http://127.0.0.1:${server.address().port}${path}`}})('app/src/lib/api.ts')
const {money,prizeLabel,toChampionshipCard}=fixtureLoader()('app/src/lib/vacancies.ts')
try {
  for (const value of [undefined,null,'','  ','invalid',-1,Infinity,NaN,false,true,{},[]]) {
    assert.equal(money(value),'Sob consulta')
    assert.equal(toChampionshipCard({valor_inscricao:value,premiacao:value}).priceLabel,'Sob consulta')
    assert.equal(prizeLabel({premiacao:value}),'Sem premiação informada')
  }
  for (const value of [0,'0','0.00']) assert.equal(money(value),'Grátis')
  assert.match(money('30.50'),/30,50/)
  assert.equal(prizeLabel({premiacao:0}),'Sem premiação informada')
  assert.equal(prizeLabel({descricao_premiacao:'  Troféu  ',premiacao:100}),'Troféu')
  assert.deepEqual(await dropzoneFetch('/ok'),{ok:true})
  await assert.rejects(()=>dropzoneFetch('/error'),/Permissão negada/)
  const active=new AbortController()
  await assert.rejects(()=>dropzoneFetch('/slow',{signal:active.signal,timeoutMs:30}),/Tempo esgotado/)
  await assert.rejects(()=>dropzoneFetch('/body',{signal:active.signal,timeoutMs:30}),/Tempo esgotado/)
  const cancelled=new AbortController(); const pending=dropzoneFetch('/slow',{signal:cancelled.signal}); cancelled.abort()
  await assert.rejects(()=>pending,error=>error.name==='AbortError')
  await assert.rejects(()=>dropzoneFetch('/ok',{signal:cancelled.signal}),error=>error.name==='AbortError')
  console.log('Mobile fetch/card passed: success, HTTP errors, timeout with external signal, body timeout, cancellation, unknown price versus free registration and independent prize labels.')
} finally { server.closeAllConnections(); await new Promise(resolve=>server.close(resolve)) }
