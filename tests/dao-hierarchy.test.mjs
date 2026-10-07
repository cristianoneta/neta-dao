import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {unitsFor,resolveSelection,selectionParams,structureFor} from '../dao-hierarchy.mjs';
import {consolidateSnapshots,consolidateHistory,summarizeOrganization,eliminateInternalTransfers} from '../treasury-consolidation.mjs';
import {period,usdUnits} from '../treasury-pnl.mjs';
const inventory=JSON.parse(readFileSync(new URL('../data/dao-directory.json',import.meta.url)));
const {daos,organizations}=inventory, neta=organizations.find(o=>o.id==='neta'),units=unitsFor(neta,daos);
const read=name=>JSON.parse(readFileSync(new URL('../data/treasury/'+name,import.meta.url)));
const now=Date.parse('2026-10-06T14:00:00Z'),range=period(2026,10,new Date(now));
function sources(){return units.map(dao=>{
 const data=read(dao.accountingSource.file);data.last_success_at=new Date(now).toISOString();data.refresh_status='completed';
 data.entries=dao.id==='neta'?data.entries.filter(r=>r.tx_hash==='85689A2C75DE86829D4116FA0AABBA5062D269679CA139984E169E8E2ACF8DC1'):[];
 const receipt=data.entries[0];
 data.movement_review={status:'PARTIAL',event_refresh_status:'PARTIAL',accounting_start:'2026-10-01T00:00:00Z',unreviewed_movements:0,matched_receipts:data.entries.length,unmatched_receipt_ids:[],movements:receipt?[{id:receipt.id,tx_hash:receipt.tx_hash,timestamp:receipt.timestamp,denom:`cw20:${receipt.token}`,direction:'in',raw_amount:receipt.raw_amount,counterparty:receipt.registry,classification:receipt.category,usd_value:receipt.usd_value,receipt_id:receipt.id}]:[]};
 if(dao.id!=='neta'){data.coverage_gaps=[];data.execution_candidates=[];data.sources=dao.accountingSource.treasuries.map(t=>({...t,adapter:'cosmos-rest-receipts',accounting_start:'2026-10-01T00:00:00Z',last_scanned_height:100,anchor_hash:'A'.repeat(64)}))}
 return{dao,data};
})}
test('formal NETA hierarchy is explicit, Main first; legacy and canonical links retain units',()=>{
 assert.deepEqual(units.map(d=>d.unitName),['Main','Operations']);
 assert.equal(units[1].parentRelationship,'organizational');
 const more=[...daos,{...units[1],id:'z',unitName:'Zulu'},{...units[1],id:'a',unitName:'Alpha'}];
 assert.deepEqual(unitsFor(neta,more).map(d=>d.unitName),['Main','Alpha','Operations','Zulu']);
 for(const [query,id,consolidated] of [['dao=neta','neta',true],['dao=neta&subdao=main','neta',false],['dao=neta-operations','neta-operations',false],['dao=neta&subdao=neta-operations','neta-operations',false],['dao=juno&subdao=neta-operations','juno',true]]){
  const result=resolveSelection(new URLSearchParams(query),organizations,daos);assert.equal(result.dao.id,id);assert.equal(result.consolidated,consolidated);
  const again=resolveSelection(selectionParams(result),organizations,daos);assert.equal(again.dao.id,id);assert.equal(again.consolidated,consolidated);
 }
 assert.equal(resolveSelection(new URLSearchParams(),organizations,daos).consolidated,true);
});
test('consolidation preserves custody positions, missing units, stale dates and rejects overlaps',()=>{
 // Bot snapshots advance daily; pin only the fixture clock for freshness checks.
 const sources=units.map(dao=>({dao,data:{...read(dao.snapshot),generated_at:new Date(now).toISOString()},history:read(dao.history)}));
 const result=consolidateSnapshots(sources,now);
 assert.ok(result.components.every(s=>!s.stale));
 assert.equal(result.loaded,2);assert.equal(result.assets.length,sources.reduce((n,s)=>n+s.data.assets.length,0));
 assert.ok(result.assets.some(a=>a.unit_name==='Operations'&&a.source_chain==='osmosis'));
 assert.ok(result.assets.some(a=>a.unit_name==='Main'));
 assert.ok(Math.abs(result.total_usd-sources.reduce((n,s)=>n+Number(s.data.total_usd),0))<.00001);
 assert.throws(()=>consolidateSnapshots([sources[0],sources[0]],now),/Overlapping/);
 const broken=structuredClone(sources);broken[1].data.treasury_address='foreign';
 const partial=consolidateSnapshots(broken,now);assert.equal(partial.loaded,1);assert.ok(partial.warnings.some(w=>w.includes('Missing assets are not zero')));
 assert.equal(consolidateHistory(partial.components).length,0);
 assert.ok(consolidateSnapshots(sources,now+86400000).components.every(s=>s.stale));
 const duplicated=structuredClone(sources);duplicated[1].data.assets.push(duplicated[1].data.assets[0]);
 assert.equal(consolidateSnapshots(duplicated,now).loaded,1);
});
test('consolidated daily history uses common UTC days only and independent position keys',()=>{
 const sources=units.map((dao,i)=>({dao,data:{generated_at:'2026-10-06T12:00:00Z',total_usd:20+i,assets:[{key:'juno:coin',usd_value:20+i}]},history:{snapshots:[{generated_at:i?'2026-10-05T10:00:00Z':'2026-10-04T10:00:00Z',total_usd:1,assets:[]}]}}));
 const rows=consolidateHistory(sources);assert.equal(rows.length,1);assert.equal(rows[0].total_usd,41);assert.equal(new Set(rows[0].assets.map(a=>a.key)).size,2);
});
test('organization totals require every source; known receipts stay partial when one source fails',()=>{
 const data=sources(),sum=summarizeOrganization(data,range,now);
 assert.equal(sum.provisional,true);assert.equal(sum.income,usdUnits('5.000000976594010594'));assert.equal(sum.expenses,0n);
 data[1].data=null;const missing=summarizeOrganization(data,range,now);
 assert.equal(missing.income,null);assert.equal(missing.result,null);assert.equal(missing.categories.find(a=>a.id==='nns_registration').observed,sum.income);
});
function transfers(){
 const data=sources(),hash='A'.repeat(64),timestamp='2026-10-06T12:00:00Z';
 data.forEach((s,i)=>{const r=s.data.movement_review;r.movements.push({id:`juno-1:${hash}:99`,chain_id:'juno-1',treasury_address:s.dao.core,tx_hash:hash,timestamp,denom:'ujuno',raw_amount:'1000000',direction:i?'in':'out',counterparty:data[1-i].dao.core,classification:'unreviewed',receipt_id:null,usd_value:null});r.unreviewed_movements++});
 return data;
}
test('exact internal transfer pairs are eliminated only in the group, unknown or ambiguous legs block totals',()=>{
 const data=transfers(),before=JSON.stringify(data),result=summarizeOrganization(data,range,now);
 assert.equal(result.eliminatedPairs,1);assert.equal(result.provisional,true);assert.equal(result.expenses,0n);assert.equal(JSON.stringify(data),before);
 for(const mutate of [d=>d[1].data.movement_review.movements.at(-1).raw_amount='999999',d=>d[1].data.movement_review.movements.at(-1).chain_id='osmosis-1',d=>{const r=d[0].data.movement_review;r.movements.push({...r.movements.at(-1),id:'duplicate'});r.unreviewed_movements++}]){
  const broken=transfers();mutate(broken);const s=summarizeOrganization(broken,range,now);assert.equal(s.eliminatedPairs,0);assert.equal(s.result,null);
 }
});
test('Juno Community Pool and Delegation Programme preserve separate custody and tax accounts',()=>{
 const org=organizations.find(o=>o.id==='juno'),junoUnits=unitsFor(org,daos);
 assert.deepEqual(junoUnits.map(d=>d.unitName),['Community Pool','Delegation Programme']);
 const selection=resolveSelection(new URLSearchParams('dao=juno&subdao=main'),organizations,daos);
 assert.equal(selection.dao.id,'juno');assert.equal(selection.consolidated,false);
 const other=resolveSelection(new URLSearchParams('dao=juno&subdao=juno-delegation'),organizations,daos);
 assert.equal(other.dao.core,'juno1nmezpepv3lx45mndyctz2lzqxa6d9xzd2xumkxf7a6r4nxt0y95qypm6c0');
 const input=junoUnits.map(dao=>({dao,data:read(dao.snapshot)})),sum=consolidateSnapshots(input,now);
 assert.equal(sum.loaded,2);
 assert.ok(Math.abs(sum.total_usd-input.reduce((n,s)=>n+Number(s.data.total_usd),0))<1e-6);
 assert.ok(sum.assets.some(a=>a.position==='Delegated'));
 assert.ok(sum.assets.some(a=>a.position==='Claimable rewards'));
 const partial=consolidateSnapshots([input[0],{dao:junoUnits[1],error:'Unavailable'}],now);
 assert.equal(partial.loaded,1);assert.ok(partial.warnings.some(w=>w.includes('Missing assets are not zero')));
 const report=summarizeOrganization(junoUnits.map(dao=>({dao,data:read(dao.accountingSource.file)})),range,now);
 assert.equal(report.income,null);assert.equal(report.result,null);
 assert.ok(report.categories.some(a=>a.id==='community_tax'));
 assert.ok(report.categories.some(a=>a.id==='other_income'));
 assert.ok(!report.categories.some(a=>a.id.startsWith('nns_')));
});

test('structure follows explicit parents across branches and levels; malformed graphs fail closed',()=>{
 const children=[...daos,{...units[1],id:'alpha',unitName:'Alpha',parentDaoId:'neta'}, {...units[1],id:'nested',unitName:'Nested',parentDaoId:'neta-operations'}];
 const graph=structureFor(neta,children);
 assert.deepEqual(graph.roots.map(n=>n.dao.id),['neta']);
 assert.deepEqual(graph.roots[0].children.map(n=>n.dao.id),['alpha','neta-operations']);
 assert.equal(graph.roots[0].children[1].children[0].dao.id,'nested');
 assert.equal(graph.units.length,4);
 assert.throws(()=>structureFor(neta,[...daos,{...units[1],id:'outside',parentDaoId:'juno'}]),/outside/);
 assert.throws(()=>structureFor(neta,[...daos,{...units[1],id:'self',parentDaoId:'self'}]),/Circular/);
 assert.throws(()=>structureFor(neta,[...daos,{...units[1],id:'a',parentDaoId:'b'},{...units[1],id:'b',parentDaoId:'a'}]),/Circular/);
 assert.throws(()=>structureFor(neta,[...daos,units[0]]),/Duplicate/);
 assert.equal(structureFor(neta,[...daos,{...units[1],id:'independent',parentDaoId:null}]).roots.length,2);
});
