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

test('the Names loader retains its bundle version and recovers from timeout, missing global and transport failure', async (t) => {
  const scripts = [];
  const savedDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const savedSigning = Object.getOwnPropertyDescriptor(globalThis, 'NetaNamesSigning');
  t.after(() => {
    for (const [name, descriptor] of [
      ['document', savedDocument],
      ['NetaNamesSigning', savedSigning]
    ]) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
  });
  globalThis.document = {
    createElement: () => ({
      remove() {
        this.removed = true;
      }
    }),
    head: { append: (script) => scripts.push(script) }
  };
  delete globalThis.NetaNamesSigning;
  t.mock.timers.enable({ apis: ['setTimeout'] });
  // Import the actual configured export in a fresh browser-like module context.
  const { loadNamesSigning } = await import('../browser-signing.mjs?names-loader-test');
  assert.equal(scripts.length, 0, 'module initialization must not load signing code');
  for (const failure of ['timeout', 'onload', 'onerror']) {
    const previous = scripts.length;
    const first = loadNamesSigning(),
      second = loadNamesSigning();
    const rejected = Promise.all([
      assert.rejects(first, /Signing tools/),
      assert.rejects(second, /Signing tools/)
    ]);
    assert.equal(scripts.length, previous + 1, 'concurrent callers share one script');
    const script = scripts.at(-1);
    assert.equal(script.src, '/assets/names-signing.js?v=5');
    if (failure === 'timeout') t.mock.timers.tick(30000);
    else script[failure]();
    await rejected;
    assert.equal(script.removed, true);
    assert.equal(script.onload, null);
    assert.equal(script.onerror, null);
  }
  const retry = loadNamesSigning();
  globalThis.NetaNamesSigning = {
    connect() {
      throw Error('Loading must not connect the wallet or touch its journal');
    }
  };
  scripts.at(-1).onload();
  assert.equal(await retry, globalThis.NetaNamesSigning);
  assert.equal(await loadNamesSigning(), globalThis.NetaNamesSigning);
  assert.equal(scripts.length, 4);
});
