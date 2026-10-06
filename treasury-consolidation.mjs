import {validateLedger, summarize, accountsFor} from './treasury-pnl.mjs?v=20261006-9';
const accountKey = t => `${t.chain_id}:${t.address}`;
export function assertDistinctAccounts(units) {
  const owners = new Map();
  for (const dao of units) for (const account of dao.accountingSource?.treasuries || []) {
    const key = accountKey(account);
    if (owners.has(key)) throw Error('Overlapping treasury accounts; consolidation unavailable');
    owners.set(key, dao.id);
  }
  return owners;
}
export function validateSnapshot(data, dao) {
  if (!data || data.chain_id !== dao.network || !Array.isArray(data.assets)
      || !Number.isFinite(Date.parse(data.generated_at)) || !['LIVE','PARTIAL'].includes(data.status)) throw Error('Treasury snapshot identity unavailable');
  if (dao.mode === 'native-gov') {
    if (data.treasury_type !== 'community-pool' || data.treasury_address !== null) throw Error('Community Pool identity mismatch');
  } else {
    if (data.treasury_address !== dao.core) throw Error('Treasury identity mismatch');
    const actual = data.treasury_accounts?.map(accountKey).sort();
    const expected = dao.accountingSource.treasuries.map(accountKey).sort();
    if (JSON.stringify(actual) !== JSON.stringify(expected)) throw Error('Treasury custody coverage mismatch');
  }
  const seen = new Set();
  for (const asset of data.assets) {
    const account = dao.accountingSource.treasuries.find(t => t.address === asset.custody_address && t.chain_id === `${asset.source_chain}-1`);
    if (!asset.key || (!account && dao.mode !== 'native-gov')) throw Error('Asset custody identity unavailable');
    const key = `${asset.source_chain}:${asset.custody_address}:${asset.key}`;
    if (seen.has(key)) throw Error('Duplicate treasury position');
    if (asset.usd_value != null && (!Number.isFinite(Number(asset.usd_value)) || Number(asset.usd_value) < 0)) throw Error('Invalid asset valuation');
    seen.add(key);
  }
  return data;
}
export function consolidateSnapshots(sources, now = Date.now()) {
  assertDistinctAccounts(sources.map(s => s.dao));
  const assets = [], warnings = [], components = [];
  for (const source of sources) {
    try {
      if (source.error) throw Error(source.error);
      const data = validateSnapshot(source.data, source.dao);
      const stale = now - Date.parse(data.generated_at) > 7200000 || Date.parse(data.generated_at) > now + 60000;
      assets.push(...data.assets.map(a => ({...a, unit_id:source.dao.id, unit_name:source.dao.unitName})));
      components.push({...source, stale});
      if (stale) warnings.push(`${source.dao.unitName}: balance snapshot is stale.`);
      warnings.push(...(data.warnings || []).map(w => `${source.dao.unitName}: ${w}`));
    } catch (error) {
      components.push({dao:source.dao, error:error.message});
      warnings.push(`${source.dao.unitName}: ${error.message}. Missing assets are not zero.`);
    }
  }
  const loaded = components.filter(c => c.data && !c.error);
  return {assets, warnings, components, loaded:loaded.length,
    total_usd:loaded.length ? assets.reduce((sum,a) => sum + Number(a.usd_value || 0),0) : null,
    oldest:loaded.length ? new Date(Math.min(...loaded.map(c => Date.parse(c.data.generated_at)))).toISOString() : null};
}
// Only common UTC dates, never carry a missing unit forward as a zero balance.
export function consolidateHistory(sources) {
  assertDistinctAccounts(sources.map(s => s.dao));
  if (!sources.length || sources.some(s => !s.data || s.error)) return [];
  const maps = sources.map(source => {
    const rows = new Map();
    for (const row of [...(source.history?.snapshots || []),source.data]) {
      if (!Array.isArray(row.assets) || !Number.isFinite(Date.parse(row.generated_at)) || !Number.isFinite(Number(row.total_usd))) continue;
      const day = row.generated_at.slice(0,10), old = rows.get(day);
      if (!old || Date.parse(old.generated_at) < Date.parse(row.generated_at)) rows.set(day,row);
    }
    return rows;
  });
  return [...maps[0].keys()].filter(day => maps.every(m => m.has(day))).sort().map(day => {
    const rows = maps.map(m => m.get(day));
    return {generated_at:day+'T23:59:59Z', total_usd:rows.reduce((sum,r)=>sum+Number(r.total_usd || 0),0),
      assets:rows.flatMap((r,i)=>r.assets.map(a=>({...a,key:`${sources[i].dao.id}:${a.key}`})))};
  });
}
// Exact paired same-chain legs may be eliminated from the organizational statement.
// IBC legs need packet linkage and are deliberately left unresolved here.
export function eliminateInternalTransfers(sources) {
  const owners = assertDistinctAccounts(sources.map(s=>s.dao));
  const copies = sources.map(s=>({...s,data:s.data ? structuredClone(s.data) : null}));
  const candidates = [];
  copies.forEach((s, index) => {
    const review = s.data?.movement_review;
    if (!review || review.unreviewed_movements !== review.movements?.filter(m=>m.classification==='unreviewed').length) return;
    for (const m of review.movements) {
      const chain = m.chain_id || s.dao.network, address = m.treasury_address || s.dao.core;
      if (m.classification !== 'unreviewed' || m.receipt_id !== null || m.usd_value !== null
          || !/^[A-F0-9]{64}$/.test(m.tx_hash) || !/^[1-9]\d*$/.test(m.raw_amount)
          || !Number.isFinite(Date.parse(m.timestamp)) || !['in','out'].includes(m.direction)
          || owners.get(`${chain}:${address}`) !== s.dao.id || !owners.has(`${chain}:${m.counterparty}`)
          || address === m.counterparty) continue;
      candidates.push({m,index,chain,address});
    }
  });
  const removed = new Set(); let pairs = 0;
  for (const a of candidates) {
    if (removed.has(a)) continue;
    const matches = candidates.filter(b => b !== a && !removed.has(b) && a.chain === b.chain
      && a.m.tx_hash === b.m.tx_hash && a.m.timestamp === b.m.timestamp && a.m.denom === b.m.denom
      && a.m.raw_amount === b.m.raw_amount && a.m.direction !== b.m.direction
      && a.address === b.m.counterparty && b.address === a.m.counterparty);
    if (matches.length !== 1) continue;
    const reverse = candidates.filter(c=>!removed.has(c) && c.chain===a.chain && c.m.tx_hash===a.m.tx_hash && c.m.timestamp===a.m.timestamp && c.m.denom===a.m.denom && c.m.raw_amount===a.m.raw_amount && c.m.direction===a.m.direction && c.address===a.address && c.m.counterparty===a.m.counterparty);
    if(reverse.length !== 1) continue;
    // Duplicate ids or ambiguous legs must never become reviewed by elimination.
    const b = matches[0];
    if ([a,b].some(c => copies[c.index].data.movement_review.movements.filter(m=>m.id===c.m.id).length !== 1)) continue;
    removed.add(a); removed.add(b); pairs++;
  }
  for (const c of removed) {
    const review = copies[c.index].data.movement_review;
    review.movements = review.movements.filter(m=>m!==c.m);
    review.unreviewed_movements--;
  }
  return {sources:copies, pairs};
}
export function summarizeOrganization(sources, range, now = Date.now()) {
  assertDistinctAccounts(sources.map(s=>s.dao));
  const valid = sources.map(s => {
    try { if (s.error) throw Error(s.error); return {...s,entries:validateLedger(s.data,s.dao)}; }
    catch(error) { return {...s,data:null,entries:[],error:error.message}; }
  });
  const adjusted = eliminateInternalTransfers(valid);
  const components = adjusted.sources.map(s=>({...s,summary:summarize(s.entries,range,accountsFor(s.dao),s.data,now)}));
  const ready = components.length > 0 && components.every(s=>!s.error && s.summary.provisional);
  const previousReady = components.length > 0 && components.every(s=>!s.error && s.summary.previousProvisional);
  const sum = (key,ok) => ok ? components.reduce((n,s)=>n+s.summary[key],0n) : null;
  const accountMap = new Map();
  for (const source of components) for (const a of source.summary.categories) {
    const existing = accountMap.get(a.id) || {...a, observed:null, previousObserved:null,rows:[]};
    if (a.observed !== null) existing.observed = (existing.observed ?? 0n) + a.observed;
    if (a.previousObserved !== null) existing.previousObserved = (existing.previousObserved ?? 0n) + a.previousObserved;
    existing.rows.push(...a.rows); accountMap.set(a.id,existing);
  }
  return {components, eliminatedPairs:adjusted.pairs, provisional:ready,previousProvisional:previousReady,
    income:sum('income',ready),expenses:sum('expenses',ready),result:sum('result',ready),
    previousIncome:sum('previousIncome',previousReady),previousExpenses:sum('previousExpenses',previousReady),previousResult:sum('previousResult',previousReady),
    categories:[...accountMap.values()]};
}
