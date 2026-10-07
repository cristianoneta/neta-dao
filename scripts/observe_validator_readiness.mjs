#!/usr/bin/env node
import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {CONSENSUS_OBSERVERS} from '../juno-consensus-core.mjs';
import {parseReadiness} from '../juno-upgrade-readiness.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function get(url){const r=await fetch(url,{signal:AbortSignal.timeout(10000),headers:{'User-Agent':'NETA-Upgrade-Observer/1.0'}});if(!r.ok)throw Error('RPC '+r.status);const d=await r.json();if(d.error)throw Error('RPC response error');return d;}
export function inTrackingWindow(upgrade,now=Date.now()){
 const w=upgrade.readinessWindow,start=Date.parse(w?.start),end=Date.parse(w?.end);
 return Number.isFinite(start)&&Number.isFinite(end)&&end>start&&end-start<=24*3600000&&now>=start&&now<end;
}
export function addCapture(prior,upgrade,haltTime,snapshots){
 const data=prior?structuredClone(prior):{schema:1,upgradeId:upgrade.id,chainId:upgrade.chainId,upgradeHeight:upgrade.height,haltTime,coverage:'partial',note:'Periodic two-observer captures. Polling and scheduler gaps remain; reported vote times are not installation times.',captures:[]};
 if(prior)parseReadiness(prior,upgrade);
 if(data.haltTime!==haltTime)throw Error('Halt anchor changed.');
 const last=data.captures.at(-1);
 if(last&&JSON.stringify(last.snapshots.map(s=>s.roundState))===JSON.stringify(snapshots.map(s=>s.roundState)))return data;
 data.captures.push({snapshots});parseReadiness(data,upgrade);return data;
}
export async function observe(upgrade,{seconds=250,interval=20}={}){
 if(!/^[a-z0-9-]+$/.test(upgrade.id)||upgrade.chainId!=='juno-1'||!Number.isSafeInteger(upgrade.height))throw Error('Unsupported upgrade.');
 if(!inTrackingWindow(upgrade))return;
 const file=path.join(root,'data/validator-upgrades',upgrade.id+'-readiness.json');let prior;
 try{prior=JSON.parse(await readFile(file,'utf8'));parseReadiness(prior,upgrade);}catch(e){if(e.code!=='ENOENT')throw e;}
 const end=Date.now()+Math.min(seconds,250)*1000;
 while(Date.now()<end&&inTrackingWindow(upgrade)){
  try{
   const states=await Promise.all(CONSENSUS_OBSERVERS.map(async source=>{const d=(await get(source.url+'/status')).result;if(d?.node_info?.network!==upgrade.chainId||d.sync_info?.catching_up!==false)throw Error('Wrong chain or catching up');return Number(d.sync_info.latest_block_height);}));
   if(states.every(h=>h>upgrade.height))break; // Never label later heights as upgrade readiness.
   if(states.every(h=>h===upgrade.height)){
    const anchors=await Promise.all(CONSENSUS_OBSERVERS.map(async s=>(await get(s.url+'/commit?height='+upgrade.height)).result));
    if(anchors.some(a=>a?.canonical!==true||a.signed_header?.header?.chain_id!==upgrade.chainId||Number(a.signed_header?.header?.height)!==upgrade.height)||JSON.stringify(anchors[0].signed_header)!==JSON.stringify(anchors[1].signed_header))throw Error('Halt anchors disagree');
    const snapshots=await Promise.all(CONSENSUS_OBSERVERS.map(async source=>{const raw=(await get(source.url+'/dump_consensus_state')).result?.round_state;return {source:source.url,savedAt:new Date().toISOString(),timeBasis:'Observer response received',roundState:Object.fromEntries(['height','round','step','validators','votes'].map(k=>[k,raw?.[k]]))};}));
    const next=addCapture(prior,upgrade,anchors[0].signed_header.header.time,snapshots);
    await mkdir(path.dirname(file),{recursive:true});await writeFile(file+'.tmp',JSON.stringify(next,null,2)+'\n');await rename(file+'.tmp',file);prior=next;
   }
  }catch(e){console.error(upgrade.id,': capture not accepted:',e.message);}
  const remaining=end-Date.now();if(remaining>0)await sleep(Math.min(Math.max(10,interval)*1000,remaining));
 }
 console.log(upgrade.id,prior?`${prior.captures.length} saved captures`:'no accepted capture');
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const registry=JSON.parse(await readFile(path.join(root,'data/community-upgrades.json'),'utf8'));
 for(const upgrade of registry.upgrades)if(inTrackingWindow(upgrade))await observe(upgrade);
}
