import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { SCOPES, demoRoute, demoGovernanceTarget } from '../demo/governance-query.mjs';
import {
  rpcText,
  readNode,
  atomoneProposal,
  gnoPage,
  gnoDetail,
  gnoTuple,
  gnoswapProposal,
  fetchGovernance,
  isOpen,
  isClosed,
  formatWeight,
  votePercent,
  markdown
} from '../demo/governance-data.mjs';
import { demoGovernanceProxy } from '../deploy/cosmoot/demo-governance-proxy.mjs';
const fixture = async (name) =>
  JSON.parse(
    await readFile(new URL(`./fixtures/demo-governance/${name}.json`, import.meta.url), 'utf8')
  );
const atomone = await fixture('atomone');
const gno = await fixture('gno-list');
const detail = await fixture('gno-detail');
const swap = await fixture('swap-tuple');
const json = (value) =>
  new Response(JSON.stringify(value), { headers: { 'Content-Type': 'application/json' } });
const status = (scope) =>
  scope === 'atomone'
    ? {
        block: { header: { chain_id: 'atomone-1', height: '123', time: new Date().toISOString() } }
      }
    : {
        result: {
          node_info: { network: 'gnoland-1' },
          sync_info: {
            latest_block_height: '456',
            latest_block_time: new Date().toISOString(),
            catching_up: false
          }
        }
      };
const query = (data) => new URLSearchParams(data);
const envelope = (text) => ({
  result: {
    response: {
      ResponseBase: { Error: null, Data: Buffer.from(text).toString('base64') },
      Height: '0'
    }
  }
});

test('directory scopes and legacy prototype routes are separate', () => {
  assert.equal(demoRoute('').mode, 'directory');
  assert.equal(demoRoute('#/').mode, 'directory');
  for (const scope of Object.keys(SCOPES))
    assert.deepEqual(demoRoute(`#/${scope}/proposals/2`), {
      mode: 'live',
      scope,
      page: 'proposals',
      id: '2'
    });
  assert.equal(demoRoute('#/proposals/12').mode, 'prototype');
  assert.equal(demoRoute('#/people/wallet-demo-you').mode, 'prototype');
  assert.equal(demoRoute('#/gnoswap/broadcast').mode, 'directory');
});
test('read vocabulary rejects arbitrary hosts, realms, code, methods and duplicate keys', async () => {
  for (const params of [
    { scope: 'constructor', op: 'status' },
    { scope: 'gno', op: 'broadcast' },
    { scope: 'gno', op: 'detail', id: '1);panic(1)' },
    { scope: 'gno', op: 'list', page: '0' },
    { scope: 'gno', op: 'list', page: '201' },
    { scope: 'atomone', op: 'list', key: 'https://evil.test' },
    { scope: 'gnoswap', op: 'detail', id: '0' },
    { scope: 'gnoswap', op: 'count', id: '1' },
    { scope: 'gno', op: 'status', source: '1' },
    { scope: 'atomone', op: 'status', url: 'https://evil.test' },
    { scope: 'atomone', op: 'list', source: '2' }
  ])
    assert.throws(() => demoGovernanceTarget(query(params)));
  assert.throws(() =>
    demoGovernanceTarget(new URLSearchParams('scope=gno&scope=atomone&op=status'))
  );
  let calls = 0;
  const fetcher = async () => {
    calls++;
    return json({});
  };
  for (const method of ['POST', 'PUT', 'DELETE'])
    assert.equal(
      (
        await demoGovernanceProxy(
          new Request('https://cosmoot.com/data/demo-governance?scope=gno&op=status', { method }),
          fetcher
        )
      ).status,
      405
    );
  assert.equal(
    await demoGovernanceProxy(new Request('https://cosmoot.com/data/other'), fetcher),
    null
  );
  assert.equal(calls, 0);
});
test('proxy forwards only bounded public reads and removes credentials and redirects', async () => {
  const req = new Request('https://cosmoot.com/data/demo-governance?scope=gnoswap&op=detail&id=2', {
    headers: { Cookie: 'secret=1', Authorization: 'Bearer secret' }
  });
  const response = await demoGovernanceProxy(req, async (url, opts) => {
    assert.equal(new URL(url).origin, 'https://rpc.gno.land');
    assert.equal(opts.method, 'GET');
    assert.equal(opts.redirect, 'manual');
    assert.deepEqual(opts.headers, { Accept: 'application/json' });
    return new Response(JSON.stringify(swap), {
      headers: { 'Set-Cookie': 'private=1', 'X-Private': 'private' }
    });
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Set-Cookie'), null);
  assert.equal(response.headers.get('X-Private'), null);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.deepEqual(await response.json(), swap);
  assert.equal(
    (
      await demoGovernanceProxy(
        req,
        async () => new Response(null, { status: 302, headers: { Location: 'https://evil.test' } })
      )
    ).status,
    502
  );
  assert.equal((await demoGovernanceProxy(req, async () => new Response('not JSON'))).status, 502);
});
test('proxy bounds streamed payloads even without Content-Length', async () => {
  const req = new Request('https://cosmoot.com/data/demo-governance?scope=gno&op=status');
  const result = await demoGovernanceProxy(
    req,
    async () => new Response(new Uint8Array(4 * 1024 * 1024 + 1))
  );
  assert.equal(result.status, 502);
});
test('chain identity, stale sources and RPC errors fail instead of becoming empty feeds', () => {
  assert.equal(readNode('gno', status('gno')).height, '456');
  assert.throws(() => readNode('atomone', status('gno')));
  const old = status('gno');
  old.result.sync_info.latest_block_time = '2020-01-01T00:00:00Z';
  assert.throws(() => readNode('gno', old));
  const wrong = status('gno');
  wrong.result.node_info.network = 'onyx-1';
  assert.throws(() => readNode('gno', wrong));
  assert.throws(() =>
    rpcText({ result: { response: { ResponseBase: { Error: { message: 'failure' }, Data: '' } } } })
  );
});
test('observed AtomOne responses preserve native status and authoritative content', () => {
  const p = atomoneProposal(atomone.proposals[0]);
  assert.equal(p.id, '22');
  assert.equal(p.status, 'Rejected');
  assert.match(p.description, /Dormant ATONE/);
  assert.deepEqual(p.tallies, {
    Yes: '1586260685893',
    No: '5510227044399',
    Abstain: '661365648579'
  });
  assert.equal(p.unit, 'ATONE');
  assert.equal(p.source, 'https://explorer.allinbits.com/atomone/gov/22');
  const voting = atomoneProposal({
    ...atomone.proposals[0],
    status: 'PROPOSAL_STATUS_VOTING_PERIOD'
  });
  assert.equal(voting.tallies, null);
  assert.equal(isOpen(voting), true);
  const unknown = atomoneProposal({ ...atomone.proposals[0], status: 'A_FUTURE_STATUS' });
  assert.equal(isOpen(unknown), false);
  assert.equal(isClosed(unknown), false);
});
test('GovDAO reads paginated history including ID zero without invented token tallies', () => {
  const parsed = gnoPage(rpcText(gno));
  assert.equal(parsed.lastPage, 5);
  assert.equal(parsed.proposals.length, 5);
  assert.equal(parsed.proposals[0].id, '20');
  assert.equal(parsed.proposals[0].author, '@aeddi');
  const p = gnoDetail(rpcText(detail), parsed.proposals[0]);
  assert.equal(p.status, 'Accepted');
  assert.match(p.description, /Validator Updates/);
  assert.doesNotMatch(p.description, /Vote YES/);
  assert.match(p.governanceStats, /83\.333/);
  assert.equal(p.tallies, undefined);
  const zero = gnoPage(
    '# GovDAO\n## Proposals\n### [Prop #0 - First](/r/gov/dao:0)\nAuthor: @a\n\nStatus: ACTIVE\n\nTiers eligible to vote: T1\n'
  );
  assert.equal(zero.proposals[0].id, '0');
  assert.throws(() => gnoPage('# A different format'));
  assert.throws(() => gnoPage(rpcText(gno).replace('/r/gov/dao:20', '/r/gov/dao:19')));
});
test('GnoSwap tuple retains exact integer votes and executed versus passed status', () => {
  const p = gnoswapProposal(rpcText(swap), '2');
  assert.equal(p.status, 'Executed');
  assert.equal(p.tallies.Yes, '11951783000000');
  assert.equal(p.unit, 'xGNS');
  assert.match(p.description, /40\/20\/20\/20/);
  assert.deepEqual(gnoTuple('("literal \\\\x41 and \\x41" string)\n(9007199254740993 int64)'), [
    'literal \\x41 and A',
    '9007199254740993'
  ]);
  assert.throws(() => gnoTuple('(someCode() string)'));
  assert.equal(formatWeight('9007199254740993123456'), '9,007,199,254,740,993.12');
  assert.equal(votePercent('1', '0'), null);
  assert.equal(votePercent('3', '4'), 75);
});
test('historical AtomOne pagination includes new proposals on the next refresh', async () => {
  let newest = '22',
    requests = [];
  const fetcher = async (url) => {
    const p = new URL(url, 'https://cosmoot.com').searchParams;
    requests.push(Object.fromEntries(p));
    if (p.get('op') === 'status') return json(status('atomone'));
    return json({
      proposals: [
        { ...atomone.proposals[p.has('key') ? 1 : 0], ...(!p.has('key') ? { id: newest } : {}) }
      ],
      pagination: { next_key: p.has('key') ? null : 'YWJj' }
    });
  };
  const first = await fetchGovernance('atomone', { fetcher });
  assert.deepEqual(
    first.proposals.map((p) => p.id),
    ['22', '21']
  );
  assert.equal(first.complete, true);
  newest = '23';
  const second = await fetchGovernance('atomone', { fetcher });
  assert.equal(second.proposals[0].id, '23');
  assert.ok(requests.some((p) => p.key === 'YWJj'));
});
test('incomplete or looping pagination is never accepted as complete history', async () => {
  const fetcher = async (url) =>
    new URL(url, 'https://cosmoot.com').searchParams.get('op') === 'status'
      ? json(status('atomone'))
      : json({ ...atomone, pagination: { next_key: 'YWJj' } });
  await assert.rejects(fetchGovernance('atomone', { fetcher }), /repeated/);
  await assert.rejects(
    fetchGovernance('atomone', {
      fetcher: async (url) =>
        new URL(url, 'https://cosmoot.com').searchParams.get('op') === 'status'
          ? json(status('atomone'))
          : json({ proposals: [] })
    }),
    /archive/
  );
});
test('AtomOne fallback restarts the whole read against the second source', async () => {
  const sources = [];
  const feed = await fetchGovernance('atomone', {
    fetcher: async (url) => {
      const p = new URL(url, 'https://cosmoot.com').searchParams;
      sources.push(p.get('source'));
      if (p.get('source') === '0') return new Response('', { status: 503 });
      return json(p.get('op') === 'status' ? status('atomone') : atomone);
    }
  });
  assert.equal(feed.source, '1');
  assert.deepEqual(sources, ['0', '1', '1']);
});
test('empty GnoSwap governance and unavailable governance remain distinguishable', async () => {
  const feed = await fetchGovernance('gnoswap', {
    fetcher: async (url) =>
      json(
        new URL(url, 'https://cosmoot.com').searchParams.get('op') === 'status'
          ? status('gnoswap')
          : envelope('(0 int64)')
      )
  });
  assert.deepEqual(feed.proposals, []);
  assert.equal(feed.complete, true);
  await assert.rejects(
    fetchGovernance('gnoswap', { fetcher: async () => new Response('', { status: 503 }) }),
    /unavailable/
  );
});
test('chain-authored HTML and active URLs cannot execute in rendered proposals', () => {
  const result = markdown(
    '# <script>alert(1)</script>\n\n<img src=x onerror=alert(1)>\n[join](javascript:alert(1))\n**safe**'
  );
  assert.doesNotMatch(result, /<script|<img|href=|onerror="/);
  assert.match(result, /&lt;script&gt;/);
  assert.match(result, /<strong>safe<\/strong>/);
});

test('CRLF proposal headings and source tables render as readable markup', () => {
  assert.match(markdown('## Summary\r\ntext'), /<h3>Summary<\/h3>/);
  const html = markdown('| Target | Share |\n|---|---|\n| Pool | **40%** |');
  assert.match(html, /<table>/);
  assert.match(html, /<td><strong>40%<\/strong><\/td>/);
});
