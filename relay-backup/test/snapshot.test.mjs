import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {BackupStore} from '../store.mjs';
import {exportBackupDatabase} from '../snapshot.mjs';

test('live WAL export preserves encrypted revisions and never overwrites a destination',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'relay-export-')),file=join(directory,'live.sqlite'),output=join(directory,'export.sqlite');
  const live=new BackupStore(file);let restored;
  try{
    live.db.prepare('INSERT INTO backups VALUES (?,?,?,?,?)').run('scope',7,'digest','encrypted fixture',123);
    await exportBackupDatabase(file,output);
    live.db.prepare('UPDATE backups SET revision=8 WHERE scope=?').run('scope');
    restored=new BackupStore(output);assert.equal(restored.get('scope').revision,7);assert.equal(restored.get('scope').blob,'encrypted fixture');
    assert.equal(live.get('scope').revision,8);
    await assert.rejects(exportBackupDatabase(file,output),/exist/i);assert.equal(restored.get('scope').revision,7);
    await assert.rejects(exportBackupDatabase(file,file),/distinct/);
  }finally{restored?.close();live.close();await rm(directory,{recursive:true,force:true});}
});

test('encrypted snapshot restores in a separate process and preserves read-only recovery',async()=>{
  const {spawnSync}=await import('node:child_process');
  const {sealPersonalBackup,openPersonalBackup,personalBackupScope}=await import('../../relay-personal-backup.mjs');
  const directory=await mkdtemp(join(tmpdir(),'relay-process-drill-'));
  const file=join(directory,'live.sqlite'),output=join(directory,'independent-copy','snapshot.sqlite');
  const identity={chain:'juno-1',contract:'juno1'+'a'.repeat(58),wallet:'juno1'+'a'.repeat(38)};
  const scope=personalBackupScope(identity),code='7'.repeat(64),path='relay-'+'1'.repeat(24)+'.db';
  const snapshot={version:1,scope,corecryptoVersion:'10.5.3',descriptor:{fingerprint:'a'.repeat(64),generation:1},
    wrappedKey:'encrypted fixture',path,blocks:[{path,offset:0,data:[1,2,3]}],archiveRecords:[{text:'synthetic drill'}],
    sendRecords:[{state:'pending',id:'1'.repeat(64)}],transactionIntents:[{status:'unknown'}],registrationIntent:null,cursor:8};
  let live=new BackupStore(file);
  try{
    const envelope=await sealPersonalBackup(identity,1,snapshot,code),receipt=live.put(scope,0,JSON.stringify(envelope));
    await exportBackupDatabase(file,output);live.close();live=null;
    const result=spawnSync(process.execPath,['--input-type=module','-e',`
      import {BackupStore} from ${JSON.stringify(new URL('../store.mjs',import.meta.url).href)};
      const store=new BackupStore(process.argv[1]);
      try{process.stdout.write(JSON.stringify(store.get(process.argv[2])));}finally{store.close();}
    `,output,scope],{encoding:'utf8'});
    assert.equal(result.status,0,result.stderr);
    const recovered=JSON.parse(result.stdout);assert.equal(recovered.digest,receipt.digest);
    const opened=await openPersonalBackup(identity,JSON.parse(recovered.blob),code,{minimumRevision:1,expectedDigest:receipt.digest});
    assert.equal(opened.writesAllowed,false);assert.deepEqual(opened.snapshot,snapshot);
    live=new BackupStore(file);assert.equal(live.get(scope).digest,receipt.digest);
  }finally{live?.close();await rm(directory,{recursive:true,force:true});}
});
