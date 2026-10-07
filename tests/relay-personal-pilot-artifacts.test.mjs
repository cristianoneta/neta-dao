import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url);
test('published private pilot artifacts match the reviewed source manifest',async()=>{
  const manifest=JSON.parse(await readFile(new URL('docs/deployments/personal-pilot-artifacts-2026-10-07.json',root),'utf8'));
  assert.match(manifest.sourceCommit,/^[a-f0-9]{40}$/);
  assert.equal(manifest.publicInboxEnabled,false);
  for(const [path,hash] of Object.entries({...manifest.artifacts,...manifest.existingCryptoArtifacts})){
    const bytes=await readFile(new URL(path,root));
    assert.equal(createHash('sha256').update(bytes).digest('hex'),hash,path);
  }
  const html=await readFile(new URL('relay-personal-pilot.html',root),'utf8');
  for(const match of html.matchAll(/(?:src|href)="([^"#?]+)(?:[?#][^"]*)?"/g)){
    assert.ok((await readFile(new URL(match[1],root))).length,match[1]);
  }
  const index=await readFile(new URL('index.html',root),'utf8');
  assert.ok(!index.includes('relay-personal-pilot.js'));
  assert.ok(!index.includes('relay-personal-pilot-signing.js'));
  const receipts=JSON.parse(await readFile(new URL('docs/deployments/personal-mainnet-deployment-receipts-2026-10-07.json',root),'utf8'));
  assert.equal(manifest.contract,receipts.deployment.contract);
  assert.equal(manifest.codeId,receipts.deployment.codeId);
});
