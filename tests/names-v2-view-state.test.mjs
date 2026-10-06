import test from 'node:test';
import assert from 'node:assert/strict';
import {readNamesIntent,nameState,NAME_GRACE,intentLabel} from '../names-v2-view-state.mjs';
const deployment={chain_id:'juno-1',registry:'registry'},owner='owner';
const saved={schema:1,chain_id:'juno-1',registry:'registry',owner,name:'name.neta',phase:'payment_pending',salt:'preserve',request:{intentId:'exact'}};
const storage=raw=>({getItem:key=>{assert.equal(key,'neta-nns-v2-intent:juno-1:registry:owner');return raw;},setItem(){throw Error('Read must never write');},removeItem(){throw Error('Read must never remove');}});
test('pending display is scoped, read-only and preserves the exact saved journal',()=>{
 const raw=JSON.stringify(saved);assert.deepEqual(readNamesIntent(storage(raw),deployment,owner),saved);
 assert.match(intentLabel(saved),/outcome needs checking/);
 assert.equal(readNamesIntent(storage(null),deployment,owner),null);
 for(const change of [{owner:'other'},{chain_id:'uni-7'},{registry:'other'},{phase:'unknown'},{schema:2},{name:null}])assert.throws(()=>readNamesIntent(storage(JSON.stringify({...saved,...change})),deployment,owner),/unknown format/);
 assert.throws(()=>readNamesIntent(storage('{'),deployment,owner),/could not be read/);
});
test('name lifecycle has exact grace boundaries and rejects transferred or malformed identities',()=>{
 const record={name:'name.neta',owner,generation:1,ownership_revision:1,expires_at:100};
 assert.equal(nameState(record,owner,99),'active');assert.equal(nameState(record,owner,100),'grace');
 assert.equal(nameState(record,owner,100+NAME_GRACE-1),'grace');assert.equal(nameState(record,owner,100+NAME_GRACE),'released');
 assert.equal(nameState(record,'another',99),null);
 assert.throws(()=>nameState({...record,generation:0},owner,99),/incomplete/);
});
