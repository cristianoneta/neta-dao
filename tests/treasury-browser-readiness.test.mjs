import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import { waitForTreasury } from '../spikes/relay-corecrypto/treasury-readiness.mjs';

function fixture() {
  const view = { hidden: false },
    refresh = { disabled: false },
    status = { textContent: 'LIVE · NETA DAO · BLOCK 1' },
    accounting = { dao: { id: 'neta' }, loading: false },
    body = { dataset: { workspaceView: 'treasury' } };
  const document = {
    body,
    querySelector: (selector) =>
      ({
        '#treasury-view': view,
        '#treasury-refresh': refresh,
        '#treasury-live-status': status
      })[selector]
  };
  const page = {
    // Playwright serializes this callback into the browser. Exercise that actual
    // callback without giving it any closure bindings from the helper module.
    waitForFunction: (predicate, data) =>
      runInNewContext(`(${predicate})(data)`, {
        data,
        document,
        window: { NetaTreasuryAccounting: accounting }
      })
  };
  return { page, view, refresh, status, accounting, body };
}

test('Treasury browser readiness rejects the matching DAO name in REFRESHING status', () => {
  const f = fixture();
  f.status.textContent = 'REFRESHING NETA DAO SNAPSHOT';
  assert.equal(waitForTreasury(f.page, 'neta'), false);
  f.status.textContent = 'LIVE · NETA DAO · BLOCK 1';
  f.refresh.disabled = true;
  assert.equal(waitForTreasury(f.page, 'neta'), false);
  f.refresh.disabled = false;
  f.accounting.loading = true;
  assert.equal(waitForTreasury(f.page, 'neta'), false);
  f.accounting.loading = false;
  assert.equal(waitForTreasury(f.page, 'neta'), true);
});

test('Treasury browser readiness rejects hidden, old DAO and wrong consolidation renders', () => {
  const f = fixture();
  f.body.dataset.workspaceView = 'home';
  assert.equal(waitForTreasury(f.page, 'neta'), false);
  f.body.dataset.workspaceView = 'treasury';
  f.view.hidden = true;
  assert.equal(waitForTreasury(f.page, 'neta'), false);
  f.view.hidden = false;
  assert.equal(waitForTreasury(f.page, 'juno'), false);
  assert.equal(waitForTreasury(f.page, 'neta', true), false);
  f.accounting.consolidated = true;
  f.status.textContent = 'PARTIAL · 2/2 UNITS AVAILABLE';
  assert.equal(waitForTreasury(f.page, 'neta'), false);
  assert.equal(waitForTreasury(f.page, 'neta', true), true);
});

test('a completed error remains inspectable by the existing failure assertions', () => {
  const f = fixture();
  f.status.textContent = 'LIVE DATA UNAVAILABLE';
  f.accounting.error = 'Accounting refresh unavailable';
  assert.equal(waitForTreasury(f.page, 'neta'), true);
});
