import { SCOPES, GOVERNANCE_READ_PATH } from './governance-query.mjs';

export const escapeHTML = (value) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );
const plain = (text) => text.replace(/\\([\p{P}\p{S}])/gu, '$1');
export const isClosed = (p) =>
  ['Passed', 'Accepted', 'Executed', 'Rejected', 'Failed', 'Cancelled', 'Expired'].includes(
    p.status
  );
export const isOpen = (p) =>
  ['Deposit', 'Voting', 'Active', 'Pending', 'Upcoming'].includes(p.status);
const uint = (value) => typeof value === 'string' && /^\d+$/.test(value);
export function rpcText(json) {
  const r = json?.result?.response,
    b = r?.ResponseBase || r;
  if (!b || json.error || b.Error || b.error || (b.code && b.code !== 0))
    throw Error('The realm query failed.');
  const encoded = b.Data ?? b.data ?? r.Value;
  if (typeof encoded !== 'string' || !encoded) throw Error('The realm returned no readable data.');
  return new TextDecoder('utf-8', { fatal: true }).decode(
    Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0))
  );
}
export function readNode(scope, json) {
  const h = json?.block?.header || json?.sdk_block?.header;
  const network = scope === 'atomone' ? h?.chain_id : json?.result?.node_info?.network;
  const height = scope === 'atomone' ? h?.height : json?.result?.sync_info?.latest_block_height;
  const time = scope === 'atomone' ? h?.time : json?.result?.sync_info?.latest_block_time;
  if (network !== SCOPES[scope].chain || !uint(height) || !Number.isFinite(Date.parse(time)))
    throw Error('The source returned an unexpected network or block.');
  if (json?.result?.sync_info?.catching_up) throw Error('The source is still syncing.');
  if (
    Date.now() - Date.parse(time) > 30 * 60 * 1000 ||
    Date.parse(time) - Date.now() > 5 * 60 * 1000
  )
    throw Error('The source block is not current.');
  return { network, height, time };
}
const cosmosStatuses = {
  PROPOSAL_STATUS_DEPOSIT_PERIOD: 'Deposit',
  PROPOSAL_STATUS_VOTING_PERIOD: 'Voting',
  PROPOSAL_STATUS_PASSED: 'Passed',
  PROPOSAL_STATUS_REJECTED: 'Rejected',
  PROPOSAL_STATUS_FAILED: 'Failed'
};
function tallyValues(tally) {
  if (!tally) return null;
  const values = ['yes', 'no', 'abstain'].map((k) => tally[k + '_count'] ?? tally[k]);
  if (!values.every(uint)) return null;
  const result = { Yes: values[0], No: values[1], Abstain: values[2] };
  const veto = tally.no_with_veto_count ?? tally.no_with_veto;
  if (veto !== undefined) {
    if (!uint(veto)) return null;
    result['No with veto'] = veto;
  }
  return result;
}
export function atomoneProposal(p) {
  if (!p || !uint(p.id) || !Array.isArray(p.messages) || typeof p.status !== 'string')
    throw Error('Unexpected AtomOne proposal format.');
  const legacy = p.messages.find((m) => m.content?.title)?.content;
  const title = p.title || legacy?.title;
  if (typeof title !== 'string' || !title.trim()) throw Error('Proposal title is missing.');
  const description = legacy?.description || p.summary || '';
  return {
    id: p.id,
    title,
    status: cosmosStatuses[p.status] || 'Unknown',
    rawStatus: p.status,
    author: p.proposer || '',
    description,
    submitted: Date.parse(p.submit_time) > 0 ? p.submit_time : '',
    voteStart: Date.parse(p.voting_start_time) > 0 ? p.voting_start_time : '',
    voteEnd: Date.parse(p.voting_end_time) > 0 ? p.voting_end_time : '',
    depositEnd: Date.parse(p.deposit_end_time) > 0 ? p.deposit_end_time : '',
    tallies:
      p.status === 'PROPOSAL_STATUS_VOTING_PERIOD' ? null : tallyValues(p.final_tally_result),
    tallyLabel: 'Final vote weight · ATONE',
    unit: 'ATONE',
    decimals: 6,
    messages: p.messages,
    source: `${SCOPES.atomone.source}/${p.id}`
  };
}
export function gnoPage(text) {
  if (!text.startsWith('# GovDAO\n') || !text.includes('## Proposals'))
    throw Error('GovDAO response format changed.');
  const count = (text.match(/^### \[Prop #/gm) || []).length;
  const proposals = [
    ...text.matchAll(
      /^### \[Prop #(\d+) - (.+)\]\(\/r\/gov\/dao:(\d+)\)\nAuthor: ([^\n]+)\n\nStatus: ([A-Z_]+)\n\nTiers eligible to vote: ([^\n]*)/gm
    )
  ].map((m) => {
    if (m[1] !== m[3]) throw Error('GovDAO proposal identifiers do not match.');
    return {
      id: m[1],
      title: plain(m[2]),
      author: m[4].replace(/^\[([^\]]+)\]\([^)]*\)$/, '$1'),
      status: { ACTIVE: 'Active', ACCEPTED: 'Accepted', REJECTED: 'Rejected' }[m[5]] || 'Unknown',
      rawStatus: m[5],
      tiers: m[6],
      source: `https://gno.land/r/gov/dao:${m[1]}`
    };
  });
  if (proposals.length !== count || (!count && !text.includes('No proposals yet.')))
    throw Error('GovDAO proposals could not be read.');
  const pages = [...text.matchAll(/\]\(\?page=(\d+)\)/g)].map((m) => Number(m[1]));
  return { proposals, lastPage: Math.max(1, ...pages) };
}
export function gnoDetail(text, proposal) {
  if (!text.startsWith(`## Prop #${proposal.id} - `) || !text.includes('### Stats\n'))
    throw Error('GovDAO proposal details are unavailable.');
  const split = text.lastIndexOf('### Stats\n');
  const body = text
    .slice(0, split)
    .replace(/^## Prop #[^\n]*\nAuthor: [^\n]*\n\n/, '')
    .replace(/\n+---\s*$/, '')
    .trim();
  const stats = text.slice(split);
  const status = stats.includes('PROPOSAL HAS BEEN ACCEPTED')
    ? 'Accepted'
    : stats.includes('PROPOSAL HAS BEEN REJECTED')
      ? 'Rejected'
      : proposal.status;
  return {
    ...proposal,
    description: body,
    status,
    governanceStats: stats.split('[Detailed voting list]')[0],
    voteSource: proposal.source + '/votes'
  };
}
// qeval returns explicitly typed scalar values, never executable JavaScript.
export function gnoTuple(text) {
  return text.split('\n').map((line) => {
    const n = /^\((-?\d+) int64\)$/.exec(line);
    if (n) return n[1];
    const s = /^\(("(?:[^"\\]|\\.)*") (?:string|\.uverse\.address)\)$/.exec(line);
    if (!s) throw Error('Unexpected Gno scalar response.');
    let result = '';
    const token = s[1];
    for (let i = 1; i < token.length - 1; i++) {
      if (token[i] !== '\\') {
        result += token[i];
        continue;
      }
      const ch = token[++i];
      const simple = {
        a: '\x07',
        b: '\b',
        f: '\f',
        n: '\n',
        r: '\r',
        t: '\t',
        v: '\x0b',
        '\\': '\\',
        '"': '"'
      };
      if (Object.hasOwn(simple, ch)) {
        result += simple[ch];
        continue;
      }
      const length = { x: 2, u: 4, U: 8 }[ch];
      if (
        !length ||
        !new RegExp('^[0-9a-fA-F]{' + length + '}$').test(token.slice(i + 1, i + 1 + length))
      )
        throw Error('Invalid Gno string escape.');
      result += String.fromCodePoint(parseInt(token.slice(i + 1, i + 1 + length), 16));
      i += length;
    }
    return result;
  });
}
export function gnoswapProposal(text, id) {
  const v = gnoTuple(text);
  if (v.length !== 10 || !v.slice(4).every(uint) || !v[0])
    throw Error('Unexpected GnoSwap proposal format.');
  const status =
    {
      pending: 'Pending',
      active: 'Voting',
      voting: 'Voting',
      upcoming: 'Upcoming',
      passed: 'Passed',
      accepted: 'Accepted',
      executed: 'Executed',
      rejected: 'Rejected',
      canceled: 'Cancelled',
      cancelled: 'Cancelled',
      expired: 'Expired'
    }[v[2].toLowerCase()] || 'Unknown';
  return {
    id: String(id),
    title: v[0],
    description: v[1],
    status,
    rawStatus: v[2],
    author: v[3],
    submitted: new Date(Number(v[4]) * 1000).toISOString(),
    createdHeight: v[5],
    tallies: { Yes: v[6], No: v[7] },
    quorum: v[8],
    maxWeight: v[9],
    tallyLabel: 'Recorded vote weight · xGNS',
    unit: 'xGNS',
    decimals: 6,
    source: SCOPES.gnoswap.source
  };
}
export async function fetchGovernance(scope, { fetcher = fetch, signal, source = '0' } = {}) {
  const read = async (op, args = {}) => {
    const query = new URLSearchParams({
      scope,
      op,
      ...args,
      ...(scope === 'atomone' ? { source } : {})
    });
    const response = await fetcher(`${GOVERNANCE_READ_PATH}?${query}`, {
      credentials: 'omit',
      cache: 'no-store',
      signal
    });
    if (!response.ok) throw Error('The governance source is temporarily unavailable.');
    return response.json();
  };
  try {
    const node = readNode(scope, await read('status'));
    let proposals = [],
      complete = true;
    if (scope === 'atomone') {
      let key = '';
      const seen = new Set();
      for (let page = 0; page < 40; page++) {
        const json = await read('list', key ? { key } : {});
        if (
          !Array.isArray(json.proposals) ||
          !json.pagination ||
          !Object.hasOwn(json.pagination, 'next_key')
        )
          throw Error('The proposal archive could not be read.');
        proposals.push(...json.proposals.map(atomoneProposal));
        key = json.pagination.next_key;
        if (!key) break;
        if (typeof key !== 'string' || seen.has(key))
          throw Error('The source repeated a pagination cursor.');
        seen.add(key);
        if (page === 39) complete = false;
      }
      for (const p of proposals.filter((p) => p.status === 'Voting')) {
        try {
          p.tallies = tallyValues((await read('tally', { id: p.id })).tally);
          p.tallyLabel = 'Current vote weight · ATONE';
        } catch {
          if (signal?.aborted) throw signal.reason;
        }
      }
    } else if (scope === 'gno') {
      let lastPage = 1;
      for (let page = 1; page <= Math.min(200, lastPage); page++) {
        const result = gnoPage(rpcText(await read('list', { page: String(page) })));
        proposals.push(...result.proposals);
        lastPage = Math.max(lastPage, result.lastPage);
      }
      complete = lastPage <= 200;
    } else {
      const [counter] = gnoTuple(rpcText(await read('count')));
      if (!uint(counter) || !Number.isSafeInteger(Number(counter)))
        throw Error('Invalid proposal count.');
      const count = Number(counter),
        floor = Math.max(1, count - 199);
      complete = count <= 200;
      for (let id = count; id >= floor; id -= 4) {
        const ids = Array.from({ length: Math.min(4, id - floor + 1) }, (_, i) => String(id - i));
        proposals.push(
          ...(await Promise.all(
            ids.map(async (id) => gnoswapProposal(rpcText(await read('detail', { id })), id))
          ))
        );
      }
    }
    if (new Set(proposals.map((p) => p.id)).size !== proposals.length)
      throw Error('The proposal list changed during loading. Please refresh.');
    proposals.sort((a, b) => Number(b.id) - Number(a.id));
    return { proposals, node, complete, checkedAt: new Date().toISOString(), source };
  } catch (error) {
    if (scope === 'atomone' && source === '0' && !signal?.aborted)
      return fetchGovernance(scope, { fetcher, signal, source: '1' });
    throw error;
  }
}
export async function fetchGnoDetail(proposal, { fetcher = fetch, signal } = {}) {
  const response = await fetcher(
    `${GOVERNANCE_READ_PATH}?${new URLSearchParams({ scope: 'gno', op: 'detail', id: proposal.id })}`,
    { credentials: 'omit', cache: 'no-store', signal }
  );
  if (!response.ok) throw Error('Proposal details are unavailable.');
  return gnoDetail(rpcText(await response.json()), proposal);
}
export function formatWeight(value, decimals = 6) {
  if (!uint(value)) return 'Unavailable';
  const n = BigInt(value),
    factor = 10n ** BigInt(decimals);
  const fraction = (n % factor).toString().padStart(decimals, '0').slice(0, 2);
  return (n / factor).toLocaleString('en-US') + (Number(fraction) ? '.' + fraction : '');
}
export function votePercent(value, total) {
  if (!uint(value) || !uint(total) || BigInt(total) === 0n) return null;
  return Number((BigInt(value) * 10000n) / BigInt(total)) / 100;
}
// Deliberately small Markdown subset: escape HTML, no images, no embedded content.
export function markdown(text) {
  const inline = (value) =>
    escapeHTML(value)
      .replace(/`([^`\n]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
  const lines = String(text || '')
    .replace(/\r\n?/g, '\n')
    .split('\n');
  const cells = (line) =>
    line
      .trim()
      .replace(/^\|/, '')
      .replace(/\|$/, '')
      .split('|')
      .map((value) => inline(value.trim()));
  let code = false,
    out = '';
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('```')) {
      code = !code;
      out += code ? '<pre><code>' : '</code></pre>';
      continue;
    }
    if (code) {
      out += escapeHTML(line) + '\n';
      continue;
    }
    if (line.trim().startsWith('|') && /^\s*\|?[ :|-]+\|[ :|-]*$/.test(lines[i + 1] || '')) {
      out +=
        '<table><thead><tr>' +
        cells(line)
          .map((v) => '<th scope="col">' + v + '</th>')
          .join('') +
        '</tr></thead><tbody>';
      i++;
      while ((lines[i + 1] || '').trim().startsWith('|'))
        out +=
          '<tr>' +
          cells(lines[++i])
            .map((v) => '<td>' + v + '</td>')
            .join('') +
          '</tr>';
      out += '</tbody></table>';
      continue;
    }
    const heading = /^#{1,6} (.+)$/.exec(line);
    if (heading) {
      out += '<h3>' + inline(heading[1]) + '</h3>';
      continue;
    }
    if (/^\s*[-*] /.test(line)) {
      out += '<p class="markdown-bullet">• ' + inline(line.replace(/^\s*[-*] /, '')) + '</p>';
      continue;
    }
    if (line.trim()) out += '<p>' + inline(line) + '</p>';
  }
  return out + (code ? '</code></pre>' : '');
}
