import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatAmount,
  formatChange,
  stakeShare,
  selectRows,
  rowStatus,
  allocationReason
} from '../juno-delegation-view.mjs';
import { defaultPolicy, simulate, amount } from '../juno-delegation-core.mjs';
import { fixture, observed } from './fixtures/delegation-planner.mjs';

test('rounded amounts distinguish micro-unit changes and preserve exact large values', () => {
  assert.equal(formatAmount('14999522938972'), '14,999,522.94');
  assert.equal(formatAmount('999999999999999999999999', true), '999,999,999,999,999,999.999999');
  assert.equal(formatAmount('1'), '<0.01');
  assert.equal(formatAmount('0'), '0.00');
  assert.equal(formatChange('-1'), '−<0.01');
  assert.equal(formatChange('5000'), '+0.01');
  assert.equal(formatChange('-5000'), '−0.01');
  assert.equal(formatChange('1', true), '+0.000001');
  assert.equal(stakeShare('599999999', '10000000000'), '6.00%');
  assert.equal(stakeShare('0', '0'), 'Unavailable');
});

test('filters explain review cases and retain affected inactive positions without altering results', () => {
  const s = fixture(),
    e = observed(s),
    p = defaultPolicy();
  s.validators[0].active = false;
  s.activeCount--;
  e.records.delete(s.validators[1].consensusAddress);
  p.exclusions = [
    { chainId: 'juno-1', validator: s.validators[2].address, reason: 'Operator review' }
  ];
  const result = simulate(p, s, amount('2500'), e),
    original = JSON.stringify(result);
  assert.deepEqual(
    selectRows(result, { filter: 'standby' }).map((v) => v.address),
    [s.validators[0].address]
  );
  assert.deepEqual(
    selectRows(result, { filter: 'review' }).map((v) => v.address),
    [s.validators[1].address]
  );
  assert.equal(selectRows(result, { filter: 'excluded' }).length, 2);
  assert.equal(selectRows(result, { filter: 'receiving' }).length, 23);
  assert.equal(selectRows(result, { query: s.validators[2].address.toUpperCase() }).length, 1);
  assert.equal(selectRows(result, { query: 'does not exist' }).length, 0);
  assert.equal(rowStatus(result.rows[1]), 'Evidence review required');
  assert.equal(rowStatus(result.rows[2]), 'Manually excluded');
  assert.match(allocationReason(result.rows[1]), /No evidence within 5h/);
  assert.equal(JSON.stringify(result), original);
});

test('sort uses exact integer amounts and cap explanation distinguishes zero capacity', () => {
  const result = {
    policy: { exclusions: [] },
    rows: ['9007199254740993', '9007199254740992'].map((n, i) => ({
      address: String(i),
      name: i ? 'A' : 'Z',
      active: true,
      reasons: [],
      eligible: true,
      currentRaw: '0',
      targetRaw: n,
      deltaRaw: '-' + n,
      tokensRaw: n,
      projectedRaw: n,
      projectedActive: true,
      capacityRaw: '0',
      capReached: true,
      upgrade: { status: 'observed' }
    }))
  };
  for (const sort of ['change', 'target', 'power', 'total', 'projected'])
    assert.equal(selectRows(result, { sort })[0].name, 'Z');
  assert.equal(selectRows(result, { sort: 'name' })[0].name, 'A');
  assert.equal(rowStatus(result.rows[0]), 'No capacity under the limit');
  assert.match(allocationReason(result.rows[0]), /cannot reduce other delegators/);
  for (const sort of ['total-asc', 'projected-asc'])
    assert.equal(selectRows(result, { sort })[0].name, 'A');
  const outside = {
    ...result.rows[0],
    address: 'outside',
    name: 'Outside',
    projectedActive: false,
    projectedRaw: '99999999999999999999'
  };
  result.rows.push(outside);
  assert.equal(selectRows(result, { sort: 'total' })[0].name, 'Outside');
  for (const sort of ['projected', 'projected-asc'])
    assert.equal(selectRows(result, { sort }).at(-1).name, 'Outside');
});
