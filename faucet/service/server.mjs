import {FaucetLedger} from './ledger.mjs';
import {chainAdapter,verifyOwnership} from './chain.mjs';
import {readLimits} from './limits.mjs';
import {createFaucetServer} from './http.mjs';
import {openRelayBackup} from './relay-backup.mjs';
process.umask(0o077);
const origin=process.env.FAUCET_WEB_ORIGIN||'https://dao.netareborn.com';
const domain=process.env.FAUCET_PUBLIC_ORIGIN;
if(!domain||new URL(domain).protocol!=='https:'||new URL(domain).origin!==domain)throw Error('Set FAUCET_PUBLIC_ORIGIN to the HTTPS service origin.');
const limits=readLimits();
if(process.env.FAUCET_PAUSED!==undefined&&!['true','false'].includes(process.env.FAUCET_PAUSED))throw Error('FAUCET_PAUSED must be true or false.');
const adapter=await chainAdapter({rpc:process.env.FAUCET_RPC||'https://juno.test.rpc.nodeshub.online',mnemonicFile:process.env.FAUCET_MNEMONIC_FILE,expectedAddress:process.env.FAUCET_ADDRESS});
const ledger=new FaucetLedger(process.env.FAUCET_DB||'/data/faucet.sqlite',adapter,{verify:verifyOwnership,domain,limits});
let relay;
try{relay=await openRelayBackup();}catch{console.error('RELAY backup unavailable: check its configuration; faucet remains active.');}
const server=createFaucetServer({ledger,adapter,origin,paused:process.env.FAUCET_PAUSED==='true',backup:relay?.server});
server.listen(Number(process.env.PORT||8787),process.env.HOST||'127.0.0.1',()=>console.log('UNI-7 faucet listening; account '+adapter.address));
process.on('SIGTERM',()=>server.close(()=>{relay?.close();ledger.close();process.exit(0);}));
// Recovery on status/claim checks inclusion only. Never re-sign or rebroadcast automatically.
