import test from 'node:test';
import assert from 'node:assert/strict';
import { archivedParticipation, loadArchivedParticipation } from '../native-vote-archive.mjs';
import { archivedPower } from '../scripts/archive-juno-voting-power.mjs';
import { snapshotProxy } from '../service/snapshot-proxy.mjs';

const voter = 'juno1z3xcalwan92yqxu9d406tlft9yy94jy8s5et57';
const through = { height: 42, hash: 'ab'.repeat(32), time: '2026-11-05T17:30:00Z' };
const record = {
  schema: 1,
  chainId: 'juno-1',
  proposalId: '387',
  outcome: 'proposal_passed',
  start: { ...through, height: 40 },
  through,
  votes: [
    {
      voter,
      options: [
        { option: 'VOTE_OPTION_YES', weight: '0.2' },
        { option: 'VOTE_OPTION_NO', weight: '0.8' }
      ]
    }
  ]
};
const proposal = {
  id: '387',
  status: 'PROPOSAL_STATUS_PASSED',
  final_tally_result: { yes_count: '0', no_count: '0', abstain_count: '0', no_with_veto_count: '0' }
};

test('opening a finished proposal reads retained ballots, with weighted decisions and completeness', async () => {
  const result = await loadArchivedParticipation(proposal, async (url) => {
    assert.equal(url, '/data/governance/juno-votes/387.json');
    return Response.json(record);
  });
  assert.equal(result.complete, true);
  assert.equal(result.final, true);
  assert.deepEqual(result.direct[0], {
    address: voter,
    ballot: [
      { key: 'yes', weight: '200000000000000000' },
      { key: 'no', weight: '800000000000000000' }
    ]
  });
  assert.equal(
    archivedParticipation({ ...record, start: null, outcome: null }, proposal).complete,
    false
  );
  assert.throws(
    () => archivedParticipation({ ...record, votes: [...record.votes, ...record.votes] }, proposal),
    /Duplicate/
  );
  assert.throws(
    () => archivedParticipation({ ...record, proposalId: '388' }, proposal),
    /mismatch/
  );
  assert.equal(
    await loadArchivedParticipation(proposal, async () => new Response(null, { status: 404 })),
    null
  );
  await assert.rejects(
    loadArchivedParticipation(proposal, async () => new Response(null, { status: 503 })),
    /unavailable/
  );
});

test('final staking power uses the closing block and retained ballots even after the SDK removes its vote set', async () => {
  const urls = [];
  const fetcher = async (url, options) => {
    assert.equal(options.headers['x-cosmos-block-height'], '42');
    urls.push(url);
    let body;
    if (url.endsWith('/blocks/42'))
      body = {
        block: { header: { chain_id: 'juno-1', height: '42', time: through.time } },
        block_id: { hash: Buffer.from(through.hash, 'hex').toString('base64') }
      };
    else if (url.endsWith('/387')) body = { proposal };
    else if (url.includes('/validators?'))
      body = { validators: [], pagination: { next_key: null } };
    else if (url.includes('/delegations/'))
      body = { delegation_responses: [], pagination: { next_key: null } };
    else if (url.endsWith('/tallying'))
      body = { params: { quorum: '0.33', threshold: '0.5', veto_threshold: '0.334' } };
    else if (url.endsWith('/pool')) body = { pool: { bonded_tokens: '100' } };
    else throw Error(url);
    return Response.json(body, { headers: { 'x-cosmos-block-height': '42' } });
  };
  const power = await archivedPower(record, 'https://test.invalid', fetcher);
  assert.equal(power.direct.length, 1);
  assert.equal(power.direct[0].weight, '0');
  assert(!urls.some((u) => u.includes('/votes') || u.includes('latest')));
  assert.equal(archivedParticipation({ ...record, power }, proposal).metrics.total, '0');
  assert.equal(
    archivedParticipation({ ...record, power: { ...power, blockHash: 'ff'.repeat(32) } }, proposal)
      .metrics,
    undefined
  );
  await assert.rejects(
    archivedPower(
      { ...record, through: { ...through, hash: 'dd'.repeat(32) } },
      'https://test.invalid',
      fetcher
    ),
    /Different block/
  );
});
test('archive route accepts only numeric Juno proposal files and distinguishes missing from unavailable', async () => {
  let code = 404;
  const hits = [];
  const handler = snapshotProxy([], async (url) => {
    hits.push(url);
    return new Response(null, { status: code });
  });
  function request(p) {
    return handler({
      request: new Request('https://cosmoot.com' + p),
      next: () => new Response(null, { status: 418 })
    });
  }
  assert.equal((await request('/data/governance/juno-votes/387.json?secret=hidden')).status, 404);
  code = 503;
  assert.equal((await request('/data/governance/juno-votes/387.json')).status, 503);
  assert.equal((await request('/data/governance/juno-votes/private.json')).status, 418);
  assert.deepEqual(hits, [
    'https://data.cosmoot.com/data/governance/juno-votes/387.json',
    'https://data.cosmoot.com/data/governance/juno-votes/387.json'
  ]);
});
