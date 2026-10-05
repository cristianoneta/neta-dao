// Offline publisher: consumes the existing collector output; makes no API requests.
import {createPrivateKey,createPublicKey,sign} from 'node:crypto';
import {readFileSync,mkdirSync,writeFileSync,renameSync} from 'node:fs';
import {dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {priceSnapshotPreimage,PRICE_SNAPSHOT_TTL} from '../names-v2-core.mjs';
import {CHAIN,NETA,DAO,POOL} from './service/constants.mjs';
import {validateSnapshotDeployment} from './snapshot-deployment.mjs';

// Fixed labels only: never log parser errors, key input, or environment values.
const diagnostics=Object.freeze({
  manifest:'Reviewed deployment manifest invalid.',
  key_format:'Price key must be a valid unencrypted PEM private key.',
  key_type:'Price key must use Ed25519.',
  key_mismatch:'Price key does not match the reviewed public key.',
  source:'Treasury price identity, value or freshness invalid.',
  signing:'Price signature could not be created.',
});
class PublicationError extends Error {
  constructor(code){super(diagnostics[code]);this.code=code;}
}
function checked(code,fn){try{return fn();}catch{throw new PublicationError(code);}}

export function priceFromTreasury(treasury,now) {
  const p=treasury?.nns_price;
  if(treasury?.chain_id!==CHAIN || treasury.treasury_address!==DAO || p?.token!==NETA || p.pool!==POOL || p.source!=='treasury-wynd-juno-usd') throw Error('Treasury price identity unavailable.');
  const observed=Math.floor(Date.parse(p.observed_at)/1000);
  if(!Number.isSafeInteger(now)||!Number.isSafeInteger(observed)||observed<=0||observed>now||now-observed>=PRICE_SNAPSHOT_TTL) throw Error('Treasury price missing, future-dated or expired.');
  // Decimal text, never IEEE-754 arithmetic. Truncate at 12 decimal places.
  if(typeof p.usd_price!=='string'||!/^\d{1,27}(?:\.\d{1,40})?$/.test(p.usd_price)) throw Error('Invalid treasury NETA price.');
  const [whole,fraction='']=p.usd_price.split('.');
  const scaled=BigInt(whole)*1000000000000n+BigInt((fraction+'000000000000').slice(0,12));
  if(scaled<=0n||scaled>=(1n<<128n)) throw Error('Treasury NETA price outside bounds.');
  return {usd_per_neta_12:scaled.toString(),observed_at:observed,expires_at:observed+PRICE_SNAPSHOT_TTL};
}

export function signTreasuryPrice({treasury,deployment,privateKeyPem,now=Math.floor(Date.now()/1000)}) {
  checked('manifest',()=>validateSnapshotDeployment(deployment));
  const privateKey=checked('key_format',()=>createPrivateKey(privateKeyPem));
  if(privateKey.asymmetricKeyType!=='ed25519') throw new PublicationError('key_type');
  const pub=checked('key_format',()=>createPublicKey(privateKey).export({format:'der',type:'spki'}).subarray(-32).toString('base64'));
  if(pub!==deployment.quote_public_key) throw new PublicationError('key_mismatch');
  const snapshot={signer_version:deployment.signer_version,...checked('source',()=>priceFromTreasury(treasury,now))};
  const signature=checked('signing',()=>sign(null,Buffer.from(priceSnapshotPreimage(deployment,deployment,snapshot)),privateKey).toString('base64'));
  return {schema_version:1,chain_id:CHAIN,registry:deployment.registry,token:NETA,treasury:DAO,snapshot,signature};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) {
  try {
    const [treasuryFile,manifestFile,output]=process.argv.slice(2);
    if(!treasuryFile||!manifestFile||!output) throw Error('Arguments required.');
    const signed=signTreasuryPrice({treasury:JSON.parse(readFileSync(treasuryFile,'utf8')),deployment:JSON.parse(readFileSync(manifestFile,'utf8')),privateKeyPem:process.env.NNS_PRICE_SIGNING_KEY});
    // Do not re-date an old collector result or overwrite with an older observation.
    let prior;try{prior=JSON.parse(readFileSync(output,'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
    if(prior?.snapshot?.observed_at>signed.snapshot.observed_at) throw Error('Refusing price timestamp rollback.');
    if(JSON.stringify(prior)===JSON.stringify(signed)) process.exit(0);
    mkdirSync(dirname(output),{recursive:true});
    writeFileSync(output+'.tmp',JSON.stringify(signed,null,2)+'\n');renameSync(output+'.tmp',output);
    console.log('Published signed NNS price; validity is anchored to the original treasury observation.');
  } catch (error) {
    // Never echo key material, parser input or environment in Actions logs.
    const detail=error instanceof PublicationError?diagnostics[error.code]:'Check public input/output files and price timestamp rollback.';
    console.error('NNS price publication failed; retained previous price. '+detail);process.exitCode=1;
  }
}
