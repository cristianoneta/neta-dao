import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
export const MAX_BACKUP_BYTES=8*1024*1024;
export class BackupStore{
  constructor(path,{maxTotalBytes=256*1024*1024,maxAccounts=1000,now=Date.now}={}){
    this.db=new DatabaseSync(path);Object.assign(this,{maxTotalBytes,maxAccounts,now});
    this.db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS backups (scope TEXT PRIMARY KEY, revision INTEGER NOT NULL, digest TEXT NOT NULL, blob TEXT NOT NULL, updated INTEGER NOT NULL)');
  }
  close(){this.db.close();}
  get(scope){const row=this.db.prepare('SELECT revision,digest,blob,updated FROM backups WHERE scope=?').get(scope);return row?{...row}:null;}
  put(scope,expectedRevision,blob){
    if(typeof scope!=='string'||scope.length>256||!Number.isSafeInteger(expectedRevision)||expectedRevision<0||typeof blob!=='string'||Buffer.byteLength(blob)>MAX_BACKUP_BYTES)throw Error('Invalid backup request');
    let parsed;try{parsed=JSON.parse(blob);}catch{throw Error('Invalid encrypted envelope');}
    const base64=(v,n)=>typeof v==='string'&&v.length<=MAX_BACKUP_BYTES&&Buffer.from(v,'base64').toString('base64')===v&&(!n||Buffer.from(v,'base64').length===n);
    if(parsed?.version!==1||parsed.scope!==scope||parsed.revision!==expectedRevision+1||
      !base64(parsed.salt,32)||!base64(parsed.iv,12)||!base64(parsed.ciphertext)||Buffer.from(parsed.ciphertext,'base64').length<16||
      Object.keys(parsed).sort().join(',')!=='ciphertext,iv,revision,salt,scope,version')throw Error('Invalid encrypted envelope');
    const digest=createHash('sha256').update(blob).digest('hex');
    this.db.exec('BEGIN IMMEDIATE');
    try{
      const old=this.get(scope);
      if(old?.revision===expectedRevision+1&&old.digest===digest){this.db.exec('COMMIT');return {revision:old.revision,digest:old.digest,updated:old.updated};}
      if((old?.revision||0)!==expectedRevision)throw Error('Revision conflict; preserve local state');
      const {bytes,count}=this.db.prepare('SELECT coalesce(sum(length(CAST(blob AS BLOB))),0) AS bytes,count(*) AS count FROM backups').get();
      if((!old&&count>=this.maxAccounts)||bytes-(old?Buffer.byteLength(old.blob):0)+Buffer.byteLength(blob)>this.maxTotalBytes)throw Error('Backup quota reached');
      const updated=this.now(),revision=expectedRevision+1;
      this.db.prepare('INSERT INTO backups VALUES (?,?,?,?,?) ON CONFLICT(scope) DO UPDATE SET revision=excluded.revision,digest=excluded.digest,blob=excluded.blob,updated=excluded.updated').run(scope,revision,digest,blob,updated);
      this.db.exec('COMMIT');return {revision,digest,updated};
    }catch(error){this.db.exec('ROLLBACK');throw error;}
  }
}
