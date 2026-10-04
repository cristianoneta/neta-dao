import {readFile} from 'node:fs/promises';
import {DirectSecp256k1HdWallet} from '@cosmjs/proto-signing';
import {SigningStargateClient,GasPrice,calculateFee} from '@cosmjs/stargate';
import {fromBech32,fromBase64,toBase64,toHex,toUtf8} from '@cosmjs/encoding';
import {pubkeyToAddress,serializeSignDoc} from '@cosmjs/amino';
import {Secp256k1,Secp256k1Signature,sha256} from '@cosmjs/crypto';
import {TxRaw} from 'cosmjs-types/cosmos/tx/v1beta1/tx';
import {AMOUNT} from './ledger.mjs';
import {transactionTransport} from './confirmation.mjs';
export function validAddress(address) {try{const x=fromBech32(address);return x.prefix==='juno'&&x.data.length===20;}catch{return false;}}
export async function verifyOwnership(address,message,signature) {
  try {
    if(signature?.pub_key?.type!=='tendermint/PubKeySecp256k1'||pubkeyToAddress(signature.pub_key,'juno')!==address)return false;
    const doc={chain_id:'',account_number:'0',sequence:'0',fee:{gas:'0',amount:[]},msgs:[{type:'sign/MsgSignData',value:{signer:address,data:toBase64(toUtf8(message))}}],memo:''};
    return await Secp256k1.verifySignature(Secp256k1Signature.fromFixedLength(fromBase64(signature.signature)),sha256(serializeSignDoc(doc)),fromBase64(signature.pub_key.value));
  }catch{return false;}
}
export async function chainAdapter({rpc,mnemonicFile,expectedAddress}) {
  if(!validAddress(expectedAddress))throw Error('Set FAUCET_ADDRESS to the dedicated UNI-7 faucet account.');
  const mnemonic=(await readFile(mnemonicFile,'utf8')).trim().split(/\s+/).join(' ');
  let wallet;
  try{wallet=await DirectSecp256k1HdWallet.fromMnemonic(mnemonic,{prefix:'juno'});}
  catch{throw Error('Invalid faucet recovery phrase. Check the private secret file; never share its contents.');}
  const [{address}]=await wallet.getAccounts();
  if(address!==expectedAddress)throw Error('Faucet signing account does not match FAUCET_ADDRESS.');
  const client=await SigningStargateClient.connectWithSigner(rpc,wallet,{gasPrice:GasPrice.fromString('0.2ujunox')});
  async function identity(){if(await client.getChainId()!=='uni-7')throw Error('UNI-7 network mismatch. Payouts disabled.');}
  await identity();
  return {
    address,
    ...transactionTransport(client,{rpc}),
    async balance(){await identity();return (await client.getBalance(address,'ujunox')).amount;},
    async prepare(recipient){
      await identity();if(!validAddress(recipient)||recipient===address)throw Error('Invalid payout recipient.');
      const messages=[{typeUrl:'/cosmos.bank.v1beta1.MsgSend',value:{fromAddress:address,toAddress:recipient,amount:[{denom:'ujunox',amount:AMOUNT}]}}];
      const memo='NETA faucet · 10 JUNOX / 24h';
      const gas=await client.simulate(address,messages,memo);
      if(!Number.isSafeInteger(gas)||gas<=0||gas>500000)throw Error('Unsafe payout gas estimate.');
      const fee=calculateFee(Math.ceil(gas*1.4),GasPrice.fromString('0.2ujunox'));
      const signed=await client.sign(address,messages,fee,memo),bytes=TxRaw.encode(signed).finish();
      return {hash:toHex(sha256(bytes)).toUpperCase(),bytes:toBase64(bytes)};
    },
    close(){client.disconnect();}
  };
}
