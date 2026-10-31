import { withGovernance } from './delegation-planner.mjs';
import { createHash } from 'node:crypto';
import {
  PROGRAMME,
  extendedCapPolicy,
  defaultPolicy,
  suggestedBudget
} from '../../juno-delegation-core.mjs';

// Synthetic identities and amounts. Unlike the small arithmetic fixtures, these
// do not compress into runs of repeated address characters or identical balances.
const hex = (label) =>
  createHash('sha256')
    .update('review-size-fixture:' + label)
    .digest('hex');
const alphabet = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
export function reviewSizeInput({ count = 80, allHeld = false, points = false } = {}) {
  const validators = Array.from({ length: count }, (_, i) => {
    const suffix = Array.from(
      { length: i === 0 || i === 25 ? 58 : 38 },
      (_, j) =>
        alphabet[
          parseInt(
            hex('operator:' + i + ':' + Math.floor(j / 16)).slice((j % 16) * 2, (j % 16) * 2 + 2),
            16
          ) % 32
        ]
    ).join('');
    const active = i < 25,
      held = allHeld || i < 18 || (i >= 25 && i < 44),
      raw = BigInt(parseInt(hex('amount:' + i).slice(0, 9), 16)) + 10000000000n;
    return {
      address: 'junovaloper1' + suffix,
      consensusAddress: hex('consensus:' + i)
        .slice(0, 40)
        .toUpperCase(),
      name: 'Example ' + hex('name:' + i).slice(0, 14) + (i % 7 === 0 ? ' 🌱' : ''),
      tokensRaw: (
        raw + (active ? 900000000000n : i === 44 || i === 45 ? 2000000000000n : 0n)
      ).toString(),
      currentRaw: held ? raw.toString() : '0',
      active,
      jailed: !active && i !== 44 && i !== 45,
      commissionBps: i % 3 === 0 ? 1000 : 500
    };
  });
  const s = {
    schema: 1,
    chainId: 'juno-1',
    programme: PROGRAMME,
    height: 42869683,
    blockTime: '2026-10-19T18:29:02.531219013Z',
    collectedAt: '2026-10-19T18:29:57.398935+00:00',
    source: 'https://snapshot.example.org',
    activeCount: 25,
    liquidRaw: '3343320543692',
    redelegations: [],
    validators
  };
  const start = { height: 42701361, time: '2026-10-14T19:17:50.221235511Z' },
    addresses = validators
      .filter((v) => v.active)
      .map((v) => v.consensusAddress)
      .sort();
  s.activeSetHistory = {
    schema: 2,
    chainId: 'juno-1',
    source: 'https://history.example.org',
    collectionStart: start,
    spans: [
      {
        firstHeight: start.height,
        lastHeight: s.height,
        startTime: start.time,
        endTime: s.blockTime,
        addresses
      }
    ],
    participation: {
      schema: 1,
      firstHeight: start.height,
      lastHeight: s.height,
      startTime: start.time,
      endTime: s.blockTime,
      validators: addresses.map((address, i) => {
        const expected = s.height - start.height + 1,
          absent = i < 3 ? 4800 + i * 1000 : i * 9,
          nil = i * 7;
        return { address, expected, signed: expected - absent - nil, absent, nil };
      })
    }
  };
  return {
    rule: points ? defaultPolicy() : extendedCapPolicy(),
    snapshot: withGovernance(s),
    evidence: {
      window: { start: 1791356191235, end: 1791374191235, seconds: 18000, coverageComplete: true },
      records: new Map(
        validators.slice(0, 46).map((v, i) => [
          v.consensusAddress,
          {
            status: 'observed',
            timestamp: `2026-10-07T07:${String(i).padStart(2, '0')}:12.${hex('time:' + i)
              .replace(/[a-f]/g, '7')
              .slice(0, 9)}Z`,
            evidence: i % 2 === 0 ? 'commit' : 'consensus-precommit'
          }
        ])
      )
    },
    activeHistory: s.activeSetHistory,
    budgetRaw: suggestedBudget(s).toString(),
    createdAt: '2026-10-19T19:05:51.000Z'
  };
}
