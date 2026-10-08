import test from 'node:test';
import assert from 'node:assert/strict';
import { runDrill } from '../drill/run.mjs';

test('authenticated encrypted backup survives process restart and isolated exported restore', { timeout: 30000 }, async () => {
  const receipt = await runDrill();
  assert.equal(receipt.ok, true);
  assert.equal(receipt.unresolvedJournalsPreserved, true);
  assert.equal(receipt.oldTokensRejected, true);
  assert.equal(receipt.readOnlyRestore, true);
});
