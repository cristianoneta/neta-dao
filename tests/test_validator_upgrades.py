import base64
import copy
import importlib.util
from pathlib import Path
import unittest
import json
import tempfile
from unittest.mock import patch
from datetime import datetime, timezone, timedelta

spec=importlib.util.spec_from_file_location('upgrades',Path(__file__).resolve().parents[1]/'scripts/update_validator_upgrades.py')
u=importlib.util.module_from_spec(spec);spec.loader.exec_module(u)

class UpgradeHistoryTests(unittest.TestCase):
    def fixture(self):
        now=datetime.now(timezone.utc)
        halt=(now-timedelta(hours=1)).isoformat()
        validators=[{'address':str(i+1)*40,'voting_power':str(p),'pub_key':{'type':'tendermint/PubKeyEd25519','value':base64.b64encode(bytes([i+1])*32).decode()}} for i,p in enumerate([40,30,20,10])]
        state={'schema':1,'upgradeId':'juno-v31','chainId':'juno-1','upgradeHeight':42452000,'halt':{'height':42452000,'hash':'A'*64,'time':halt},'sources':u.SOURCES,'validators':[{'address':v['address'],'power':v['voting_power']} for v in validators],'firstSignatures':{v['address']:None for v in validators},'firstResumedSignatureTime':None,'scannedThrough':42452000,'scannedHash':'A'*64,'complete':False}
        block={'header':{'height':'42452001','chain_id':'juno-1','validators_hash':'C'*64,'last_block_id':{'hash':'A'*64},'time':halt},'commit':{'height':'42452001','round':0,'block_id':{'hash':'B'*64},'signatures':[{'block_id_flag':2,'validator_address':v['address'],'timestamp':(now-timedelta(seconds=10)).isoformat(),'signature':base64.b64encode(bytes(64)).decode()} if i<3 else {'block_id_flag':1,'validator_address':'','signature':None} for i,v in enumerate(validators)]}}
        return state,block,validators
    def test_signature_time_not_stale_first_block_header(self):
        state,block,validators=self.fixture();out=u.consume(state,block,validators)
        first=out['firstSignatures'][validators[0]['address']]
        self.assertEqual(first['secondsFromHalt'],3590)
        self.assertEqual(first['blocksAfterRestart'],0)
        self.assertIsNone(out['firstSignatures'][validators[-1]['address']])
        self.assertIsNone(state['firstSignatures'][validators[0]['address']])
    def test_first_signature_retained_and_late_validator_recorded(self):
        state,block,validators=self.fixture();out=u.consume(state,block,validators)
        second=copy.deepcopy(block);second['header']['last_block_id']['hash']='B'*64;second['commit']['height']='42452002';second['header']['height']='42452002';second['commit']['block_id']['hash']='D'*64
        second['commit']['signatures'][-1]=dict(second['commit']['signatures'][0],validator_address=validators[-1]['address'])
        final=u.consume(out,second,validators)
        self.assertEqual(final['firstSignatures'][validators[0]['address']],out['firstSignatures'][validators[0]['address']])
        self.assertEqual(final['firstSignatures'][validators[-1]['address']]['blocksAfterRestart'],1)
        self.assertTrue(final['complete'])
    def test_gaps_bad_signatures_and_insufficient_quorum_preserve_checkpoint(self):
        for mutate in [lambda b:b['commit'].update(height='42452003'),lambda b:b['header']['last_block_id'].update(hash='F'*64),lambda b:b['commit']['signatures'].pop(),lambda b:b['commit']['signatures'][0].update(validator_address='F'*40),lambda b:b['commit']['signatures'][0].update(block_id_flag=3),lambda b:b['commit']['signatures'][0].update(signature='bad')]:
            state,block,validators=self.fixture();old=copy.deepcopy(state);mutate(block)
            with self.assertRaises(ValueError):u.consume(state,block,validators)
            self.assertEqual(old,state)
    def test_observers_must_agree_on_signature_timestamps(self):
        _,block,_=self.fixture();a={'canonical':True,'signed_header':block};b=copy.deepcopy(a);b['signed_header']['commit']['signatures'][0]['timestamp']='2026-10-07T09:00:00Z'
        with self.assertRaises(ValueError):u.checked_commit([a,b],42452001,'juno-1')
        self.assertEqual(u.checked_commit([a,a],42452001,'juno-1'),block)
    def test_nil_does_not_set_first_block_signature(self):
        state,block,validators=self.fixture();block['commit']['signatures'][2]['block_id_flag']=3
        out=u.consume(state,block,validators);self.assertIsNone(out['firstSignatures'][validators[2]['address']])
    def test_closed_collection_never_requests_rpc_or_rewrites_saved_history(self):
        state,_,_=self.fixture()
        with tempfile.TemporaryDirectory() as directory:
            path=Path(directory)/'archive.json';path.write_text(json.dumps(state));before=path.read_bytes()
            for flag in [{'collect':False},{'collect':True,'tracking':{'status':'closed'}}]:
                upgrade={'id':'juno-v31','height':42452000,'chainId':'juno-1',**flag}
                with patch.object(u,'pair',side_effect=AssertionError('Closed event requested RPC')):
                    self.assertEqual(u.collect(upgrade,path),state)
                self.assertEqual(path.read_bytes(),before)
    def test_corrupt_checkpoint_is_rejected(self):
        state,block,validators=self.fixture();out=u.consume(state,block,validators);upgrade={'id':'juno-v31','height':42452000,'chainId':'juno-1'}
        u.validate_checkpoint(out,upgrade)
        out['firstSignatures'][validators[0]['address']]['secondsFromHalt']=0
        with self.assertRaises(ValueError):u.validate_checkpoint(out,upgrade)

if __name__=='__main__':unittest.main()
