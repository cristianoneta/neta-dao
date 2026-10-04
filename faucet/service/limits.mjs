// Application quotas, NOT a Render billing meter or a dollar spending cap.
export const DEFAULT_LIMITS=Object.freeze({requestsPerMinute:60,requestsPerDay:5000,requestsPerMonth:50000,payoutsPerDay:100,payoutsPerMonth:1000});
export function readLimits(env=process.env){
  const keys={requestsPerMinute:'FAUCET_REQUESTS_PER_MINUTE',requestsPerDay:'FAUCET_REQUESTS_PER_DAY',requestsPerMonth:'FAUCET_REQUESTS_PER_MONTH',payoutsPerDay:'FAUCET_PAYOUTS_PER_DAY',payoutsPerMonth:'FAUCET_PAYOUTS_PER_MONTH'};
  const limits={};
  for(const [key,name]of Object.entries(keys)){
    const raw=env[name];const value=raw===undefined?DEFAULT_LIMITS[key]:Number(raw);
    if(!Number.isSafeInteger(value)||value<1||value>DEFAULT_LIMITS[key])throw Error(`${name} must be a positive integer no greater than ${DEFAULT_LIMITS[key]}.`);
    limits[key]=value;
  }
  return limits;
}
export function periods(now){
  const d=new Date(now),year=d.getUTCFullYear(),month=d.getUTCMonth(),day=d.getUTCDate();
  return [
    {kind:'minute',start:Math.floor(now/60000)*60000,end:(Math.floor(now/60000)+1)*60000,key:'requestsPerMinute'},
    {kind:'day',start:Date.UTC(year,month,day),end:Date.UTC(year,month,day+1),key:'requestsPerDay'},
    {kind:'month',start:Date.UTC(year,month,1),end:Date.UTC(year,month+1,1),key:'requestsPerMonth'},
  ];
}
export class UsageGuard {
  constructor(ledger,limits=DEFAULT_LIMITS){
    this.ledger=ledger;this.db=ledger.db;this.limits={...DEFAULT_LIMITS,...limits};
    this.db.exec('CREATE TABLE IF NOT EXISTS request_usage(kind TEXT PRIMARY KEY,start INTEGER NOT NULL,n INTEGER NOT NULL); CREATE INDEX IF NOT EXISTS claims_created ON claims(created);');
  }
  // Synchronous transaction: concurrent requests and restarts cannot reset quota.
  admitRequest(){return this.ledger.transaction(()=>{
    const windows=periods(this.ledger.now());
    for(const p of [...windows].reverse()){
      const row=this.db.prepare('SELECT n FROM request_usage WHERE kind=? AND start=?').get(p.kind,p.start);
      if((row?.n||0)>=this.limits[p.key])return {reason:`Faucet ${p.kind} request limit reached. Please try later.`,retryAt:new Date(p.end).toISOString()};
    }
    for(const p of windows)this.db.prepare(`INSERT INTO request_usage(kind,start,n) VALUES(?,?,1)
      ON CONFLICT(kind) DO UPDATE SET start=excluded.start,n=CASE WHEN request_usage.start=excluded.start THEN request_usage.n+1 ELSE 1 END`).run(p.kind,p.start);
    return null;
  });}
  payoutPause(){
    for(const p of periods(this.ledger.now()).slice(1).reverse()){
      const n=this.db.prepare('SELECT COUNT(*) AS n FROM claims WHERE created>=?').get(p.start).n;
      const limit=this.limits[p.kind==='day'?'payoutsPerDay':'payoutsPerMonth'];
      if(n>=limit)return {reason:`Faucet ${p.kind} payout limit reached. Please try later.`,retryAt:new Date(p.end).toISOString()};
    }
    return null;
  }
  assertPayoutAllowed(){const pause=this.payoutPause();if(pause)throw Error(pause.reason);}
}
