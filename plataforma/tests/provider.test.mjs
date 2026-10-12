import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { randomInt } from 'node:crypto';
import path from 'node:path';
import os from 'node:os';
import { createApp } from '../server.mjs';

test('adaptador importa dados com fonte, ignora inválidos e não duplica resultados',async()=>{
 const port=randomInt(34000,49000),origin=`http://127.0.0.1:${port}`;
 let mode='ok', received;
 const entry={name:'Empresa sintética adaptador',city:'Campinas',state:'SP',segment:'Concreteira',size:'Médio',pumping:true,fleet:null,branches:false,sourceUrl:'https://example.test/evidencia'};
 const app=createApp({port,origin,dataDir:mkdtempSync(path.join(os.tmpdir(),'arruda-provider-')),providerUrl:'https://provider.example.test/search',providerKey:'test-only-key',providerFetch:async(endpoint,options)=>{
  received={endpoint,options};
  if(mode==='unavailable')return new Response('',{status:503});
  if(mode==='invalid')return new Response('not json');
  if(mode==='error')throw new Error('timeout');
  return new Response(JSON.stringify({companies:[entry,{...entry,name:'Inválido',sourceUrl:''}]}));
 }});
 await new Promise(r=>app.server.listen(port,'127.0.0.1',r));
 let cookie;
 const call=async(route,body)=>{const r=await fetch(origin+'/api'+route,{method:'POST',headers:{Origin:origin,Connection:'close','Content-Type':'application/json','X-Arruda-Request':'1',...(cookie?{Cookie:cookie}:{})},body:JSON.stringify(body)});if(r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];return{status:r.status,body:await r.json()}};
 try{
  assert.equal((await call('/setup',{name:'QA Adapter',email:'adapter@example.test',password:'test-password-long'})).status,201);
  const first=await call('/search',{state:'SP',segment:'Concreteira'});assert.equal(first.status,200);assert.equal(first.body.imported,1);assert.equal(first.body.skipped,1);assert.equal(first.body.companies[0].name,entry.name);assert.equal(first.body.companies[0].fleet,null);assert.equal(first.body.companies[0].pumping,1);assert.equal(received.options.headers.Authorization,'Bearer test-only-key');assert.equal(received.options.redirect,'error');assert.equal(JSON.parse(received.options.body).state,'SP');
  const repeat=await call('/search',{state:'SP'});assert.equal(repeat.body.imported,0);assert.equal(repeat.body.companies.length,1);
  for(const value of ['unavailable','invalid','error']){mode=value;const result=await call('/search',{state:'SP'});assert.equal(result.status,502)}
 }finally{await new Promise(r=>app.server.close(r));app.db.close()}
});

test('configuração inicial com chave rejeita acesso incorreto e criação simultânea',async()=>{
 const port=randomInt(34000,49000),origin=`http://127.0.0.1:${port}`;
 const app=createApp({port,origin,bootstrap:'fixture-bootstrap-secret',dataDir:mkdtempSync(path.join(os.tmpdir(),'arruda-setup-'))});await new Promise(r=>app.server.listen(port,'127.0.0.1',r));
 const call=async(email,token)=>{const r=await fetch(origin+'/api/setup',{method:'POST',headers:{Origin:origin,Connection:'close','Content-Type':'application/json','X-Arruda-Request':'1'},body:JSON.stringify({name:'QA Bootstrap',email,password:'fixture-password-long',token})});return r.status};
 try{assert.equal(await call('wrong@example.test','wrong'),403);const results=await Promise.all([call('a@example.test','fixture-bootstrap-secret'),call('b@example.test','fixture-bootstrap-secret')]);assert.deepEqual(results.sort(),[201,409]);assert.equal(app.db.prepare('SELECT count(*) n FROM users').get().n,1)}finally{await new Promise(r=>app.server.close(r));app.db.close()}
});
