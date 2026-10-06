import test from 'node:test';
import assert from 'node:assert/strict';
import {sealDaoEnvelope,openDaoEnvelope,sessionId,sendDaoReady} from '../relay-dao-protocol.mjs';
import {groupDaoConversations,configurationProposal,DAO_INBOX_DEPLOYMENT} from '../relay-dao-inbox.mjs';
import {DaoInboxClient} from '../relay-dao-client.mjs';
const a='juno1'+'a'.repeat(38),b='juno1'+'b'.repeat(38),c='juno1'+'c'.repeat(38),contract='juno1'+'d'.repeat(38),name='operations.dao.neta';
const meta={chain:'uni-7',contract,name,revision:2,correspondent:a,reply:false,sender:a,senderGeneration:1,senderFingerprint:'aa'.repeat(32),recipient:b,recipientGeneration:1,recipientFingerprint:'bb'.repeat(32),messageId:'11'.repeat(32)};
test('DAO encrypted envelopes bind mailbox, actor, recipient, generations and reply direction',()=>{
 const raw=sealDaoEnvelope(meta,'private evidence');assert.equal(openDaoEnvelope(raw,meta,meta.senderFingerprint),'private evidence');
 for(const change of [{name:'another.dao.neta'},{revision:3},{reply:true},{contract:c},{recipient:c},{recipientGeneration:2},{senderGeneration:2},{messageId:'22'.repeat(32)}])assert.throws(()=>openDaoEnvelope(raw,{...meta,...change},meta.senderFingerprint));
 assert.throws(()=>openDaoEnvelope(raw,meta,'cc'.repeat(32)));assert.throws(()=>sealDaoEnvelope({...meta,chain:'juno-1'},'mainnet'));
 assert.notEqual(sessionId(meta,b,1),sessionId({...meta,name:'other.dao.neta'},b,1));
});
test('sender grouping has one row for 100 messages and preserves chronological replies',()=>{
 const rows=Array.from({length:100},(_,i)=>({sequence:100-i,correspondent:a,author:i%2?a:b,reply:i%2===0}));
 const grouped=groupDaoConversations([...rows,rows[0],{sequence:101,correspondent:c}]);assert.equal(grouped.length,2);assert.equal(grouped[1].messages.length,100);assert.equal(grouped[1].messages[0].sequence,1);assert.equal(grouped[0].address,c);
});
test('configuration is an explicit DAO-executed proposal and production remains unconfigured',()=>{
 assert.equal(DAO_INBOX_DEPLOYMENT,null);const p=configurationProposal({contract,identity:{name,revision:2},enabled:true,readers:{selected:[b]},managers:[b]});assert.deepEqual(p.msg.dao.configure.readers,{selected:[b]});assert.equal(p.msg.dao.configure.expected_revision,2);assert.deepEqual(p.funds,[]);
 assert.throws(()=>configurationProposal({contract,identity:{name,revision:2},enabled:true,readers:{selected:[b,b]},managers:[]}));
 assert.throws(()=>new DaoInboxClient({deployment:{chain_id:'juno-1'},account:()=>a}));
});
function transport(){
 let account=a,sent=null,executions=0,roster={name,revision:2,recipients:[{address:b,device:{active:true,generation:1,fingerprint:meta.recipientFingerprint,prekeys:[{id:1}]}},{address:c,device:{active:true,generation:1,fingerprint:'cc'.repeat(32),prekeys:[{id:1}]}}]};
 const deliveries=roster.recipients.map(r=>({recipient:r.address,generation:1,fingerprint:r.device.fingerprint,prekey_id:1,ciphertext:Buffer.alloc(80,42).toString('base64')}));
 const packet={chain:'uni-7',contract,actor:a,senderFingerprint:meta.senderFingerprint,message:{dao:{send:{name,expected_revision:2,sender_generation:1,message_id:meta.messageId,reply_to:null,expected_thread_revision:null,deliveries}}}};
 let blob=new TextEncoder().encode(JSON.stringify(packet));
 const outbox={reconcile:async(_id,lookup)=>{const n=await lookup();return n?{state:'confirmed',sequence:n}:{state:'ready',recipient:name,generation:2,ciphertext:blob};}};
 const args={outbox,id:meta.messageId,contract,account:async()=>account,verify:async()=>true,query:async q=>q.sent?sent:q.dao?.recipients?roster:q.device?{active:true,generation:1,fingerprint:meta.senderFingerprint}:null,execute:async()=>{executions++;sent=4;}};
 return {args,packet,setAccount:v=>account=v,setRoster:v=>roster=v,setBlob:v=>blob=v,setSent:v=>sent=v,executions:()=>executions,roster};
}
test('durable packet transport rejects departed readers and wallet changes without signing',async()=>{
 const t=transport();t.setRoster({...t.roster,recipients:t.roster.recipients.slice(0,1)});await assert.rejects(sendDaoReady(t.args),/recipient set changed/);assert.equal(t.executions(),0);
 const u=transport();u.setAccount(b);await assert.rejects(sendDaoReady(u.args),/scope mismatch/);assert.equal(u.executions(),0);
});
test('confirmed outbox reconciles without duplicate send; device changes fail closed',async()=>{
 const t=transport();assert.equal((await sendDaoReady(t.args)).sequence,4);assert.equal((await sendDaoReady(t.args)).sequence,4);assert.equal(t.executions(),1);
 const u=transport();u.roster.recipients[0].device.generation=2;await assert.rejects(sendDaoReady(u.args),/device changed/);assert.equal(u.executions(),0);
});
test('RPC uncertainty and a changed thread preserve pending ciphertext without execution',async()=>{
 const t=transport();t.args.query=async()=>{throw Error('RPC unavailable')};await assert.rejects(sendDaoReady(t.args),/RPC unavailable/);assert.equal(t.executions(),0);
 const u=transport();u.packet.message.dao.send.reply_to=c;u.packet.message.dao.send.expected_thread_revision=1;u.setBlob(new TextEncoder().encode(JSON.stringify(u.packet)));await assert.rejects(sendDaoReady(u.args),/conversation changed/);assert.equal(u.executions(),0);
});
function readClient(){
 let wallet=b,missing=false,badHash=false,enabled=true;const registry='juno1'+'f'.repeat(38),creator='juno1'+'g'.repeat(38);
 const box={name,enabled:true,authority:c,group:a,revision:2,managers:[b],readers:{selected:[b]}};
 const client=new DaoInboxClient({deployment:{chain_id:'uni-7',contract,registry,creator,code_hash:'aa'.repeat(32)},account:()=>wallet,fetch:async(url)=>{
  if(missing)throw Error('network offline');let data;
  if(url.endsWith('/node_info'))data={default_node_info:{network:'uni-7'}};
  else if(url.includes('/smart/')){const q=JSON.parse(Buffer.from(decodeURIComponent(url.split('/smart/')[1]),'base64').toString());data={data:q.dao.registry?registry:q.dao.mailboxes?{items:enabled?[box]:[],next:null}:q.dao.thread?{revision:1,status:'open',assignee:null}:q.dao.blocked?false:[]};}
  else if(url.includes('/code/'))data={code_info:{data_hash:badHash?'00'.repeat(32):'aa'.repeat(32)}};
  else data={contract_info:{creator,code_id:'1'}};
  return {ok:true,json:async()=>data};
 }});
 return {client,box,setWallet:v=>wallet=v,setMissing:v=>missing=v,setHash:v=>badHash=v,setEnabled:v=>enabled=v};
}
test('read adapter verifies chain/code/registry and never infers access from selected DAO',async()=>{
 const x=readClient();assert.equal((await x.client.list(b)).length,1);x.setEnabled(false);assert.equal((await x.client.list(b)).length,0);await assert.rejects(x.client.page(name),/access ended/);
 x.setEnabled(true);x.setHash(true);await assert.rejects(x.client.list(b),/identity mismatch/);x.setHash(false);x.setMissing(true);await assert.rejects(x.client.list(b),/verification unavailable/);
});
test('review cannot be submitted after authority, wallet, policy or payload changes',async()=>{
 const x=readClient();let sends=0;x.client.execute=async()=>sends++;const review=await x.client.blockDraft(name,a,true);
 x.box.revision++;await assert.rejects(x.client.submit(review),/review changed/);assert.equal(sends,0);x.box.revision--;
 x.setWallet(a);await assert.rejects(x.client.submit(review),/wallet changed/);assert.equal(sends,0);x.setWallet(b);
 x.box.managers=[];await assert.rejects(x.client.submit(review),/manager required/);assert.equal(sends,0);
 x.box.managers=[b];const tampered={...review,message:{...review.message,extra:'unexpected'}};await assert.rejects(x.client.submit(tampered),/review changed/);
 await x.client.submit(review);assert.equal(sends,1);
});
