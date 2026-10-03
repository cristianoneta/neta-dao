import http from 'node:http';
import {FaucetLedger,AMOUNT} from './ledger.mjs';
import {chainAdapter,validAddress,verifyOwnership} from './chain.mjs';
process.umask(0o077);
const origin=process.env.FAUCET_WEB_ORIGIN||'https://dao.netareborn.com';
const domain=process.env.FAUCET_PUBLIC_ORIGIN;
if(!domain||new URL(domain).protocol!=='https:'||new URL(domain).origin!==domain)throw Error('Set FAUCET_PUBLIC_ORIGIN to the HTTPS service origin.');
const adapter=await chainAdapter({rpc:process.env.FAUCET_RPC||'https://juno.test.rpc.nodeshub.online',mnemonicFile:process.env.FAUCET_MNEMONIC_FILE,expectedAddress:process.env.FAUCET_ADDRESS});
const ledger=new FaucetLedger(process.env.FAUCET_DB||'/data/faucet.sqlite',adapter,{verify:verifyOwnership,domain});
const buckets=new Map();
const server=http.createServer(async(req,res)=>{
  res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json');res.setHeader('X-Content-Type-Options','nosniff');
  if(req.headers.origin===origin){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');}
  const respond=(code,data)=>{res.writeHead(code);res.end(JSON.stringify(data));};
  try{
    const now=Date.now();for(const [ip,b]of buckets)if(b.until<now)buckets.delete(ip);
    const ip=req.socket.remoteAddress,b=buckets.get(ip)||{n:0,until:now+60000};b.n++;buckets.set(ip,b);
    if(b.n>120||buckets.size>10000)return respond(429,{error:'Too many requests. Please wait a minute.'});
    if(req.method==='OPTIONS'){
      if(req.headers.origin!==origin)return respond(403,{error:'Origin not allowed.'});
      res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');res.setHeader('Access-Control-Allow-Headers','Content-Type');return respond(204,{});
    }
    const url=new URL(req.url,'http://localhost');
    if(req.method==='GET'&&url.pathname==='/status'){
      const address=url.searchParams.get('address');if(address&&!validAddress(address))return respond(400,{error:'Invalid Juno wallet address.'});
      await ledger.reconcile();const balance=await adapter.balance();
      return respond(200,{chainId:'uni-7',address:adapter.address,amount:AMOUNT,intervalSeconds:86400,balance,ready:BigInt(balance)>=12000000n&&!ledger.blocked(),...(address?ledger.eligibility(address):{})});
    }
    if(req.method!=='POST'||!['/challenge','/claim'].includes(url.pathname))return respond(404,{error:'Not found.'});
    if(req.headers.origin!==origin)return respond(403,{error:'Origin not allowed.'});
    if(!req.headers['content-type']?.startsWith('application/json'))return respond(415,{error:'JSON required.'});
    const chunks=[];let length=0;for await(const chunk of req){length+=chunk.length;if(length>8192){respond(413,{error:'Request too large.'});req.destroy();return;}chunks.push(chunk);}
    const body=JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if(!validAddress(body.address)||body.address===adapter.address)return respond(400,{error:'Invalid payout recipient.'});
    if(url.pathname==='/challenge')return respond(200,ledger.challenge(body.address));
    if(typeof body.id!=='string'||!/^[0-9a-f]{48}$/.test(body.id))return respond(400,{error:'Invalid request id.'});
    return respond(200,await ledger.claim(body));
  }catch(error){
    // Never return secret-bearing RPC/configuration details or log request bodies.
    const allowed=/^(Only 10 JUNOX|Your previous payout|Wallet signature|Request a fresh|This request|The faucet is confirming|Please wait|Faucet is busy|Invalid payout recipient)/;
    respond(503,{error:allowed.test(error.message)?error.message:'Faucet temporarily unavailable. Refresh to check your payout status.'});
  }
});
server.requestTimeout=15000;server.headersTimeout=10000;
server.listen(Number(process.env.PORT||8787),process.env.HOST||'127.0.0.1',()=>console.log('UNI-7 faucet listening; account '+adapter.address));
// Restart recovery only checks inclusion. Never re-sign or rebroadcast automatically.
await ledger.reconcile();
