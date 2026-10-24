// Read adapters only. Signing, proposal authorization and execution stay separate.
export async function deadline(promise, milliseconds, label) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(Error(`${label} TIMED OUT`)), milliseconds);
      })
    ]);
  } finally {
    clearTimeout(timer);
  }
}

export function governanceQueries({ review, mainnet, fetch: request = globalThis.fetch }) {
  const encode = (value) => encodeURIComponent(btoa(JSON.stringify(value)));
  async function read(rests, path, label, detail = false) {
    const failures = [];
    for (const base of rests) {
      try {
        const response = await request(`${base}${path}`, {
          cache: 'no-store',
          signal: AbortSignal.timeout(15000)
        });
        if (response.ok) return await response.json();
        const text = detail ? (await response.text()).replace(/\s+/g, ' ').slice(0, 240) : '';
        failures.push(`${base}: HTTP ${response.status}${text ? ` · ${text}` : ''}`);
      } catch (error) {
        failures.push(`${base}: ${label} · ${error.message}`);
      }
    }
    throw Error(failures.join(' · '));
  }
  async function query(value) {
    const { rests, contract } = review();
    return (
      await read(
        rests,
        `/cosmwasm/wasm/v1/contract/${contract}/smart/${encode(value)}`,
        'CONTRACT QUERY'
      )
    ).data;
  }
  const testnetGet = (path) => read(review().rests, path, 'UNI-7 QUERY', true);
  const nativeGet = (path) => read(mainnet().rests, path, 'JUNO GOVERNANCE QUERY');
  async function mainnetQuery(value) {
    const { rests, proposalModule } = mainnet();
    return (
      await read(
        rests,
        `/cosmwasm/wasm/v1/contract/${proposalModule}/smart/${encode(value)}`,
        'MAINNET QUERY'
      )
    ).data;
  }
  async function queryAll(pageQuery, cursorOf) {
    const rows = [];
    let cursor = null;
    for (let page = 0; page < 100; page++) {
      const batch = await query(pageQuery(cursor));
      rows.push(...batch);
      if (batch.length < 100) return rows;
      const next = cursorOf(batch.at(-1));
      if (next === cursor) throw Error('PAGINATION DID NOT ADVANCE');
      cursor = next;
    }
    throw Error('PAGINATION SAFETY LIMIT REACHED');
  }
  const hashHex = (value) =>
    /^[0-9a-f]{64}$/i.test(value || '')
      ? value.toLowerCase()
      : Array.from(
          Uint8Array.from(atob(value || ''), (c) => c.charCodeAt(0)),
          (b) => b.toString(16).padStart(2, '0')
        ).join('');
  async function findUploadedCode(checksum) {
    const { address } = review();
    let key = '';
    for (let page = 0; page < 100; page++) {
      const result = await testnetGet(
        `/cosmwasm/wasm/v1/code?pagination.limit=100${key ? `&pagination.key=${encodeURIComponent(key)}` : ''}`
      );
      const match = (result.code_infos || []).find(
        (info) => info.creator === address && hashHex(info.data_hash) === checksum.toLowerCase()
      );
      if (match) return { codeId: Number(match.code_id) };
      key = result.pagination?.next_key || '';
      if (!key) return null;
    }
    throw Error('CODE PAGINATION SAFETY LIMIT REACHED');
  }
  async function findReviewContract(codeId) {
    const { address } = review();
    const result = await testnetGet(
      `/cosmwasm/wasm/v1/contracts/creator/${address}?pagination.limit=100`
    );
    for (const contract of [...(result.contract_addresses || [])].reverse()) {
      const info = (await testnetGet(`/cosmwasm/wasm/v1/contract/${contract}`)).contract_info;
      if (
        Number(info?.code_id) === Number(codeId) &&
        info?.creator === address &&
        info?.label === 'Juno Governance Community Review · UNI-7'
      )
        return { contractAddress: contract };
    }
    return null;
  }
  async function transaction(hash) {
    for (const base of review().rests) {
      try {
        const response = await request(`${base}/cosmos/tx/v1beta1/txs/${hash}`, {
          cache: 'no-store',
          signal: AbortSignal.timeout(8000)
        });
        if (!response.ok) continue;
        const data = await response.json();
        if (data.tx_response?.txhash?.toUpperCase() === hash) return data;
      } catch {
        /* Unavailable is not evidence that a transaction failed. */
      }
    }
    return null;
  }
  return {
    query,
    testnetGet,
    nativeGet,
    mainnetQuery,
    queryAll,
    findUploadedCode,
    findReviewContract,
    transaction
  };
}
