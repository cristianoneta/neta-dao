// Exact public, read-only query vocabulary. No caller-supplied host, realm or expression.
export const GOVERNANCE_READ_PATH = '/data/demo-governance';
export const SCOPES = Object.freeze({
  atomone: {
    name: 'AtomOne',
    kind: 'Chain governance',
    chain: 'atomone-1',
    asset: 'ATONE',
    logo: 'atone',
    description: 'Network upgrades, the constitution and community decisions.',
    voting: 'Staked ATONE',
    source: 'https://explorer.allinbits.com/atomone/gov'
  },
  gno: {
    name: 'Gno.land',
    kind: 'Chain governance',
    chain: 'gnoland-1',
    asset: 'GNOT',
    logo: 'gnot',
    description: 'Follow the GovDAO and the decisions shaping Gno.land.',
    voting: 'GovDAO member tiers',
    source: 'https://gno.land/r/gov/dao'
  },
  gnoswap: {
    name: 'GnoSwap',
    kind: 'Protocol governance',
    chain: 'gnoland-1',
    asset: 'GNS',
    logo: 'gns',
    description: 'Pool incentives, protocol parameters and governance decisions.',
    voting: 'Delegated xGNS',
    source: 'https://gnoswap.io/governance'
  }
});
export function demoRoute(hash = '') {
  const parts = hash.replace(/^#\/?/, '').split('/');
  if (
    Object.hasOwn(SCOPES, parts[0]) &&
    (!parts[1] || parts[1] === 'proposals') &&
    parts.length <= 3 &&
    (!parts[2] || /^\d{1,10}$/.test(parts[2]))
  )
    return { mode: 'live', scope: parts[0], page: 'proposals', id: parts[2] || '' };
  // Keep existing concept deep links and local drafts intact.
  if (['proposals', 'people', 'treasury'].includes(parts[0]))
    return { mode: 'prototype', page: parts[0], id: parts[1] || '' };
  return { mode: 'directory', page: 'directory', id: '' };
}
const integer = (value, min, max) =>
  /^\d+$/.test(value) &&
  Number.isSafeInteger(Number(value)) &&
  Number(value) >= min &&
  Number(value) <= max;
const rpc = (path, data) =>
  `https://rpc.gno.land/abci_query?${new URLSearchParams({ path: JSON.stringify(path), data: '0x' + Array.from(new TextEncoder().encode(data), (b) => b.toString(16).padStart(2, '0')).join('') })}`;
export function demoGovernanceTarget(params) {
  if (
    [...params.keys()].some(
      (k) =>
        !['scope', 'op', 'page', 'key', 'id', 'source'].includes(k) || params.getAll(k).length !== 1
    )
  )
    throw Error('Unsupported query.');
  const scope = params.get('scope'),
    op = params.get('op'),
    id = params.get('id');
  if (!Object.hasOwn(SCOPES, scope)) throw Error('Unsupported scope.');
  const allowed = ['scope', 'op'];
  if (scope === 'atomone') allowed.push('source');
  if (op === 'list') allowed.push(scope === 'atomone' ? 'key' : 'page');
  if (op === 'detail' || op === 'tally') allowed.push('id');
  if ([...params.keys()].some((k) => !allowed.includes(k)))
    throw Error('Unexpected query parameter.');
  if (scope === 'atomone') {
    const source = params.get('source') || '0';
    if (!['0', '1'].includes(source)) throw Error('Unsupported source.');
    const base = ['https://atomone-api.allinbits.com', 'https://atomone-rest.publicnode.com'][
      Number(source)
    ];
    if (op === 'status') return base + '/cosmos/base/tendermint/v1beta1/blocks/latest';
    if (op === 'list') {
      const key = params.get('key') || '';
      if (key.length > 1024 || !/^[A-Za-z0-9+/=]*$/.test(key)) throw Error('Invalid cursor.');
      const query = new URLSearchParams({
        'pagination.limit': '100',
        'pagination.reverse': 'true'
      });
      if (key) query.set('pagination.key', key);
      return base + '/atomone/gov/v1/proposals?' + query;
    }
    if (['detail', 'tally'].includes(op) && integer(id || '', 1, 1e10))
      return base + '/atomone/gov/v1/proposals/' + id + (op === 'tally' ? '/tally' : '');
  } else {
    if (op === 'status') return 'https://rpc.gno.land/status';
    if (scope === 'gno') {
      if (op === 'list') {
        const page = params.get('page') || '1';
        if (!integer(page, 1, 200)) throw Error('Invalid page.');
        return rpc('vm/qrender', `gno.land/r/gov/dao:?page=${Number(page)}`);
      }
      if (op === 'detail' && integer(id || '', 0, 1e10))
        return rpc('vm/qrender', `gno.land/r/gov/dao:${id}`);
    } else {
      if (op === 'count')
        return rpc('vm/qeval', 'gno.land/r/gnoswap/gov/governance.GetCurrentProposalID()');
      if (op === 'detail' && integer(id || '', 1, 1e10))
        return rpc(
          'vm/qeval',
          `gno.land/r/gnoswap/gov/governance.func() (string,string,string,address,int64,int64,int64,int64,int64,int64) { p:=GetProposals().Get("${id}").(*Proposal); s,e:=GetProposalStatusByProposalId(${id}); if e!=nil { panic(e) }; return p.Title(),p.Description(),s,p.Proposer(),p.CreatedAt(),p.CreatedHeight(),p.VotingYesWeight(),p.VotingNoWeight(),p.VotingQuorumAmount(),p.VotingMaxWeight() }()`
        );
    }
  }
  throw Error('Unsupported governance read.');
}
