import test from 'node:test';
import assert from 'node:assert/strict';
import {resolvePersonalContact,checkPersonalContact,contactInvitation,invitedContact} from '../relay-personal-contacts.mjs';
import {PERSONAL_MAINNET_POLICY} from '../relay-personal-network.mjs';
const alice='juno1z3xcalwan92yqxu9d406tlft9yy94jy8s5et57',bob='juno12jc8ekvrvml9jtk5pvl4tpddj5pep5m5hd8aqt';
function fixture(){
 const current={owner:alice,name:'alice.neta',expires_at:Math.floor(Date.now()/1000)+3600},reverse={name:'alice.neta',address:alice};
 const adapter={profile:{chain:'juno-1',policy:PERSONAL_MAINNET_POLICY},verify:async()=>'https://rpc.example',get:async(base,path)=>path.endsWith('/latest')?
  {block:{header:{chain_id:'juno-1',height:'99',time:new Date().toISOString()}}}:
  {data:JSON.parse(atob(decodeURIComponent(path.split('/').at(-1)))).identity?current:reverse}};
 return {current,reverse,adapter};
}
test('contact names resolve only to a consistent active registry identity',async()=>{
 const f=fixture();assert.deepEqual(await resolvePersonalContact(f.adapter,'alice.neta'),{name:'alice.neta',address:alice});
 f.current.expires_at=0;await assert.rejects(resolvePersonalContact(f.adapter,'alice.neta'),/expired/);
 f.current.expires_at=Math.floor(Date.now()/1000)+3600;f.reverse.name='other.neta';await assert.rejects(resolvePersonalContact(f.adapter,'alice.neta'),/changed/);
});
test('a transferred name invalidates the saved destination instead of silently retargeting it',async()=>{
 const f=fixture();await checkPersonalContact(f.adapter,'alice.neta',alice);f.current.owner=bob;f.reverse.address=bob;
 await assert.rejects(checkPersonalContact(f.adapter,'alice.neta',alice),/changed/);
});
test('address entry and invitations validate checksums and carry no permissions or release pins',async()=>{
 assert.deepEqual(await resolvePersonalContact({},alice),{name:null,address:alice});
 await assert.rejects(resolvePersonalContact({},alice.slice(0,-1)+'q'));
 const link=contactInvitation({href:'https://dao.netareborn.com/index.html?secret=discard#treasury'},alice);
 const u=new URL(link);assert.deepEqual([...u.searchParams.keys()],['relayContact']);assert.equal(u.hash,'#relay');
 assert.equal(invitedContact({href:link}),alice);assert.equal(invitedContact({href:link.replace(alice,'not-an-address')}),'');
});
