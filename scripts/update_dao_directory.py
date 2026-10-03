#!/usr/bin/env python3
"""Verify the NETA DAO and collect a height-pinned governance membership snapshot."""
import base64,json,re,urllib.parse,urllib.request
from datetime import datetime,timezone
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
PROVIDERS=('https://juno.api.m.stavr.tech','https://juno-api.polkachu.com','https://juno-rest.publicnode.com')
def get(base,path,height=None):
    headers={'User-Agent':'NETA-DAO-Directory/1.0','Accept':'application/json'}
    if height:headers['x-cosmos-block-height']=str(height)
    with urllib.request.urlopen(urllib.request.Request(base+path,headers=headers),timeout=25) as r:
        if height and r.headers.get('x-cosmos-block-height')!=str(height):raise ValueError('provider did not confirm requested height')
        return json.load(r)
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

def collect(dao,base):
    latest=get(base,'/cosmos/base/tendermint/v1beta1/blocks/latest')['block']['header']
    if latest['chain_id']!='juno-1':raise ValueError('wrong chain')
    height=int(latest['height'])-20
    config=smart(base,dao['core'],{'config':{}},height)
    voting=smart(base,dao['core'],{'voting_module':{}},height)
    modules=smart(base,dao['core'],{'proposal_modules':{}},height)
    if config['name']!=dao['name'] or voting!=dao['votingModule'] or dao['proposalModule'] not in modules:raise ValueError('DAO identity changed; review directory before publication')
    if smart(base,voting,{'staking_contract':{}},height)!=dao['stakingContract']:raise ValueError('staking contract changed')
    if smart(base,voting,{'token_contract':{}},height)!=dao['tokenContract']:raise ValueError('voting token changed')
    power=smart(base,voting,{'total_power_at_height':{'height':height}},height)
    if int(power['height'])!=height:raise ValueError('voting height mismatch')
    # This pinned v0.1 staking module predates list_stakers; scan exact primary keys.
    key='';seen=set();members=[]
    for _ in range(200):
        suffix='&pagination.key='+urllib.parse.quote(key,safe='') if key else ''
        data=get(base,f'/cosmwasm/wasm/v1/contract/{dao["stakingContract"]}/state?pagination.limit=1000'+suffix,height)
        for model in data['models']:
            m=decode_member(model)
            if m:members.append(m)
        key=data.get('pagination',{}).get('next_key') or ''
        if not key:break
        if key in seen:raise ValueError('state pagination repeated')
        seen.add(key)
    else:raise ValueError('state pagination limit')
    if len({m['address'] for m in members})!=len(members):raise ValueError('duplicate member')
    if sum(int(m['power_raw']) for m in members)!=int(power['power']):raise ValueError('member power does not reconcile to voting module')
    members.sort(key=lambda m:(-int(m['power_raw']),m['address']))
    rules=smart(base,dao['proposalModule'],{'config':{}},height)
    if rules['dao']!=dao['core']:raise ValueError('proposal module belongs to another DAO')
    count=smart(base,dao['proposalModule'],{'proposal_count':{}},height)
    return {'schema_version':1,'generated_at':datetime.now(timezone.utc).isoformat(),'chain_id':'juno-1','height':height,'source':base,'core':dao['core'],'name':config['name'],'voting_module':voting,'staking_contract':dao['stakingContract'],'token_contract':dao['tokenContract'],'total_power_raw':power['power'],'members_complete':True,'membership_method':'height-pinned staked_balances primary keys reconciled with voting module','members':members,'proposal_count':count,'proposal_rules':rules,'nns_registry':None}
def main():
    dao=next(d for d in json.loads((ROOT/'data/dao-directory.json').read_text())['daos'] if d['id']=='neta')
    errors=[]
    for base in PROVIDERS:
        try:data=collect(dao,base);break
        except Exception as error:errors.append(f'{base}: {error}')
    else:raise RuntimeError('; '.join(errors))
    path=ROOT/'data/daos/neta.json';path.parent.mkdir(parents=True,exist_ok=True);path.write_text(json.dumps(data,indent=2)+'\n')
    print(json.dumps({'members':len(data['members']),'total_power_raw':data['total_power_raw'],'height':data['height'],'source':data['source']}))
if __name__=='__main__':main()
