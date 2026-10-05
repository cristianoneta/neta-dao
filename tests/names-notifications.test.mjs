import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyState, observeName, reminderSchedule, nameLinks, readState, DAY, GRACE} from '../names-v2-notifications-core.mjs';

const owner='juno1z3xcalwan92yqxu9d406tlft9yy94jy8s5et57';
const other='juno12jc8ekvrvml9jtk5pvl4tpddj5pep5m5hd8aqt';
const expiry=Date.parse('2027-08-31T18:20:13Z')/1000;
const record={name:'cristiano.neta',owner,generation:1,ownership_revision:1,expires_at:expiry};
const options={owner,chainId:'juno-1',registry:'registry',now:expiry-365*DAY};
const observe=(state,r=record,now=options.now)=>observeName(state,r,{...options,now});

test('verified ownership creates one welcome with profile and renewal routes',()=>{
  const state=observe(emptyState());
  assert.equal(state.events.length,1);assert.equal(state.events[0].type,'WELCOME');
  assert.match(state.events[0].body,/Congratulations/);assert.match(state.events[0].body,/compatible applications/);
  assert.deepEqual(observe(state),state);
  const links=nameLinks(state.events[0]);
  assert.equal(new URL(links.profile,'https://example.org').hash,'#relay/profile');
  const renew=new URL(links.renew,'https://example.org');
  assert.equal(renew.searchParams.get('nns-name'),record.name);
  assert.equal(renew.searchParams.get('nns-network'),'juno-1');
  assert.equal(renew.searchParams.get('nns-action'),'renew');
  assert.equal(renew.hash,'#relay/register');
  assert.deepEqual(readState(JSON.stringify(state)),state);
});

test('calendar months clamp month ends and all eight reminder thresholds fire once',()=>{
  const schedule=reminderSchedule(expiry);
  assert.equal(new Date(schedule[0][1]*1000).toISOString(),'2027-02-28T18:20:13.000Z');
  assert.equal(new Date(schedule[1][1]*1000).toISOString(),'2027-05-31T18:20:13.000Z');
  let state=observe(emptyState());
  for(const [stage,time] of schedule){
    const before=state.events.length;
    state=observe(state,record,time-1);assert.equal(state.events.length,before);
    state=observe(state,record,time);assert.equal(state.events.length,before+1,stage);
    assert.equal(observe(state,record,time+1).events.length,before+1);
  }
  assert.equal(state.events[0].type,'NAME RELEASED');
  assert.equal(state.events[1].type,'NAME EXPIRED');
});

test('returning after a long absence catches up with only the current reminder',()=>{
  const state=observe(observe(emptyState()),record,expiry-DAY);
  assert.equal(state.events.length,2);assert.match(state.events[0].detail,/1 day reminder/);
  assert.equal(observe(state,record,expiry-DAY).events.length,2);
});

test('renewal supersedes old reminders and schedules against the new expiry',()=>{
  const state=observe(observe(emptyState()),record,expiry-DAY);
  const extended={...record,expires_at:expiry+365*DAY};
  const renewed=observe(state,extended,expiry-DAY);
  assert.equal(renewed.events[0].type,'RENEWAL CONFIRMED');
  assert.ok(renewed.events.slice(1).every(e=>e.superseded&&e.read));
  assert.equal(observe(renewed,extended,expiry).events.length,renewed.events.length);
  assert.equal(observe(renewed,extended,extended.expires_at-DAY).events[0].identity.expires_at,extended.expires_at);
});

test('transfer stops old-owner reminders; recipient has an independent welcome',()=>{
  const transferred={...record,owner:other,ownership_revision:2};
  const previous=observe(observe(emptyState()),transferred,expiry-DAY);
  assert.equal(Object.keys(previous.identities).length,0);
  assert.equal(previous.events.length,1);assert.equal(previous.events[0].superseded,true);
  assert.equal(observe(previous,transferred,expiry).events.length,1);
  const recipient=observeName(emptyState(),transferred,{...options,owner:other});
  assert.equal(recipient.events[0].identity.owner,other);
  assert.equal(recipient.events[0].type,'WELCOME');
});

test('expiry and release have exact grace boundaries without a false active welcome',()=>{
  const expired=observe(emptyState(),record,expiry);
  assert.deepEqual(expired.events.map(e=>e.type),['NAME EXPIRED']);
  assert.equal(observe(expired,record,expiry+GRACE-1).events.length,1);
  assert.equal(observe(expired,record,expiry+GRACE).events[0].type,'NAME RELEASED');
});

test('invalid identities, saved data and foreign networks cannot produce action links',()=>{
  for(const altered of [{name:'javascript:alert(1)'},{owner:'not-a-wallet'},{generation:0},{expires_at:NaN}]) assert.throws(()=>observe(emptyState(),{...record,...altered}));
  assert.throws(()=>readState('{broken'));
  assert.throws(()=>readState('{"version":2,"identities":{},"events":[]}'));
  assert.throws(()=>nameLinks({identity:record,chainId:'foreign'}));
});
