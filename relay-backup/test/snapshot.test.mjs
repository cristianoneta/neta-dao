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
