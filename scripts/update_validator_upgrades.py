#!/usr/bin/env python3
"""Resume a gap-free, two-observer scan of first canonical post-upgrade signatures.

This measures first included precommits, not software installation/readiness. Never
substitute header.time for signature time: the first resumed header may predate halt.
"""
import argparse
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import base64
import copy
import json
from pathlib import Path
import re
import time
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
SOURCES = ['https://juno-rpc.publicnode.com', 'https://juno.rpc.m.stavr.tech']
HEX = re.compile(r'^[A-F0-9]{64}$')
ADDRESS = re.compile(r'^[A-F0-9]{40}$')


def instant(value):
    result = datetime.fromisoformat(value.replace('Z', '+00:00'))
    if result.tzinfo is None: raise ValueError('Timestamp must have timezone')
    return result.timestamp()


def get(url, payload=None):
    request = urllib.request.Request(url, data=json.dumps(payload).encode() if payload is not None else None, headers={'User-Agent':'NETA-Upgrade-Observer/1.0','Content-Type':'application/json','Cache-Control':'no-cache'})
    for attempt in range(2):
        try:
            with urllib.request.urlopen(request, timeout=12) as response:
                data = json.load(response)
            if payload is not None: return data
            if data.get('error') or not isinstance(data.get('result'), dict): raise ValueError('RPC error or missing result')
            return data['result']
        except Exception:
            if attempt: raise
            time.sleep(0.5)


def pair(path):
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(lambda source: get(source + '/' + path), SOURCES))
    return results



def commit_batch(heights, chain):
    payload=[{'jsonrpc':'2.0','id':height,'method':'commit','params':{'height':str(height)}} for height in heights]
    with ThreadPoolExecutor(max_workers=2) as pool:
        responses=list(pool.map(lambda source:get(source,payload),SOURCES))
    maps=[]
    for response in responses:
        if not isinstance(response,list) or len(response)!=len(heights): raise ValueError('Incomplete RPC batch')
        result={}
        for item in response:
            if item.get('id') not in heights or item['id'] in result or item.get('error') or not isinstance(item.get('result'),dict): raise ValueError('Mismatched RPC batch')
            result[item['id']]=item['result']
        maps.append(result)
    return {height:checked_commit([m[height] for m in maps],height,chain) for height in heights}


def checked_commit(values, height, chain):
    normalized = []
    for value in values:
        signed = value.get('signed_header', {})
        header, commit = signed.get('header', {}), signed.get('commit', {})
        if value.get('canonical') is not True or header.get('chain_id') != chain or int(header.get('height', 0)) != height or int(commit.get('height', 0)) != height: raise ValueError('Wrong canonical block identity')
        if not HEX.fullmatch(commit.get('block_id', {}).get('hash', '')) or not HEX.fullmatch(header.get('validators_hash', '')): raise ValueError('Invalid block/set hash')
        if not isinstance(commit.get('round'), int) or commit['round'] < 0: raise ValueError('Invalid commit round')
        instant(header['time'])
        normalized.append({'header': header, 'commit': commit})
    if len(normalized) != 2 or normalized[0] != normalized[1]: raise ValueError('Observers disagree on canonical commit')
    return normalized[0]


def checked_validators(values, height):
    for value in values:
        rows = value.get('validators', [])
        if int(value.get('block_height', 0)) != height or not 1 <= len(rows) <= 100 or int(value.get('count', 0)) != len(rows) or int(value.get('total', 0)) != len(rows): raise ValueError('Incomplete or wrong-height validator set')
        addresses = set()
        for row in rows:
            if not ADDRESS.fullmatch(row.get('address', '')) or row['address'] in addresses or not re.fullmatch(r'[1-9][0-9]*', str(row.get('voting_power', ''))): raise ValueError('Invalid validator')
            if int(row['voting_power']) > 9223372036854775807: raise ValueError('Invalid voting power')
            addresses.add(row['address'])
    # Compare the consensus identities, keys and powers, not local proposer priorities.
    def normalize(value): return [{k:r[k] for k in ['address','pub_key','voting_power']} for r in value['validators']]
    if normalize(values[0]) != normalize(values[1]): raise ValueError('Observers disagree on validator set')
    return values[0]['validators']


def consume(state, block, validators):
    """Validate the whole block before returning an advanced copy of the checkpoint."""
    header, commit = block['header'], block['commit']
    height = int(commit['height'])
    if height != state['scannedThrough'] + 1 or header.get('last_block_id', {}).get('hash') != state['scannedHash']: raise ValueError('History must be contiguous')
    signatures = commit.get('signatures', [])
    if len(signatures) != len(validators): raise ValueError('Incomplete signatures')
    total, signed, first = sum(int(v['voting_power']) for v in validators), 0, []
    for validator, signature in zip(validators, signatures):
        flag = signature.get('block_id_flag')
        if flag == 1:
            if signature.get('validator_address') or signature.get('signature'): raise ValueError('Malformed absent signature')
            continue
        if flag not in (2,3) or signature.get('validator_address') != validator['address']: raise ValueError('Signature identity mismatch')
        try: raw = base64.b64decode(signature.get('signature', ''), validate=True)
        except Exception as exc: raise ValueError('Malformed signature') from exc
        if len(raw) != 64: raise ValueError('Malformed signature size')
        at = instant(signature['timestamp'])
        if at < instant(state['halt']['time']) or at > time.time() + 60: raise ValueError('Implausible signature clock')
        if flag == 2:
            signed += int(validator['voting_power'])
            if validator['address'] in state['firstSignatures'] and state['firstSignatures'][validator['address']] is None:
                first.append((validator['address'], {'height':height,'blockHash':commit['block_id']['hash'],'timestamp':signature['timestamp'],'secondsFromHalt':int(at-instant(state['halt']['time'])),'blocksAfterRestart':height-state['upgradeHeight']-1,'signature':signature['signature']}))
    if signed * 3 <= total * 2: raise ValueError('Insufficient commit signing power')
    result = copy.deepcopy(state)
    if height == state['upgradeHeight']+1:
        result['firstResumedSignatureTime'] = min(s['timestamp'] for s in signatures if s['block_id_flag']==2)
    for address, record in first: result['firstSignatures'][address] = record
    result['scannedThrough'], result['scannedHash'], result['scannedBlockTime'] = height, commit['block_id']['hash'], header['time']
    result['complete'] = all(v is not None for v in result['firstSignatures'].values())
    return result


def validate_checkpoint(state, upgrade):
    if state.get('schema') != 1 or state.get('upgradeId') != upgrade['id'] or state.get('chainId') != upgrade['chainId'] or state.get('upgradeHeight') != upgrade['height'] or state.get('sources') != SOURCES: raise ValueError('Checkpoint identity mismatch')
    through = state.get('scannedThrough')
    if not isinstance(through,int) or through < upgrade['height'] or not HEX.fullmatch(state.get('scannedHash','')): raise ValueError('Invalid checkpoint watermark')
    baseline = state.get('validators',[])
    addresses = [r.get('address') for r in baseline]
    if not addresses or len(set(addresses)) != len(addresses) or any(not ADDRESS.fullmatch(a or '') for a in addresses) or set(state.get('firstSignatures',{})) != set(addresses): raise ValueError('Invalid checkpoint validators')
    halt_time = instant(state['halt']['time'])
    if state['halt'].get('height') != upgrade['height'] or not HEX.fullmatch(state['halt'].get('hash','')): raise ValueError('Invalid halt anchor')
    for address, record in state['firstSignatures'].items():
        if record is None: continue
        if not upgrade['height'] < record['height'] <= through or not HEX.fullmatch(record.get('blockHash','')) or record['blocksAfterRestart'] != record['height']-upgrade['height']-1 or record['secondsFromHalt'] != int(instant(record['timestamp'])-halt_time) or record['secondsFromHalt']<0 or len(base64.b64decode(record['signature'],validate=True))!=64: raise ValueError('Invalid first signature record')
    if state.get('complete') != all(v is not None for v in state['firstSignatures'].values()): raise ValueError('Invalid completion claim')


def collect(upgrade, path, max_blocks=200, seconds=120):
    if not re.fullmatch(r'[a-z0-9-]+', upgrade['id']) or upgrade['chainId'] != 'juno-1': raise ValueError('Unsupported upgrade')
    prior = json.loads(path.read_text()) if path.exists() else None
    if prior:
        validate_checkpoint(prior,upgrade)
        if prior['complete']: return prior
    halt = checked_commit(pair('commit?height='+str(upgrade['height'])),upgrade['height'],upgrade['chainId'])
    halt_anchor = {'height':upgrade['height'],'hash':halt['commit']['block_id']['hash'],'time':halt['header']['time']}
    if prior and prior['halt'] != halt_anchor: raise ValueError('Halt anchor changed')
    if prior:
        boundary = checked_commit(pair('commit?height='+str(prior['scannedThrough'])),prior['scannedThrough'],upgrade['chainId'])
        if boundary['commit']['block_id']['hash'] != prior['scannedHash']: raise ValueError('Saved history changed')
    statuses = pair('status')
    if any(s.get('node_info',{}).get('network') != upgrade['chainId'] for s in statuses): raise ValueError('Wrong status chain')
    latest = min(int(s['sync_info']['latest_block_height']) for s in statuses)-1
    if upgrade.get('endHeight') is not None:
        if not isinstance(upgrade['endHeight'],int) or upgrade['endHeight']<=upgrade['height']: raise ValueError('Invalid upgrade end height')
        latest=min(latest,upgrade['endHeight'])
    first_height = upgrade['height']+1
    if latest < first_height: return prior
    baseline = checked_validators(pair('validators?height='+str(first_height)+'&per_page=100'),first_height)
    state = prior or {'schema':1,'upgradeId':upgrade['id'],'chainId':upgrade['chainId'],'upgradeHeight':upgrade['height'],'halt':halt_anchor,'sources':SOURCES,'validators':[{'address':v['address'],'power':v['voting_power']} for v in baseline],'firstSignatures':{v['address']:None for v in baseline},'firstResumedSignatureTime':None,'scannedThrough':upgrade['height'],'scannedHash':halt_anchor['hash'],'complete':False}
    if state['validators'] != [{'address':v['address'],'power':v['voting_power']} for v in baseline]: raise ValueError('Baseline set changed')
    start = time.monotonic(); set_hash = None; validators = None; failure = None; batch = {}
    limit=min(latest,state['scannedThrough']+max_blocks)
    for height in range(state['scannedThrough']+1,limit+1):
        if time.monotonic()-start > seconds: break
        try:
            if height not in batch:
                batch=commit_batch(list(range(height,min(height+9,limit)+1)),upgrade['chainId'])
            block = batch[height]
            if block['header']['validators_hash'] != set_hash:
                validators = checked_validators(pair('validators?height='+str(height)+'&per_page=100'),height)
                set_hash = block['header']['validators_hash']
            state = consume(state,block,validators)
            if state['complete']: break
        except Exception as exc:
            failure = str(exc); break  # No gap skipping and no rollback of a valid prefix.
    if not prior or state['scannedThrough'] != prior['scannedThrough']:
        state['updatedAt'] = datetime.now(timezone.utc).isoformat().replace('+00:00','Z')
        validate_checkpoint(state,upgrade)
        path.parent.mkdir(parents=True,exist_ok=True)
        temporary=path.with_suffix('.tmp');temporary.write_text(json.dumps(state,indent=2)+'\n');temporary.replace(path)
    print(upgrade['id'],state['scannedThrough'],sum(v is not None for v in state['firstSignatures'].values()),'/',len(state['validators']),('scan paused: '+failure) if failure else '')
    return state


def main():
    parser=argparse.ArgumentParser();parser.add_argument('--max-blocks',type=int,default=200);parser.add_argument('--seconds',type=int,default=120);args=parser.parse_args()
    for upgrade in json.loads((ROOT/'data/community-upgrades.json').read_text())['upgrades']:
        if upgrade.get('collect'): collect(upgrade,ROOT/'data/validator-upgrades'/f"{upgrade['id']}.json",args.max_blocks,args.seconds)

if __name__=='__main__': main()
