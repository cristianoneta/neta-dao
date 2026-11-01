import test from 'node:test';
import assert from 'node:assert/strict';
import { discussionEntry } from '../src/governance/discussion-entry.mjs';
import { discussionSource, discussionUrl, parseDiscussionSource } from '../discussion-links.mjs';
const first = discussionSource({ kind: 'native', chainId: 'juno-1', contract: 'gov', id: 1 });
const second = discussionSource({ kind: 'native', chainId: 'juno-1', contract: 'gov', id: 2 });
const ready = (source) =>
  new Response(JSON.stringify({ ready: true, replies: 4, thread: { sources: [{ key: source }] } }));
const controls = () => ({
  link: {
    hidden: true,
    setAttribute(k, v) {
      this[k] = v;
    }
  },
  panel: { hidden: false }
});
test('discussion navigation uses canonical public source identities', () => {
  assert.equal(parseDiscussionSource(first).id, '1');
  assert.match(discussionUrl(first), /^\/discussions.html\?source=/);
  for (const value of ['https://evil.example', first + ':extra', 'native:juno-1:gov:01'])
    assert.throws(() => parseDiscussionSource(value));
});
test('comments switch only after exact migration and preserve pending transaction recovery', async () => {
  const ui = controls();
  let response = new Response('{}', { status: 503 }),
    calls = 0,
    now = 0;
  const show = discussionEntry({
    ...ui,
    now: () => now,
    fetcher: async () => {
      calls++;
      return response;
    }
  });
  await show({ source: first, legacyVisible: true });
  assert.equal(ui.panel.hidden, false);
  assert.equal(ui.link.hidden, true);
  now += 31000;
  response = ready(first);
  await show({ source: first, legacyVisible: true });
  assert.equal(ui.panel.hidden, true);
  assert.equal(ui.link.hidden, false);
  assert.match(ui.link.textContent, /4/);
  await show({ source: first, legacyVisible: true, pending: true });
  assert.equal(ui.panel.hidden, false);
  assert.equal(ui.link.hidden, true);
  assert.equal(calls, 2);
  now += 31000;
  response = ready(second);
  await show({ source: first, legacyVisible: true });
  assert.equal(ui.panel.hidden, false);
  assert.equal(ui.link.hidden, true);
});
test('late discovery of a previously selected proposal cannot replace the current navigation', async () => {
  const ui = controls();
  let release;
  const show = discussionEntry({
    ...ui,
    fetcher: (source) =>
      source.includes(encodeURIComponent(first))
        ? new Promise((r) => {
            release = r;
          })
        : Promise.resolve(ready(second))
  });
  const old = show({ source: first, legacyVisible: true });
  await show({ source: second });
  release(ready(first));
  await old;
  assert.equal(ui.link.href, discussionUrl(second));
  const pending = show({ source: first });
  await show();
  await pending;
  assert.equal(ui.link.hidden, true);
});
