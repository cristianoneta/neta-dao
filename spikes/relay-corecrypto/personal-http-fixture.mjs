// Test-only TLS fixture. Private keys are disposable and never fund real accounts.
import https from 'node:https';
import {execFileSync} from 'node:child_process';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createRequire} from 'node:module';
import {BackupStore} from '../../relay-backup/store.mjs';
import {backupServer} from '../../relay-backup/server.mjs';
const require=createRequire(new URL('../../relay-backup/package.json',import.meta.url));
const {Secp256k1Wallet}=require('@cosmjs/amino');
export async function personalHttpFixture(){
 const dir=await mkdtemp(join(tmpdir(),'personal-https-'));
 execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',join(dir,'key.pem'),'-out',join(dir,'cert.pem'),'-days','1','-subj','/CN=localhost','-addext','subjectAltName=IP:127.0.0.1'],{stdio:'ignore'});
 const tls={key:await readFile(join(dir,'key.pem')),cert:await readFile(join(dir,'cert.pem'))};
 const signers=await Promise.all([11,12].map(n=>Secp256k1Wallet.fromKey(new Uint8Array(32).fill(n),'juno')));
 const wallets=await Promise.all(signers.map(async s=>(await s.getAccounts())[0].address));
 let db=new BackupStore(join(dir,'backup.sqlite')),server,app,requests=0,preflights=0;
 const faults={offline:false,lostAck:false};
 const store={get:scope=>db.get(scope),put:(...args)=>db.put(...args)};
 return {tls,wallets,faults,
  async start(origin,contract){
   server=https.createServer(tls,(req,res)=>{
    requests++;if(req.method==='OPTIONS')preflights++;
    if(req.url==='/v1/backup'&&req.method==='PUT'){
     if(faults.offline){res.writeHead(503,{'access-control-allow-origin':origin,'content-type':'application/json'}).end('{}');return;}
     if(faults.lostAck){faults.lostAck=false;res.end=()=>res.destroy();}
    }
    app.emit('request',req,res);
   });
   await new Promise(r=>server.listen(0,'127.0.0.1',r));
   this.url='https://127.0.0.1:'+server.address().port;
   app=backupServer({store,origin,domain:this.url,chain:'juno-1',contract,allowedWallets:wallets});
   this.contract=contract;
  },
  async sign(wallet,message){
   const i=wallets.indexOf(wallet);if(i<0)throw Error('Unknown fixture wallet');
   const doc={chain_id:'',account_number:'0',sequence:'0',fee:{gas:'0',amount:[]},msgs:[{type:'sign/MsgSignData',value:{signer:wallet,data:Buffer.from(message).toString('base64')}}],memo:''};
   return (await signers[i].signAmino(wallet,doc)).signature;
  },
  get(wallet){const row=db.get(JSON.stringify(['juno-1',this.contract,wallet]));return row&&{...row,envelope:JSON.parse(row.blob)};},
  restartStorage(){db.close();db=new BackupStore(join(dir,'backup.sqlite'));},
  stats:()=>({requests,preflights}),
  async close(){if(server)await new Promise(r=>server.close(r));db.close();await rm(dir,{recursive:true,force:true});}
 };
}
