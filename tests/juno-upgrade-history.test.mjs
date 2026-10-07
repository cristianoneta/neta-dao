import test from 'node:test';import assert from 'node:assert/strict';
import {parseUpgradeHistory,duration} from '../juno-upgrade-history.mjs';
const upgrade={id:'juno-v31',chainId:'juno-1',height:42452000},address='A'.repeat(40);
function fixture(){return {schema:1,upgradeId:upgrade.id,chainId:upgrade.chainId,upgradeHeight:upgrade.height,halt:{height:upgrade.height,hash:'B'.repeat(64),time:'2026-10-07T06:56:31Z'},scannedThrough:42452010,scannedHash:'C'.repeat(64),updatedAt:'2026-10-07T08:00:00Z',validators:[{address}],firstSignatures:{[address]:{height:42452002,blockHash:'D'.repeat(64),timestamp:'2026-10-07T07:53:31Z',secondsFromHalt:3420,blocksAfterRestart:1,signature:Buffer.alloc(64).toString('base64')}},complete:true};}
test('first-signature duration includes halt and is distinct from block offset',()=>{const parsed=parseUpgradeHistory(fixture(),upgrade),record=parsed.records.get(address);assert.equal(duration(record.secondsFromHalt),'57m 0s');assert.equal(record.blocksAfterRestart,1);assert.equal(duration(null),'—');});
test('not observed is retained without a zero-duration claim',()=>{const f=fixture();f.firstSignatures[address]=null;f.complete=false;assert.equal(parseUpgradeHistory(f,upgrade).records.get(address),null);});
test('wrong upgrade, fabricated timing, invalid height and incomplete identities fail',()=>{
 for(const change of [f=>f.upgradeId='juno-v32',f=>f.firstSignatures[address].secondsFromHalt=0,f=>f.firstSignatures[address].height=42452011,f=>f.firstSignatures[address].blocksAfterRestart=0,f=>delete f.firstSignatures[address],f=>f.validators.push(f.validators[0])]){const f=fixture();change(f);assert.throws(()=>parseUpgradeHistory(f,upgrade));}
});
