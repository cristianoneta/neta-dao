// Receipt reviews for configured treasury accounts. Direction never defines P&L purpose.
const start = '2026-10-01T00:00:00Z';
const nonOperating = new Set(['funding']);
const sameAccounts = (a, b) => Array.isArray(a) && Array.isArray(b) && a.length === b.length
  && new Set(a.map(t => `${t.chain_id}:${t.address}`)).size === a.length
  && a.every(t => b.some(x => x.chain_id === t.chain_id && x.address === t.address));
export function validateEventFeed(data, dao) {
  const config = dao?.accountingSource;
  const accounts = config?.treasuries || (dao?.id === 'neta' ? [{chain_id:dao.network,address:dao.core}] : null);
  const scope = config?.scope || (dao?.id === 'neta' ? 'neta-main-dao' : null);
  return !!(accounts && data?.scope === scope && sameAccounts(data.treasuries, accounts)
    && Array.isArray(data.events) && data.events.every(row => accounts.some(t => t.chain_id === row.chain_id && t.address === row.treasury_address))
    && new Set(data.events.map(row => row.id)).size === data.events.length);
}
export function validateGenericLedger(data, dao) {
  const config = dao?.accountingSource;
  if (!config || data?.schema_version !== 2 || data.dao_id !== dao.id || data.scope !== config.scope
      || data.chain_id !== dao.network || data.adapter !== config.adapter || data.accounting_start !== start
      || !['treasury-receipts','native-community-pool'].includes(config.adapter)
      || !sameAccounts(data.treasuries, config.treasuries) || !Array.isArray(data.entries)
      || (dao.id === 'juno' && !data.coverage_gaps?.length)) throw Error('Accounting source identity unavailable');
  const ids = new Set();
  for (const row of data.entries) {
    if (!config.treasuries.some(t => t.chain_id === row.chain_id && t.address === row.treasury_address)
        || !/^[A-F0-9]{64}$/.test(row.tx_hash) || !/^\d+$/.test(row.raw_amount) || BigInt(row.raw_amount) <= 0n
        || !row.id.startsWith(`${row.chain_id}:${row.tx_hash}:`) || !/^\d+$/.test(row.id.split(':').at(-1))
        || !Number.isFinite(Date.parse(row.timestamp)) || Date.parse(row.timestamp) < Date.parse(start)
        || !nonOperating.has(row.category) || dao.id !== 'juno' || row.direction !== 'in'
        || row.usd_value !== null || row.evidence?.kind !== 'provider-receipt' || ids.has(row.id)) throw Error('Accounting receipt validation failed');
    ids.add(row.id);
  }
  return data.entries;
}
export function reviewedGenericPeriod(entries, data, from, to, now) {
  const review = data?.movement_review, refreshed = Date.parse(data?.last_success_at);
  if (data.refresh_status !== 'completed' || review?.status !== 'PARTIAL' || review.event_refresh_status !== 'PARTIAL'
      || review.accounting_start !== start || !Array.isArray(review.movements) || !Array.isArray(review.unmatched_receipt_ids)
      || !Array.isArray(data.coverage_gaps) || data.coverage_gaps.length || data.execution_candidates?.length
      || !sameAccounts(data.sources, data.treasuries) || data.sources.some(s => s.adapter !== 'cosmos-rest-receipts' || s.accounting_start !== start || !s.anchor_hash || !(s.last_scanned_height > 0))
      || !Number.isFinite(refreshed) || refreshed > now + 60000 || from >= to || to <= Date.parse(start) || from >= refreshed
      || (to > refreshed && now - refreshed > 7200000)) return false;
  const inside = t => Date.parse(t) >= Math.max(Date.parse(start),from) && Date.parse(t) < to;
  const ids = new Set(), matched = new Set(), receipts = new Map(entries.map(r=>[r.id,r]));
  let unresolved = 0, blocked = false;
  for (const m of review.movements) {
    if (!m || ids.has(m.id) || typeof m.id !== 'string' || !Number.isFinite(Date.parse(m.timestamp))
        || !['in','out'].includes(m.direction) || !/^[1-9]\d*$/.test(m.raw_amount)
        || !data.treasuries.some(t=>t.chain_id===m.chain_id && t.address===m.treasury_address)) return false;
    ids.add(m.id);
    if (m.classification === 'unreviewed' && m.receipt_id === null && m.usd_value === null) {
      unresolved++; if (inside(m.timestamp)) blocked = true; continue;
    }
    const r = receipts.get(m.receipt_id);
    if (!r || matched.has(r.id) || m.classification !== r.category || m.id !== r.id
        || ['tx_hash','timestamp','chain_id','treasury_address','direction','denom','counterparty','raw_amount','usd_value'].some(k=>m[k]!==r[k])) return false;
    matched.add(r.id);
  }
  if (unresolved !== review.unreviewed_movements || matched.size !== review.matched_receipts
      || review.unmatched_receipt_ids.length || entries.some(r=>!matched.has(r.id))) return false;
  return !blocked;
}
