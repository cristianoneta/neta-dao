import { CoreCrypto, Database, DatabaseKey } from '@wireapp/core-crypto/native';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';

const encoder=new TextEncoder(), decoder=new TextDecoder();
const alice=CoreCrypto.new(await Database.inMemory());
const directory=await mkdtemp(join(tmpdir(),'neta-relay-'));
const key=randomBytes(32);
let bobDb=await Database.open(join(directory,'bob.db'),new DatabaseKey(key));
let bob=CoreCrypto.new(bobDb);
await alice.transaction(ctx=>ctx.proteusInit());
await bob.transaction(ctx=>ctx.proteusInit());
const prekey=await bob.transaction(ctx=>ctx.proteusNewPrekey(1));
const envelope=await alice.transaction(async ctx=>{
  await ctx.proteusSessionFromPrekey('bob',prekey);
  return ctx.proteusEncrypt('bob',encoder.encode('hello from Alice'));
});
// Reopen Bob's encrypted keystore before he sees the initial message.
bob.uniffiDestroy(); bobDb.uniffiDestroy();
bobDb=await Database.open(join(directory,'bob.db'),new DatabaseKey(key));
bob=CoreCrypto.new(bobDb);
await bob.transaction(ctx=>ctx.proteusInit());
const plaintext=await bob.transaction(ctx=>ctx.proteusDecryptSafe('alice',envelope));
if(decoder.decode(plaintext)!=='hello from Alice')throw Error('Initial message not recovered');
const reply=await bob.transaction(ctx=>ctx.proteusEncrypt('alice',encoder.encode('hello from Bob')));
const recovered=await alice.transaction(ctx=>ctx.proteusDecryptSafe('bob',reply));
if(decoder.decode(recovered)!=='hello from Bob')throw Error('Reply not recovered');
console.log(JSON.stringify({success:true,ciphertextBytes:envelope.length,plaintextVisible:decoder.decode(envelope).includes('hello from Alice')}));
await rm(directory,{recursive:true,force:true});
