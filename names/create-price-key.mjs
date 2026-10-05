// Run locally once. Never generate or print a private key in Actions logs.
import {generateKeyPairSync} from 'node:crypto';
import {writeFileSync} from 'node:fs';
import {resolve,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
const output=process.argv[2];
if(!output) throw Error('Usage: node names/create-price-key.mjs <private-file-outside-repository>');
const repo=resolve(fileURLToPath(new URL('..',import.meta.url)));
const rel=relative(repo,resolve(output));
if(!rel.startsWith('..')) throw Error('Choose a private file outside the repository.');
const {privateKey,publicKey}=generateKeyPairSync('ed25519');
writeFileSync(output,privateKey.export({format:'pem',type:'pkcs8'}),{flag:'wx',mode:0o600});
console.log('Public key: '+publicKey.export({format:'der',type:'spki'}).subarray(-32).toString('base64'));
console.log('Private key saved with restricted permissions. Store it as the NNS_PRICE_SIGNING_KEY Actions secret and keep a private backup. Do not commit it or paste it into chat.');
