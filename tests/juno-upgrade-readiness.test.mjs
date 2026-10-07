import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {parseReadiness,readinessTimeline,firstParticipation} from '../juno-upgrade-readiness.mjs';
import {addCapture,inTrackingWindow} from '../scripts/observe_validator_readiness.mjs';
const saved=JSON.parse(readFileSync(new URL('../data/validator-upgrades/juno-v31-readiness.json',import.meta.url))),upgrade={id:'juno-v31',chainId:'juno-1',height:42452000};
test('recovered pre-quorum evidence distinguishes participation, nil and agreement',()=>{
 const d=parseReadiness(saved,upgrade),last=readinessTimeline(d.latest).at(-1);
 assert.equal(d.records.size,14);assert.equal(last.observed,'19208906');assert.equal(last.agreement,'16302684');assert.equal(d.latest.prevotes.quorum,false);
 assert.equal(d.records.get('31E927F677282369B7E57D39FF9C47E3845BFDEA').secondsFromHalt,693);
 assert.equal(d.records.has('011CA32A120D5F8007BE9D2AA60C1C7AE8F02634'),false,'Polkachu time is unknown, never inferred from absence');
 assert.equal(d.records.get('B2F50E82D354517E17E37178A0D4A8A9644C4D4D').block,null,'nil is participation only');
});
test('reject wrong height, source, mismatched timestamps and malformed clock',()=>{
 const changes=[d=>d.captures[0].snapshots[0].roundState.height='42452002',d=>d.captures[0].snapshots[1].source='https://other.invalid',d=>d.captures[0].snapshots[1].roundState.votes[0].prevotes[0]=d.captures[0].snapshots[1].roundState.votes[0].prevotes[0].replace('06:56:41','06:56:42'),d=>d.captures[0].snapshots.forEach(s=>s.roundState.votes[0].prevotes[0]=s.roundState.votes[0].prevotes[0].replace('2026-10-07T06:56:41','2025-10-07T06:56:41'))];
 for(const change of changes){const d=structuredClone(saved);change(d);assert.throws(()=>parseReadiness(d,upgrade));}
});
test('round changes preserve first evidence and never add powers across rounds',()=>{
 const pair=structuredClone(saved.captures[0].snapshots);
 for(const s of pair){s.savedAt='2026-10-07T07:40:00Z';s.roundState.round=1;const v=s.roundState.votes[0];v.round=1;v.prevotes=v.prevotes.map(x=>x==='nil-Vote'?x:x.replace('/00/','/01/').replace(/ @ .*Z\}/,' @ 2026-10-07T07:39:00Z}'));v.prevotes[0]='nil-Vote';}
 const next=addCapture(saved,upgrade,saved.haltTime,pair),parsed=parseReadiness(next,upgrade);
 assert.equal(next.captures.length,2);assert.equal(parsed.records.get('980644C9C8033945BA54EF32C053C395D0269EEA').secondsFromHalt,10);
 assert.equal(readinessTimeline(parsed.latest).at(-1).observed,String(19208906-6693851));
 assert.deepEqual(addCapture(saved,upgrade,saved.haltTime,saved.captures[0].snapshots),saved,'identical captures do not grow archive');
 assert.throws(()=>addCapture(saved,upgrade,'2026-10-07T00:00:00Z',pair));
});
test('future capture is off without an explicit bounded UTC tracking window',()=>{
 const now=Date.parse('2026-10-07T07:00:00Z');assert.equal(inTrackingWindow(upgrade,now),false);
 const u={...upgrade,readinessWindow:{start:'2026-10-07T06:00:00Z',end:'2026-10-07T09:00:00Z'}};
 assert.equal(inTrackingWindow(u,now),true);assert.equal(inTrackingWindow({...u,collect:false},now),false);assert.equal(inTrackingWindow({...u,tracking:{status:'closed'}},now),false);assert.equal(inTrackingWindow(u,Date.parse('2026-10-07T09:00:00Z')),false);
 u.readinessWindow.end='2026-10-10T09:00:00Z';assert.equal(inTrackingWindow(u,now),false);
});

test('participation evidence preserves early votes and fills only from real signatures',()=>{
 const vote={timestamp:'2026-10-07T07:08:04Z',secondsFromHalt:693,kind:'prevote'};
 const late={timestamp:'2026-10-07T09:15:14Z',secondsFromHalt:8323,height:42453157};
 const readiness={records:new Map([['early',vote]])};
 const history={records:new Map([['early',late],['late',late],['unknown',null]])};
 assert.deepEqual(firstParticipation('early',readiness,history),{...vote,evidence:'consensus'});
 assert.deepEqual(firstParticipation('late',readiness,history),{...late,evidence:'commit'});
 assert.equal(firstParticipation('unknown',readiness,history),null);
 assert.equal(firstParticipation('absent',readiness,history),null);
 assert.equal(firstParticipation('late',null,history).evidence,'commit');
 assert.equal(firstParticipation('early',readiness,null).evidence,'consensus');
 const earlier={timestamp:'2026-10-07T07:00:00Z',secondsFromHalt:208};
 history.records.set('early',earlier);
 assert.deepEqual(firstParticipation('early',readiness,history),{...earlier,evidence:'commit'});
});
