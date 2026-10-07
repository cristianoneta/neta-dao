// Operator-only consistent SQLite export; never exposed as an HTTP endpoint.
import {DatabaseSync,backup} from 'node:sqlite';
import {resolve,dirname,join} from 'node:path';
import {mkdir,mkdtemp,link,rm,chmod} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';

export async function exportBackupDatabase(source,destination){
  if(!source||!destination||resolve(source)===resolve(destination))throw Error('Choose distinct source and destination files');
  const target=resolve(destination);await mkdir(dirname(target),{recursive:true,mode:0o700});
  const temporary=await mkdtemp(join(dirname(target),'.relay-export-'));
  let db;
  try{
    db=new DatabaseSync(resolve(source),{readOnly:true});
    if(db.prepare('PRAGMA quick_check').get().quick_check!=='ok')throw Error('Source database integrity check failed');
    db.prepare('SELECT scope,revision,digest,blob,updated FROM backups LIMIT 0').all();
    const copy=join(temporary,'backup.sqlite');await backup(db,copy);await chmod(copy,0o600);
    const check=new DatabaseSync(copy,{readOnly:true});
    try{if(check.prepare('PRAGMA quick_check').get().quick_check!=='ok')throw Error('Export integrity check failed');}finally{check.close();}
    // Exclusive publication: never replace an existing operator backup or ledger.
    await link(copy,target);return target;
  }finally{db?.close();await rm(temporary,{recursive:true,force:true});}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  process.umask(0o077);
  const [source,destination]=process.argv.slice(2);
  await exportBackupDatabase(source,destination);console.log('Encrypted backup database exported and checked.');
}
