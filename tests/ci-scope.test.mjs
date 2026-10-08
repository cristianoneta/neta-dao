import test from 'node:test';
import assert from 'node:assert/strict';
import { needsSourceChecks } from '../scripts/ci-scope.mjs';

test('documentation-only changes do not launch application builds', () => {
  assert.equal(needsSourceChecks(['HANDOFF.md', 'docs/CURRENT_STATE.md']), false);
});
test('deployment manifests, data and executable configuration retain full checks', () => {
  for (const path of ['docs/deployments/nns-mainnet.json', 'data/dao-directory.json',
    '.github/workflows/repository-checks.yml', 'faucet/service/server.mjs'])
    assert.equal(needsSourceChecks(['HANDOFF.md', path]), true);
});
