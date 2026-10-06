import test from 'node:test';
import assert from 'node:assert/strict';
import { PersonalMailboxClient } from '../relay-uni7-client.mjs';
import { personalMainnetProfile, personalMainnetPlan, PERSONAL_MAINNET_OWNER as owner,
  PERSONAL_MAINNET_POLICY as policy, PERSONAL_MAINNET_WASM as hash } from '../relay-personal-network.mjs';
const deployment = { chainId: 'juno-1', contract: 'juno1' + 'q'.repeat(58), creator: owner, admin: owner,
  codeId: 123, codeHash: hash, label: 'NETA RELAY personal v0.4 · Juno mainnet' };
test('mainnet has no default deployment and only produces non-signable preparation', () => {
  assert.throws(() => personalMainnetProfile(), /not verified/);
  assert.equal(personalMainnetPlan().ready_to_sign, false);
  for (const change of [{ admin: '' }, { creator: 'other' }, { chainId: 'uni-7' }, { codeHash: 'f'.repeat(64) }])
    assert.throws(() => personalMainnetProfile({ ...deployment, ...change }), /not verified/);
});
test('mainnet verifies actual policy, administrator and code before queries can proceed', async () => {
  for (const changes of [{}, { admin: 'different' }, { policy: { ...policy, nns_registry: 'different' } },
    { policy: { ...policy, dao_enabled: true } }, { hash: 'f'.repeat(64) }, { chain: 'uni-7' }]) {
    let signs = 0;
    const client = new PersonalMailboxClient({ keplr: {}, assertDevicePrepared: async () => true,
      bundle: { connect: async () => {}, execute: async () => signs++ }, fetcher: async url => {
        const data = url.endsWith('/node_info') ? { default_node_info: { network: changes.chain || 'juno-1' } } :
          url.includes('/smart/') ? { data: changes.policy || policy } : url.endsWith('/code/123') ?
          { code_info: { data_hash: changes.hash || hash } } :
          { contract_info: { creator: owner, admin: changes.admin || owner, code_id: '123', label: deployment.label } };
        return { ok: true, json: async () => data };
      } }, personalMainnetProfile(deployment));
    if (Object.keys(changes).length) await assert.rejects(client.verify(), /MISMATCH/);
    else assert.equal(await client.verify(), personalMainnetProfile(deployment).rests[0]);
    assert.equal(signs, 0);
  }
});
