const fields = ['title', 'summary', 'body', 'actions_json'];

// A matching title or author alone can select an older, unrelated proposal.
export function publishedReview(rows, intent) {
  const matches = rows.filter(
    ({ proposal, latest_revision: revision }) =>
      Number.isSafeInteger(proposal?.id) &&
      proposal.id > intent.after &&
      proposal.author === intent.author &&
      revision?.version === 1 &&
      fields.every((key) => revision[key] === intent.values[key])
  );
  if (matches.length > 1)
    throw Error(
      'Multiple matching reviews found. Open the correct review from the list; do not publish again.'
    );
  return matches[0] || null;
}

export function indexingUnavailable(error) {
  const seen = new Set();
  for (let current = error; current && !seen.has(current); current = current.cause) {
    seen.add(current);
    if (
      /transaction indexing is disabled/i.test(
        [current.message, current.data, String(current)].join(' ')
      )
    )
      return true;
  }
  return false;
}

export function reviewEventId(result, contract) {
  for (const event of result?.events || []) {
    if (event.type !== 'wasm') continue;
    const attributes = Object.fromEntries(
      (event.attributes || []).map(({ key, value }) => [key, value])
    );
    if (attributes._contract_address !== contract) continue;
    const id = Number(attributes.proposal_id);
    if (Number.isSafeInteger(id) && id > 0) return id;
  }
  return null;
}

// Use the same account lock as the shipped signing client. Only a confirmed
// receipt for the exact saved signed bytes can release its pending journal.
export async function reconcileReviewTransaction({
  storage,
  locks,
  sender,
  fetchTx,
  assertCurrent = () => {},
  onConfirmed = () => {}
}) {
  const key = `neta-pending-tx-v1:uni-7:${sender}`;
  if (!locks?.request) throw Error('Device transaction lock unavailable.');
  return locks.request(key, { mode: 'exclusive', ifAvailable: true }, async (lock) => {
    if (!lock) throw Error('Another tab is processing this transaction.');
    const saved = storage.getItem(key);
    if (!saved) return null;
    const journal = JSON.parse(saved);
    if (
      journal.version !== 1 ||
      journal.chain !== 'uni-7' ||
      journal.sender !== sender ||
      journal.status !== 'pending' ||
      !/^[0-9A-F]{64}$/.test(journal.hash) ||
      typeof journal.bytes !== 'string'
    )
      throw Error(
        'Interrupted or invalid transaction record. Check wallet history; signing remains locked.'
      );
    const bytes = Uint8Array.from(atob(journal.bytes), (c) => c.charCodeAt(0));
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), (b) =>
      b.toString(16).padStart(2, '0')
    )
      .join('')
      .toUpperCase();
    if (hash !== journal.hash)
      throw Error('Transaction record checksum mismatch. Signing remains locked.');
    const data = await fetchTx(hash);
    const result = data?.tx_response;
    const height = Number(result?.height);
    if (
      result?.txhash?.toUpperCase() !== hash ||
      !Number.isSafeInteger(height) ||
      height < 1 ||
      !Number.isInteger(result.code) ||
      result.code < 0
    )
      throw Error(
        'Transaction is still unconfirmed. Check its status again; no new signature is needed.'
      );
    if (storage.getItem(key) !== saved)
      throw Error('Transaction record changed. Check status again.');
    assertCurrent();
    const receipt = { ...result, transactionHash: hash, height };
    await onConfirmed(receipt);
    assertCurrent();
    if (storage.getItem(key) !== saved)
      throw Error('Transaction record changed. Check status again.');
    storage.removeItem(key);
    return receipt;
  });
}

export async function copyReviewLink(url, { clipboard, input, feedback }) {
  try {
    if (!clipboard?.writeText) throw Error('Clipboard unavailable');
    await clipboard.writeText(url);
    input.hidden = true;
    feedback.textContent = 'Review link copied.';
    return true;
  } catch {
    input.value = url;
    input.hidden = false;
    input.focus();
    input.select();
    feedback.textContent = 'Select and copy this review link.';
    return false;
  }
}
