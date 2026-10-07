import test from 'node:test';import assert from 'node:assert/strict';
import {parseUpgradeHistory,duration,observationWindow,withinObservationWindow} from '../juno-upgrade-history.mjs';
const upgrade={id:'juno-v31',chainId:'juno-1',height:42452000},address='A'.repeat(40);
function fixture(){return {schema:1,upgradeId:upgrade.id,chainId:upgrade.chainId,upgradeHeight:upgrade.height,halt:{height:upgrade.height,hash:'B'.repeat(64),time:'2026-10-07T06:56:31Z'},scannedThrough:42452010,scannedHash:'C'.repeat(64),updatedAt:'2026-10-07T08:00:00Z',validators:[{address}],firstSignatures:{[address]:{height:42452002,blockHash:'D'.repeat(64),timestamp:'2026-10-07T07:53:31Z',secondsFromHalt:3420,blocksAfterRestart:1,signature:Buffer.alloc(64).toString('base64')}},complete:true};}
test('first-signature duration includes halt and is distinct from block offset',()=>{const parsed=parseUpgradeHistory(fixture(),upgrade),record=parsed.records.get(address);assert.equal(duration(record.secondsFromHalt),'57m 0s');assert.equal(record.blocksAfterRestart,1);assert.equal(duration(null),'—');});
test('not observed is retained without a zero-duration claim',()=>{const f=fixture();f.firstSignatures[address]=null;f.complete=false;assert.equal(parseUpgradeHistory(f,upgrade).records.get(address),null);});
test('wrong upgrade, fabricated timing, invalid height and incomplete identities fail',()=>{
 for(const change of [f=>f.upgradeId='juno-v32',f=>f.firstSignatures[address].secondsFromHalt=0,f=>f.firstSignatures[address].height=42452011,f=>f.firstSignatures[address].blocksAfterRestart=0,f=>delete f.firstSignatures[address],f=>f.validators.push(f.validators[0])]){const f=fixture();change(f);assert.throws(()=>parseUpgradeHistory(f,upgrade));}
});

test('five-hour window includes the boundary and excludes later evidence without mutating the archive',()=>{
 const f=fixture();f.scannedBlockTime='2026-10-07T12:10:00Z';const w=observationWindow(f,18000);
 assert.equal(new Date(w.end).toISOString(),'2026-10-07T11:56:31.000Z');assert.equal(w.coverageComplete,true);
 const boundary={timestamp:new Date(w.end).toISOString()},late={timestamp:new Date(w.end+1).toISOString()};
 assert.equal(withinObservationWindow(boundary,w),boundary);assert.equal(withinObservationWindow(late,w),null);
 assert.equal(withinObservationWindow(null,w),null);assert.equal(withinObservationWindow({timestamp:'bad'},w),null);
 assert.equal(withinObservationWindow({timestamp:new Date(w.start-1).toISOString()},w),null);
 assert.equal(late.timestamp,new Date(w.end+1).toISOString());
 for(const seconds of [0,-1,Infinity,86401])assert.throws(()=>observationWindow(f,seconds));
 assert.throws(()=>observationWindow({},18000));
});
test('closed is distinct from complete scan coverage or finding all validators',()=>{
 const f=fixture();f.complete=false;f.firstSignatures[address]=null;
 assert.equal(observationWindow(f,18000).coverageComplete,false);
 f.scannedBlockTime='2026-10-07T11:56:30Z';assert.equal(observationWindow(f,18000).coverageComplete,false);
 f.scannedBlockTime='2026-10-07T11:56:31Z';assert.equal(observationWindow(f,18000).coverageComplete,true);
});
