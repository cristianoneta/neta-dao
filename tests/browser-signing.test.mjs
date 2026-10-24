import test from 'node:test';
import assert from 'node:assert/strict';
import { signingLoader } from '../browser-signing.mjs';

function fixture(timeoutMs = 1000) {
  const scripts = [],
    scope = {};
  const document = {
    createElement: () => ({
      remove() {
        this.removed = true;
      }
    }),
    head: { append: (script) => scripts.push(script) }
  };
  return {
    scripts,
    scope,
    load: signingLoader({ name: 'Signing', source: '/reviewed.js', scope, document, timeoutMs })
  };
}
test('signing bundle is lazy, concurrent callers share one load and an existing bundle is reused', async () => {
  const f = fixture();
  assert.equal(f.scripts.length, 0);
  const a = f.load(),
    b = f.load();
  assert.equal(f.scripts.length, 1);
  f.scope.Signing = {
    connect() {
      throw Error('Loader must never connect a wallet');
    }
  };
  f.scripts[0].onload();
  assert.equal(await a, f.scope.Signing);
  assert.equal(await b, f.scope.Signing);
  assert.equal(await f.load(), f.scope.Signing);
  assert.equal(f.scripts.length, 1);
});
test('failed or empty signing loads can be retried explicitly', async () => {
  for (const event of ['onerror', 'onload']) {
    const f = fixture(),
      first = f.load(),
      rejection = assert.rejects(first, /Signing tools/);
    f.scripts[0][event]();
    await rejection;
    assert.equal(f.scripts[0].removed, true);
    const second = f.load();
    assert.equal(f.scripts.length, 2);
    f.scope.Signing = {};
    f.scripts[1].onload();
    assert.equal(await second, f.scope.Signing);
  }
});
test('stalled signing load times out without connecting or signing', async () => {
  const f = fixture(5);
  await assert.rejects(f.load(), /timed out/);
  assert.equal(f.scripts[0].removed, true);
});
