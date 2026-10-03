import test from 'node:test';
import assert from 'node:assert/strict';
import {Secp256k1Wallet,serializeSignDoc} from '@cosmjs/amino';
import {toBase64,toUtf8} from '@cosmjs/encoding';
import {verifyOwnership,validAddress} from '../service/chain.mjs';
test('ADR-36 verifies wallet, exact challenge and signature',async()=>{
 const wallet=await Secp256k1Wallet.fromKey(new Uint8Array(32).fill(7),'juno');const [{address}]=await wallet.getAccounts();const message='NETA JUNOX faucet\nUnique nonce and expiry';
 const doc={chain_id:'',account_number:'0',sequence:'0',fee:{gas:'0',amount:[]},msgs:[{type:'sign/MsgSignData',value:{signer:address,data:toBase64(toUtf8(message))}}],memo:''};
 const {signature}=await wallet.signAmino(address,doc);assert.equal(await verifyOwnership(address,message,signature),true);
 assert.equal(await verifyOwnership(address,message+' changed',signature),false);assert.equal(await verifyOwnership('other',message,signature),false);assert.equal(await verifyOwnership(address,message,{...signature,signature:'invalid'}),false);
});

test('bech32 decoding remains compatible with pinned transitive dependencies',()=>{assert.equal(validAddress('juno1qurswpc8qurswpc8qurswpc8qurswpc89pyp8a'),true);assert.equal(validAddress('juno1qurswpc8qurswpc8qurswpc8qurswpc89pyp8b'),false);});
