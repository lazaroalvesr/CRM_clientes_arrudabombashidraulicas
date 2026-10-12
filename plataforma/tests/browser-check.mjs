import { createApp } from '../server.mjs';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

const { chromium } = await import(pathToFileURL(process.argv[2]).href);
const review = path.resolve('../.impeccable/review'); mkdirSync(review,{recursive:true});
const app = createApp({port:31347,origin:'http://127.0.0.1:31347',dataDir:mkdtempSync(path.join(os.tmpdir(),'arruda-browser-'))});
await new Promise(r=>app.server.listen(31347,'127.0.0.1',r));
let browser;
try {
 browser=await chromium.launch({headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:31347');await page.getByRole('heading',{name:'Prepare sua equipe.'}).waitFor();
 await page.screenshot({path:path.join(review,'setup-desktop.png'),fullPage:true});
 await page.getByLabel('Seu nome').fill('Equipe de teste');await page.getByLabel('E-mail',{exact:true}).fill('qa@example.test');await page.getByLabel('Crie uma senha').fill('senha-de-teste-12345');await page.getByLabel('Confirme a senha').fill('senha-de-teste-12345');await page.getByRole('button',{name:'Criar administrador'}).click();
 await page.getByRole('heading',{name:'Encontre sua próxima oportunidade.'}).waitFor();
 await page.getByRole('heading',{name:'Vamos encontrar os primeiros clientes?'}).waitFor();
 await page.screenshot({path:path.join(review,'empty-desktop.png'),fullPage:true});
 await page.getByRole('button',{name:'Cadastrar primeira empresa',exact:true}).click();
 await page.getByLabel('Nome da empresa *',{exact:true}).fill('Exemplo QA · Concreto Interior');await page.getByLabel('Cidade *',{exact:true}).fill('Jundiaí');await page.getByLabel('Link da fonte consultada *').fill('https://example.test/qa');await page.getByLabel('Porte',{exact:true}).selectOption('Grande');await page.getByLabel('Trabalha com bombeamento?').selectOption('1');await page.getByLabel('Possui frota própria?').selectOption('1');
 await page.locator('#company-form').getByRole('button',{name:'Cadastrar empresa',exact:true}).click();
 await page.getByRole('heading',{name:'Exemplo QA · Concreto Interior'}).waitFor();
 await page.getByRole('button',{name:'Salvar lead',exact:true}).click();await page.getByRole('heading',{name:'Acompanhamento comercial'}).waitFor();
 await page.getByLabel('Etapa da prospecção').selectOption('Em contato');await page.getByLabel('Anotações da equipe').fill('Registro sintético de verificação da interface.');await page.getByRole('button',{name:'Salvar acompanhamento'}).click();
 await page.getByRole('button',{name:'Fechar',exact:true}).click();
 await page.evaluate(async()=>{for(const [name,city,state,segment,size,pumping,fleet,branches] of [
 ['Exemplo QA · Bombeamento Norte','Campinas','SP','Bombeamento de concreto','Grande',1,1,1],
 ['Exemplo QA · Concreto Vale','Sorocaba','SP','Concreteira','Médio',1,1,0],
 ['Exemplo QA · Obras Horizonte','São Paulo','SP','Construtora','Grande',null,1,1],
 ['Exemplo QA · Locação Industrial','Santos','SP','Locadora','Médio',null,1,0],
 ['Exemplo QA · Concreto Regional','Curitiba','PR','Concreteira','Pequeno',0,null,null]]){
  const res=await fetch('/api/companies',{method:'POST',headers:{'Content-Type':'application/json','X-Arruda-Request':'1'},body:JSON.stringify({name,city,state,segment,size,pumping,fleet,branches,sourceUrl:'https://example.test/qa',phone:'',whatsapp:'',structure:'Dados sintéticos exclusivos para testes.'})});if(!res.ok)throw new Error('Fixture failed');}});
 await page.getByRole('button',{name:'Buscar na base',exact:true}).click();await page.getByRole('button',{name:'Exemplo QA · Bombeamento Norte',exact:true}).waitFor();
 await page.evaluate(()=>document.querySelector('#toast').className='');await page.screenshot({path:path.join(review,'desktop.png'),fullPage:true});
 await page.getByRole('button',{name:'Exemplo QA · Concreto Interior',exact:true}).click();await page.screenshot({path:path.join(review,'detail-desktop.png'),fullPage:true});await page.getByRole('button',{name:'Fechar',exact:true}).click();
 await page.getByRole('button',{name:'Meus Leads',exact:true}).click();await page.getByRole('button',{name:'Exemplo QA · Concreto Interior',exact:true}).waitFor();assert.equal(await page.locator('tbody tr').count(),1);
 await page.getByRole('button',{name:'Usuários',exact:true}).click();await page.getByRole('button',{name:'Gerenciar',exact:false}).waitFor();await page.screenshot({path:path.join(review,'users-desktop.png'),fullPage:true});
 await page.getByRole('button',{name:'Encontrar empresas',exact:true}).click();await page.getByRole('button',{name:'Exemplo QA · Bombeamento Norte',exact:true}).waitFor();
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(review,'mobile.png'),fullPage:true});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth),false,'page must not overflow mobile');
 await page.getByRole('button',{name:'Abrir navegação'}).click();await page.getByRole('button',{name:'Meus Leads',exact:true}).click();await page.getByRole('button',{name:'Exemplo QA · Concreto Interior',exact:true}).waitFor();await page.getByRole('button',{name:'Exemplo QA · Concreto Interior',exact:true}).click();await page.screenshot({path:path.join(review,'detail-mobile.png'),fullPage:true});
 await page.getByRole('button',{name:'Fechar',exact:true}).click();
 assert.deepEqual(errors,[]);writeFileSync(path.join(review,'browser-results.json'),JSON.stringify({passed:true,errors,checks:['setup','empty state','company creation','lead saving','notes and status','shared leads','users view','mobile navigation','no page overflow'],syntheticData:true},null,2));console.log('Browser checks passed. Screenshots: '+review);
} finally {await browser?.close();await new Promise(r=>app.server.close(r));app.db.close()}
