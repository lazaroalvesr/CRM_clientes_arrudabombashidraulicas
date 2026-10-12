import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomInt } from 'node:crypto';
import { createApp } from '../server.mjs';

test('WhatsApp interno vincula mensagem ao lead e ao vendedor', async () => {
  const port = randomInt(35000, 49999);
  const origin = `http://127.0.0.1:${port}`;
  const dataDir = mkdtempSync(path.join(os.tmpdir(), 'arruda-whatsapp-test-'));
  let inbound;
  const sent = [];
  const bridge = {
    setInboundHandler(handler) { inbound = handler; },
    async state() { return { status:'connected', qr:'data:image/png;base64,test', phone:'5511999999999' }; },
    async send(number, body) { sent.push({number,body}); return {messageId:'out-1',sentAt:new Date().toISOString()}; }
  };
  const app = createApp({ port, origin, dataDir, whatsappBridge:bridge });
  await new Promise(resolve => app.server.listen(port, '127.0.0.1', resolve));
  let cookie = '';
  async function request(route, method='GET', body) {
    const response = await fetch(origin+'/api'+route,{method,headers:{Origin:origin,'X-Arruda-Request':'1','Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:body===undefined?undefined:JSON.stringify(body)});
    if(response.headers.get('set-cookie')) cookie=response.headers.get('set-cookie').split(';')[0];
    return {status:response.status,body:await response.json()};
  }
  try {
    assert.equal((await request('/whatsapp/status')).status,401);
    assert.equal((await request('/setup','POST',{name:'Administrador Teste',email:'admin@example.test',password:'senha temporaria segura'})).status,201);
    const company = await request('/companies','POST',{name:'Empresa sintética WhatsApp',city:'Campinas',state:'SP',segment:'Concreteira',size:'Médio',sourceUrl:'https://example.test/fonte',whatsapp:'5511999999999'});
    assert.equal(company.status,201);
    assert.equal((await request('/leads','POST',{companyId:company.body.id})).status,200);
    const status = await request('/whatsapp/status');
    assert.equal(status.body.status,'connected');
    assert.match(status.body.qr,/^data:image/);
    assert.equal((await request(`/whatsapp/leads/${company.body.id}`)).body.messages.length,0);
    const inboxBefore = await request('/whatsapp/conversations');
    assert.equal(inboxBefore.body.conversations.length,1);
    assert.equal(inboxBefore.body.conversations[0].name,'Empresa sintética WhatsApp');
    assert.equal(inboxBefore.body.conversations[0].lastBody,null);
    assert.equal((await request(`/whatsapp/leads/${company.body.id}`,'POST',{text:'Olá, tudo bem?'})).status,200);
    assert.deepEqual(sent,[{number:'5511999999999',body:'Olá, tudo bem?'}]);
    await inbound({phone:'5511999999999',messageId:'in-1',body:'Tudo bem!',timestamp:new Date().toISOString()});
    const conversation = await request(`/whatsapp/leads/${company.body.id}`);
    assert.equal(conversation.body.messages.length,2);
    assert.equal(conversation.body.messages[0].userName,'Administrador Teste');
    assert.equal(conversation.body.messages[1].body,'Tudo bem!');
    const inboxAfter = await request('/whatsapp/conversations');
    assert.equal(inboxAfter.body.conversations[0].lastBody,'Tudo bem!');
    assert.equal(inboxAfter.body.conversations[0].lastDirection,'in');
    assert.equal((await request(`/whatsapp/leads/${company.body.id}`,'POST',{text:''})).status,400);
    assert.equal((await request('/users','POST',{name:'Vendedor Teste',email:'seller@example.test',password:'provisoria-segura',role:'seller'})).status,201);
    assert.equal((await request('/login','POST',{email:'seller@example.test',password:'provisoria-segura'})).status,200);
    assert.equal((await request('/password','POST',{currentPassword:'provisoria-segura',password:'senha-definitiva-segura'})).status,200);
    assert.equal((await request('/whatsapp/conversations')).body.conversations.length,0);
    assert.equal((await request(`/whatsapp/leads/${company.body.id}`)).status,404);
  } finally {
    await new Promise(resolve => app.server.close(resolve));
    app.db.close();
  }
});
