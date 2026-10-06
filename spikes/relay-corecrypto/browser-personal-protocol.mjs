import assert from 'node:assert/strict';
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright';
const root=new URL('../../',import.meta.url);
const server=http.createServer(async(req,res)=>{
  const path=new URL(req.url,'http://localhost').pathname;
  if(path==='/fixture'){res.writeHead(200,{'content-type':'text/html'}).end('<!doctype html><title>Personal crypto fixture</title>');return;}
  try{res.writeHead(200,{'content-type':path.endsWith('.wasm')?'application/wasm':'text/javascript'}).end(await readFile(new URL('.'+path,root)));}catch{res.writeHead(404).end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin='http://127.0.0.1:'+server.address().port;
let browser;
try{
  browser=await chromium.launch({headless:true});
  const devices=[];
  for(const [label,letter,generation] of [['alice','q',1],['bob','p',1],['bob-new','p',2]]){
    const context=await browser.newContext(),page=await context.newPage();await page.goto(origin+'/fixture');
    const device=await page.evaluate(async({label,letter,generation})=>{
      const wire=await import('/assets/relay-crypto/corecrypto.js');await wire.initWasmModule('/assets/relay-crypto/index_bg.wasm');
      window.key=new wire.DatabaseKey(crypto.getRandomValues(new Uint8Array(32)));window.db=await wire.Database.open(label+'.db',key);window.cc=wire.CoreCrypto.new(db);
      await cc.transaction(ctx=>ctx.proteusInit());
      const fingerprint=await cc.transaction(ctx=>ctx.proteusFingerprint()),bytes=await cc.transaction(ctx=>ctx.proteusNewPrekey(1));
      return {address:'juno1'+letter.repeat(38),generation,fingerprint,device_id:label,protocol_version:1,active:true,prekeys:[{id:1,bundle:btoa(String.fromCharCode(...bytes))}]};
    },{label,letter,generation});devices.push({page,device});
  }
  const [alice,bob,bob2]=devices,scope={chain:'juno-1',contract:'juno1'+'a'.repeat(58)};
  const meta=(sender,recipient,n)=>({...scope,sender:sender.address,senderGeneration:sender.generation,senderFingerprint:sender.fingerprint,
    recipient:recipient.address,recipientGeneration:recipient.generation,recipientFingerprint:recipient.fingerprint,messageId:n.repeat(64)});
  const send=async(from,to,m,text)=>from.page.evaluate(async({recipient,meta,text})=>{
    const {encryptPersonal}=await import('/relay-personal-protocol.mjs');const packet=await cc.transaction(ctx=>encryptPersonal(ctx,meta,text,recipient));
    return {...packet,ciphertext:Array.from(packet.ciphertext)};
  },{recipient:to.device,meta:m,text});
  const read=async(to,m,packet)=>to.page.evaluate(async({meta,bytes})=>{const {decryptPersonal}=await import('/relay-personal-protocol.mjs');return cc.transaction(ctx=>decryptPersonal(ctx,meta,Uint8Array.from(bytes)));},{meta:m,bytes:packet.ciphertext});
  const first=meta(alice.device,bob.device,'1'),delayed=await send(alice,bob,first,'Unread on the previous device');
  const newMeta=meta(alice.device,bob2.device,'2'),newPacket=await send(alice,bob2,newMeta,'New generation');
  assert.equal(newPacket.prekey.id,1);assert.equal(await read(bob2,newMeta,newPacket),'New generation');
  assert.equal(await read(bob,first,delayed),'Unread on the previous device');
  const follow=meta(alice.device,bob.device,'3'),followPacket=await send(alice,bob,follow,'Old session still intact');
  assert.equal(followPacket.prekey,null);assert.equal(await read(bob,follow,followPacket),'Old session still intact');
  const reply=meta(bob2.device,alice.device,'4'),replyPacket=await send(bob2,alice,reply,'Reply from new device');
  assert.equal(replyPacket.prekey,null);assert.equal(await read(alice,reply,replyPacket),'Reply from new device');
  await assert.rejects(read(alice,reply,replyPacket));
  // Resolve the immutable sender generation, never substitute its current device.
  const historical=await bob.page.evaluate(async({row,old})=>{
    const {resolvePersonalSender}=await import('/relay-personal-protocol.mjs');
    return resolvePersonalSender({address:row.recipient,historicalDevice:async(address,generation)=>address===old.address&&generation===old.generation?old:null,
      device:()=>{throw Error('Must not use current identity');}},row);
  },{row:{recipient:bob.device.address,sender:alice.device.address,sender_generation:1},old:alice.device});
  assert.equal(historical.fingerprint,alice.device.fingerprint);
  console.log('Personal crypto: real CoreCrypto generation isolation, delayed old-generation read, reply, replay rejection and historical identity passed. Mock chain only.');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
