import test from 'node:test';
import assert from 'node:assert/strict';
import { setImmediate } from 'node:timers/promises';
import { createGovernanceWorkspace } from '../demo/governance-ui.mjs';

const json = (data) => new Response(JSON.stringify(data));
const realm = (text) =>
  json({ result: { response: { ResponseBase: { Data: Buffer.from(text).toString('base64') } } } });
async function until(predicate) {
  for (let i = 0; i < 30; i++) {
    if (predicate()) return;
    await setImmediate();
  }
  assert.fail('The expected UI update did not occur.');
}

for (const obsoleteResult of ['success', 'failure']) {
  test(`Gno refresh discards an obsolete detail ${obsoleteResult} and loads current details`, async () => {
    const saved = Object.fromEntries(
      ['document', 'HTMLInputElement', 'HTMLSelectElement', 'setInterval', 'fetch'].map((key) => [
        key,
        Object.getOwnPropertyDescriptor(globalThis, key)
      ])
    );
    const main = { innerHTML: '' };
    const listeners = new Map();
    const requests = [];
    let version = 0;
    const title = () => (version ? 'Current title' : 'Old title');
    Object.assign(globalThis, {
      document: {
        activeElement: null,
        hidden: false,
        getElementById: (id) => (id === 'main' ? main : null),
        addEventListener: (name, listener) => listeners.set(name, listener)
      },
      HTMLInputElement: class {},
      HTMLSelectElement: class {},
      setInterval() {},
      fetch: async (url) => {
        const op = new URL(url, 'https://cosmoot.com').searchParams.get('op');
        if (op === 'status')
          return json({
            result: {
              node_info: { network: 'gnoland-1' },
              sync_info: { latest_block_height: '123', latest_block_time: new Date().toISOString() }
            }
          });
        if (op === 'list')
          return realm(
            `# GovDAO\n## Proposals\n### [Prop #1 - ${title()}](/r/gov/dao:1)\nAuthor: @alice\n\nStatus: ${version ? 'ACCEPTED' : 'ACTIVE'}\n\nTiers eligible to vote: T1\n`
          );
        assert.equal(op, 'detail');
        const request = Promise.withResolvers();
        requests.push(request);
        return request.promise;
      }
    });
    try {
      const workspace = createGovernanceWorkspace({ innerHTML: '' });
      workspace.render({ mode: 'live', scope: 'gno', page: 'proposals', id: '1' });
      await until(() => requests.length === 1);
      version = 1;
      listeners.get('click')({ target: { closest: () => ({ dataset: { gov: 'refresh' } }) } });
      await until(() => main.innerHTML.includes('Current title'));
      assert.equal(requests.length, 1, 'The existing request remains pending during refresh.');
      requests[0].resolve(
        obsoleteResult === 'success'
          ? realm(
              '## Prop #1 - Old title\nAuthor: @alice\n\nOBSOLETE BODY\n\n### Stats\nStill active'
            )
          : new Response('', { status: 503 })
      );
      await until(() => requests.length === 2);
      assert.doesNotMatch(main.innerHTML, /OBSOLETE BODY|The source could not load this proposal/);
      requests[1].resolve(
        realm(
          '## Prop #1 - Current title\nAuthor: @alice\n\nCURRENT BODY\n\n### Stats\nPROPOSAL HAS BEEN ACCEPTED'
        )
      );
      await until(() => main.innerHTML.includes('CURRENT BODY'));
      assert.match(main.innerHTML, /Current title/);
      assert.match(main.innerHTML, /Accepted/);
      assert.doesNotMatch(main.innerHTML, /Old title|OBSOLETE BODY/);
      await setImmediate();
      assert.equal(requests.length, 2, 'A completed current request must not cause a retry loop.');
    } finally {
      for (const [key, descriptor] of Object.entries(saved)) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor);
        else delete globalThis[key];
      }
    }
  });
}
