#!/usr/bin/env python3
"""Verify the NETA DAO and collect a height-pinned governance membership snapshot."""
import argparse,base64,json,re,time,urllib.error,urllib.parse,urllib.request
from concurrent.futures import ThreadPoolExecutor
from decimal import Decimal, getcontext
getcontext().prec=80
from datetime import datetime,timezone
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
PROVIDERS=('https://juno.api.m.stavr.tech','https://juno-api.polkachu.com','https://juno-rest.publicnode.com')
def get(base,path,height=None):
    headers={'User-Agent':'NETA-DAO-Directory/1.0','Accept':'application/json'}
    if height:headers['x-cosmos-block-height']=str(height)
    for attempt in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(base+path,headers=headers),timeout=25) as r:
                if height and r.headers.get('x-cosmos-block-height')!=str(height):raise ValueError('provider did not confirm requested height')
                return json.load(r)
        except urllib.error.HTTPError as error:
            detail=error.read().decode('utf-8',errors='replace')[:400]
            if error.code not in (429,500,502,503,504) or attempt==2:raise RuntimeError(f'HTTP {error.code} {path}: {detail}') from error
        except (TimeoutError,urllib.error.URLError):
            if attempt==2:raise
        time.sleep(attempt+1)
def smart(base,address,msg,height):
    q=urllib.parse.quote(base64.b64encode(json.dumps(msg,separators=(',',':')).encode()).decode(),safe='')
    return get(base,f'/cosmwasm/wasm/v1/contract/{address}/smart/{q}',height)['data']
def decode_member(model):
    raw=bytes.fromhex(model['key']);prefix=b'\x00\x0fstaked_balances'
    # cw-storage-plus namespaces are length-prefixed, not a text substring match.
    if not raw.startswith(prefix):return None
    address=raw[len(prefix):].decode('ascii')
    if not re.fullmatch(r'juno1[023456789acdefghjklmnpqrstuvwxyz]{38,58}',address):raise ValueError('invalid member key')
    power=int(json.loads(base64.b64decode(model['value'])))
    if power<0:raise ValueError('negative voting power')
    return {'address':address,'power_raw':str(power)} if power else None

def collect_stakers(base,contract,height):
    namespace=b'\x00\x0fstaked_balances'
    def scan(character):
        prefix=namespace+b'juno1'+character.encode()
        key=base64.b64encode(prefix).decode();seen=set();rows=[]
        for _ in range(200):
            path=f'/cosmwasm/wasm/v1/contract/{contract}/state?pagination.limit=100&pagination.key='+urllib.parse.quote(key,safe='')
            data=get(base,path,height)
            for model in data['models']:
                raw=bytes.fromhex(model['key'])
                if raw<prefix:raise ValueError('state pagination moved before range')
                if not raw.startswith(prefix):return rows
                member=decode_member(model)
                if member:rows.append(member)
            key=data.get('pagination',{}).get('next_key') or ''
            if not key:return rows
            if key in seen:raise ValueError('state pagination repeated')
            seen.add(key)
        raise ValueError('state pagination limit')
    with ThreadPoolExecutor(max_workers=5) as pool:
        return [row for rows in pool.map(scan,sorted('023456789acdefghjklmnpqrstuvwxyz')) for row in rows]

def collect(dao,base):
    latest=get(base,'/cosmos/base/tendermint/v1beta1/blocks/latest')['block']['header']
    if latest['chain_id']!='juno-1':raise ValueError('wrong chain')
    height=int(latest['height'])-20
    config=smart(base,dao['core'],{'config':{}},height)
    voting=smart(base,dao['core'],{'voting_module':{}},height)
    modules=smart(base,dao['core'],{'proposal_modules':{}},height)
    if config['name']!=dao.get('onChainName',dao['name']) or voting!=dao['votingModule'] or dao['proposalModule'] not in modules:raise ValueError('DAO identity changed; review directory before publication')
    if smart(base,voting,{'staking_contract':{}},height)!=dao['stakingContract']:raise ValueError('staking contract changed')
    if smart(base,voting,{'token_contract':{}},height)!=dao['tokenContract']:raise ValueError('voting token changed')
    power=smart(base,voting,{'total_power_at_height':{'height':height}},height)
    if int(power['height'])!=height:raise ValueError('voting height mismatch')
    # The legacy endpoint caps pages at 100. Scan disjoint primary-key ranges
    # concurrently so the fixed block remains available on pruned public nodes.
    members=collect_stakers(base,dao['stakingContract'],height)
    if len({m['address'] for m in members})!=len(members):raise ValueError('duplicate member')
    if sum(int(m['power_raw']) for m in members)!=int(power['power']):raise ValueError('member power does not reconcile to voting module')
    members.sort(key=lambda m:(-int(m['power_raw']),m['address']))
    rules=smart(base,dao['proposalModule'],{'config':{}},height)
    if rules['dao']!=dao['core']:raise ValueError('proposal module belongs to another DAO')
    count=smart(base,dao['proposalModule'],{'proposal_count':{}},height)
    return {'schema_version':1,'generated_at':datetime.now(timezone.utc).isoformat(),'chain_id':'juno-1','height':height,'source':base,'core':dao['core'],'name':config['name'],'voting_module':voting,'staking_contract':dao['stakingContract'],'token_contract':dao['tokenContract'],'total_power_raw':power['power'],'members_complete':True,'membership_method':'height-pinned staked_balances primary keys reconciled with voting module','members':members,'proposal_count':count,'proposal_rules':rules,'nns_registry':None}
def collect_group(dao, base):
    latest=get(base,'/cosmos/base/tendermint/v1beta1/blocks/latest')['block']['header']
    if latest['chain_id']!=dao['network']:raise ValueError('wrong chain')
    height=int(latest['height'])-20
    config=smart(base,dao['core'],{'config':{}},height)
    voting=smart(base,dao['core'],{'voting_module':{}},height)
    if config['name']!=dao.get('onChainName',dao['name']) or voting!=dao['votingModule']:raise ValueError('DAO identity mismatch')
    if smart(base,voting,{'dao':{}},height)!=dao['core']:raise ValueError('voting DAO mismatch')
    if smart(base,voting,{'group_contract':{}},height)!=dao['groupContract']:raise ValueError('group identity mismatch')
    info=smart(base,voting,{'info':{}},height)['info']
    if info['contract']!='crates.io:dao-voting-cw4':raise ValueError('unsupported voting contract')
    power=smart(base,voting,{'total_power_at_height':{'height':height}},height)
    if int(power['height'])!=height:raise ValueError('voting height mismatch')
    members=[];cursor=None;seen=set()
    for _ in range(1000):
        query={'limit':100}
        if cursor:query['start_after']=cursor
        rows=smart(base,dao['groupContract'],{'list_members':query},height)['members']
        if not rows:break
        for row in rows:
            address=row['addr'];weight=int(row['weight'])
            if address in seen or weight<0:raise ValueError('duplicate or invalid group member')
            seen.add(address)
            if weight:members.append({'address':address,'power_raw':str(weight)})
        cursor=rows[-1]['addr']
    else:raise ValueError('group pagination limit')
    if sum(int(m['power_raw']) for m in members)!=int(power['power']):raise ValueError('group power does not reconcile')
    members.sort(key=lambda m:(-int(m['power_raw']),m['address']))
    return {'schema_version':1,'generated_at':datetime.now(timezone.utc).isoformat(),'chain_id':dao['network'],'height':height,'source':base,'core':dao['core'],'name':config['name'],'voting_module':voting,'group_contract':dao['groupContract'],'total_power_raw':str(power['power']),'members_complete':True,'membership_method':'height-pinned cw4 group weights reconciled with voting module','members':members}

def paginated(base,path,field,height):
    rows=[];key='';seen=set()
    for _ in range(1000):
        sep='&' if '?' in path else '?'
        suffix='&pagination.key='+urllib.parse.quote(key,safe='') if key else ''
        data=get(base,path+sep+'pagination.limit=2000'+suffix,height)
        rows.extend(data[field]);key=data.get('pagination',{}).get('next_key') or ''
        if not key:return rows
        if key in seen:raise ValueError('pagination repeated')
        seen.add(key)
    raise ValueError('pagination limit')

def collect_native(dao,base):
    latest=get(base,'/cosmos/base/tendermint/v1beta1/blocks/latest')['block']['header']
    if latest['chain_id']!=dao['network']:raise ValueError('wrong chain')
    height=int(latest['height'])-20
    params=get(base,'/cosmos/staking/v1beta1/params',height)['params']
    if params['bond_denom']!='ujuno':raise ValueError('bond denomination changed')
    validators=paginated(base,'/cosmos/staking/v1beta1/validators?status=BOND_STATUS_BONDED','validators',height)
    if not validators or len({v['operator_address'] for v in validators})!=len(validators):raise ValueError('empty or duplicated validators')
    pool=get(base,'/cosmos/staking/v1beta1/pool',height)['pool']
    if sum(int(v['tokens']) for v in validators)!=int(pool['bonded_tokens']):raise ValueError('validator tokens do not reconcile to bonded pool')
    def delegations(v):
        getcontext().prec=80
        if v['status']!='BOND_STATUS_BONDED':raise ValueError('non-bonded validator')
        rows=paginated(base,'/cosmos/staking/v1beta1/validators/'+v['operator_address']+'/delegations','delegation_responses',height)
        if sum((Decimal(r['delegation']['shares']) for r in rows),Decimal(0))!=Decimal(v['delegator_shares']):raise ValueError(f'delegation shares do not reconcile for {v["operator_address"]}: {len(rows)} records')
        seen=set();total=0
        for row in rows:
            d=row['delegation'];balance=row['balance'];amount=int(balance['amount'])
            if d['validator_address']!=v['operator_address'] or balance['denom']!='ujuno' or amount<0 or d['delegator_address'] in seen:raise ValueError('invalid delegation identity')
            seen.add(d['delegator_address']);total+=amount
        # REST balances truncate fractional micro-JUNO per delegation.
        if not 0<=int(v['tokens'])-total<=len(rows):raise ValueError('delegation balances do not reconcile')
        print(f'Verified {v["description"]["moniker"]}: {len(rows)} delegations',flush=True)
        return v,rows
    members={};roster=[]
    with ThreadPoolExecutor(max_workers=5) as executor:
        for v,rows in executor.map(delegations,validators):
            roster.append({'address':v['operator_address'],'name':v['description']['moniker'],'power_raw':v['tokens']})
            for row in rows:
                d=row['delegation'];amount=int(row['balance']['amount'])
                if not amount:continue
                m=members.setdefault(d['delegator_address'],{'address':d['delegator_address'],'power_raw':0,'delegations':[]})
                m['power_raw']+=amount;m['delegations'].append({'validator':v['operator_address'],'power_raw':str(amount)})
    rows=list(members.values());rows.sort(key=lambda m:(-m['power_raw'],m['address']))
    for m in rows:m['power_raw']=str(m['power_raw'])
    roster.sort(key=lambda v:(-int(v['power_raw']),v['address']))
    return {'schema_version':1,'generated_at':datetime.now(timezone.utc).isoformat(),'chain_id':dao['network'],'height':height,'source':base,'core':None,'name':dao['name'],'total_power_raw':str(sum(int(m['power_raw']) for m in rows)),'bonded_pool_raw':pool['bonded_tokens'],'members_complete':True,'membership_method':'height-pinned bonded delegations reconciled with validator shares and bonded pool; per-delegation micro-unit rounding','members':rows,'validators':roster}

ADAPTERS={'cw20-staked-legacy':collect,'cw4-group':collect_group,'native-staking':collect_native}
def main():
    parser=argparse.ArgumentParser();parser.add_argument('--dao',default='neta');args=parser.parse_args()
    dao=next(d for d in json.loads((ROOT/'data/dao-directory.json').read_text())['daos'] if d['id']==args.dao)
    source=dao['membershipSource'];adapter=ADAPTERS[source['adapter']];errors=[]
    for base in PROVIDERS:
        try:data=adapter(dao,base);break
        except Exception as error:
            errors.append(f'{base}: {error}');print(errors[-1],flush=True)
    else:raise RuntimeError('; '.join(errors))
    data['adapter']=source['adapter'];data['power_decimals']=source['decimals'];data['power_unit']=source['unit']
    path=ROOT/'data/daos'/source['file'];path.parent.mkdir(parents=True,exist_ok=True)
    temp=path.with_suffix('.json.tmp');temp.write_text(json.dumps(data,**({'separators':(',',':')} if source['adapter']=='native-staking' else {'indent':2}))+'\n');temp.replace(path)
    print(json.dumps({'dao':dao['id'],'members':len(data['members']),'total_power_raw':data['total_power_raw'],'height':data['height'],'source':data['source']}),flush=True)
if __name__=='__main__':main()
