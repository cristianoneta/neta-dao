import { validateLedger, accountsFor } from './treasury-pnl.mjs?v=20261006-9';

// Exact receipt-to-movement matches only. A direction or proposal title is not an account.
export function eventTags(event, data, dao) {
  let receipts = [];
  try { receipts = validateLedger(data, dao); } catch { /* Unknown source: keep unclassified. */ }
  const accounts = accountsFor(dao), used = new Set();
  const tags = (event.movements || []).map(movement => {
    if(data?.schema_version===4 && receipts.length && data.reward_settlements?.some(r=>r.tx_hash===event.tx_hash && r.timestamp===event.timestamp && r.denom===movement.denom && r.raw_amount===movement.raw_amount && r.direction===movement.direction && r.counterparty===movement.counterparty)) return 'Reward claim · already accrued';
    const generic = data?.schema_version >= 2;
    const matches = receipts.filter(row => row.chain_id === event.chain_id && row.treasury_address === event.treasury_address
      && (!['block-distribution','staking-accrual'].includes(event.evidence?.kind) || row.id === movement.id)
      && row.tx_hash === event.tx_hash && row.timestamp === event.timestamp && row.message_index === movement.message_index
      && movement.direction === 'in' && movement.denom === (generic ? row.denom : `cw20:${row.token}`)
      && movement.counterparty === (generic ? row.counterparty : row.registry) && movement.raw_amount === row.raw_amount);
    const receipt = matches.length === 1 ? matches[0] : null;
    if (!receipt || used.has(receipt.id)) return 'Unclassified';
    used.add(receipt.id);
    if (generic && receipt.category === "funding") return "Funding · Community Pool contribution";
    const account = accounts.find(a => a.id === receipt.category);
    return account ? `${account.section === 'income' ? 'Income' : 'Expense'} · ${account.label}` : 'Unclassified';
  });
  return [...new Set(tags.length ? tags : ['Unclassified'])];
}
