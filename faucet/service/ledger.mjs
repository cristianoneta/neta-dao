import {DatabaseSync} from 'node:sqlite';
import {randomBytes} from 'node:crypto';
import {UsageGuard,DEFAULT_LIMITS} from './limits.mjs';
export const DAY=86400000, AMOUNT='10000000';
export class FaucetLedger {
  constructor(file,adapter,{now=Date.now,verify,domain,limits=DEFAULT_LIMITS}={}) {
    this.db=new DatabaseSync(file);this.adapter=adapter;this.now=now;this.verify=verify;this.domain=domain;
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS challenges(id TEXT PRIMARY KEY,address TEXT NOT NULL,message TEXT NOT NULL,expires INTEGER NOT NULL,used INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE IF NOT EXISTS claims(id TEXT PRIMARY KEY,address TEXT NOT NULL,status TEXT NOT NULL,slot INTEGER UNIQUE,hash TEXT,bytes TEXT,confirmed INTEGER,created INTEGER NOT NULL);
      CREATE INDEX IF NOT EXISTS claims_address ON claims(address,confirmed);`);
    this.guard=new UsageGuard(this,limits);
  }
  transaction(fn) { this.db.exec('BEGIN IMMEDIATE');try{const result=fn();this.db.exec('COMMIT');return result;}catch(e){this.db.exec('ROLLBACK');throw e;} }
  eligibility(address) {
    const pending=this.db.prepare("SELECT id,hash,status FROM claims WHERE address=? AND status IN ('signing','pending')").get(address);
    const last=this.db.prepare("SELECT MAX(confirmed) AS confirmed FROM claims WHERE address=? AND status='confirmed'").get(address)?.confirmed;
    return {pending:!!pending,hash:pending?.hash||null,nextClaimAt:last?new Date(last+DAY).toISOString():null};
  }
  assertEligible(address) {
    const e=this.eligibility(address);
    if(e.pending)throw Error('Your previous payout is pending. Refresh to check its outcome.');
    if(e.nextClaimAt && Date.parse(e.nextClaimAt)>this.now())throw Error('Only 10 JUNOX per wallet every 24 hours. Next payout: '+e.nextClaimAt);
  }
  challenge(address) {
    this.guard.assertPayoutAllowed();
    this.assertEligible(address);
    return this.transaction(()=>{
      this.db.prepare('DELETE FROM challenges WHERE expires < ?').run(this.now());
      if(this.db.prepare('SELECT COUNT(*) AS n FROM challenges').get().n>=10000)throw Error('Faucet is busy. Try later.');
      const recent=this.db.prepare('SELECT id FROM challenges WHERE address=? AND expires>?').get(address,this.now()+240000);
      if(recent)throw Error('Please wait a minute before requesting another wallet signature.');
      const id=randomBytes(24).toString('hex'),expires=this.now()+300000;
      const message=`NETA JUNOX faucet\nService: ${this.domain}\nNetwork: uni-7\nWallet: ${address}\nRequest: exactly 10 JUNOX\nLimit: once per 24 hours per wallet\nNonce: ${id}\nExpires: ${new Date(expires).toISOString()}\nThis signature proves wallet ownership. It does not authorize spending.`;
      this.db.prepare('INSERT INTO challenges(id,address,message,expires) VALUES(?,?,?,?)').run(id,address,message,expires);
      return {id,address,chainId:'uni-7',message};
    });
  }
  async reconcile() {
    const rows=this.db.prepare("SELECT * FROM claims WHERE status='pending'").all();
    for(const row of rows) {
      let result;try{result=await this.adapter.lookup(row.hash);}catch{continue;}
      if(!result||result.hash?.toUpperCase()!==row.hash||!Number.isSafeInteger(result.height)||result.height<1||!Number.isInteger(result.code))continue;
      this.db.prepare('UPDATE claims SET status=?,confirmed=?,slot=NULL WHERE id=? AND status=?').run(result.code===0?'confirmed':'failed',result.code===0?this.now():null,row.id,'pending');
    }
  }
  async claim({id,address,signature}) {
    const challenge=this.db.prepare('SELECT * FROM challenges WHERE id=? AND address=?').get(id,address);
    if(!challenge)throw Error('Request a fresh wallet signature.');
    // Authenticate even when replaying an id; the same id always returns its existing outcome.
    if(!await this.verify(address,challenge.message,signature))throw Error('Wallet signature is invalid.');
    const previous=this.db.prepare('SELECT status,hash FROM claims WHERE id=?').get(id);
    if(previous)return previous;
    if(challenge.expires<this.now()||challenge.used)throw Error('Wallet signature expired. Request again.');
    await this.reconcile();
    this.transaction(()=>{
      this.guard.assertPayoutAllowed();
      this.assertEligible(address);
      if(this.db.prepare('SELECT id FROM claims WHERE slot=1').get())throw Error('The faucet is confirming a previous payout. Try again later.');
      if(this.db.prepare('SELECT used FROM challenges WHERE id=?').get(id)?.used)throw Error('This request was already submitted.');
      this.db.prepare('UPDATE challenges SET used=1 WHERE id=?').run(id);
      this.db.prepare("INSERT INTO claims(id,address,status,slot,created) VALUES(?,?,'signing',1,?)").run(id,address,this.now());
    });
    let prepared;
    try { prepared=await this.adapter.prepare(address); }
    catch(error) { // prepare never broadcasts; safe to release this reservation.
      this.db.prepare("UPDATE claims SET status='failed',slot=NULL WHERE id=?").run(id);throw error;
    }
    // Persist public signed bytes BEFORE the only broadcast attempt. A crash during
    // signing remains locked; restart never clears or creates a replacement payment.
    if(!/^[0-9A-F]{64}$/.test(prepared.hash)||!prepared.bytes)throw Error('Invalid signed payout; service locked for inspection.');
    this.db.prepare("UPDATE claims SET status='pending',hash=?,bytes=? WHERE id=?").run(prepared.hash,prepared.bytes,id);
    try{await this.adapter.broadcast(prepared.bytes);}catch{/* Unknown outcome: reconcile by exact hash only. */}
    await this.reconcile();
    return this.db.prepare('SELECT status,hash FROM claims WHERE id=?').get(id);
  }
  blocked() { return !!this.db.prepare('SELECT id FROM claims WHERE slot=1').get(); }
  close(){this.db.close();}
}
