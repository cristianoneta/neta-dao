import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import test from 'node:test';

const script = await readFile(new URL('../relay-uni7-readiness.js', import.meta.url), 'utf8');
const contract = 'juno13uft9dl34x9wdzcxnm80q8m8sh5cw04lkskzknm9vc0wduxchdxsrnr4pa';
const addressA = 'juno1z3xcalwan92yqxu9d406tlft9yy94jy8s5et57';
const addressB = 'juno1excmamnysxujtd2hzm343nzdwch79y5cvk5h7w6uxlrt230xqwtqkmancl';
const flush = async () => { for (let i = 0; i < 20; i++) await new Promise(resolve => setTimeout(resolve, 0)); };
function element() {
  return { textContent: '', value: '', disabled: false, children: [], replaceChildren() { this.children = []; },
    append(...items) { this.children.push(...items); }, addEventListener(event, fn) { this[event] = fn; } };
}
async function setup({ chain = 'uni-7', hash = 'e02c7918d1f8da0f662a0720fc3668765d79ededce8e9e9dcccff9aae2b9e64a', offline = false } = {}) {
  const elements = Object.fromEntries(['identity', 'status', 'results', 'check', 'connect', 'first', 'second'].map(id => [id, element()]));
  const calls = [];
  const context = {
    document: { getElementById: id => elements[id], createElement: () => element(), createTextNode: text => ({ textContent: text }) },
    window: { addEventListener() {} }, AbortController, setTimeout, clearTimeout, atob,
    fetch: async url => {
      calls.push(url);
      if (offline) throw Error('offline');
      let data;
      if (url.endsWith('/node_info')) data = { default_node_info: { network: chain } };
      else if (url.endsWith('/contract/' + contract)) data = { contract_info: { creator: addressA, label: 'NETA RELAY mailbox v0.1 · UNI-7', code_id: '9' } };
      else if (url.endsWith('/code/9')) data = { code_info: { data_hash: hash } };
      else if (url.includes('/smart/')) {
        const query = JSON.parse(atob(decodeURIComponent(url.split('/smart/')[1])));
        data = { data: query.device ? null : { messages: [] } };
      } else throw Error('unexpected URL ' + url);
      return { ok: true, json: async () => data };
    }
  };
  runInNewContext(script, context);
  await flush();
  return { elements, calls };
}
test('readiness checks chain and code identity before public queries', async () => {
  const valid = await setup();
  assert.match(valid.elements.identity.textContent, /^VERIFIED/);
  valid.elements.first.value = addressA;
  valid.elements.second.value = addressB;
  await valid.elements.check.click();
  assert.match(valid.elements.status.textContent, /NO MESSAGE DECRYPTED OR SENT/);
  assert.equal(valid.calls.filter(url => url.includes('/smart/')).length, 4);
  for (const options of [{ chain: 'juno-1' }, { hash: '0'.repeat(64) }, { offline: true }]) {
    const blocked = await setup(options);
    assert.equal(blocked.elements.check.disabled, true);
    assert.equal(blocked.calls.some(url => url.includes('/smart/')), false);
  }
});
test('invalid and duplicate addresses never query a device or inbox', async () => {
  const { elements, calls } = await setup();
  elements.first.value = addressA;
  elements.second.value = addressA;
  await elements.check.click();
  assert.match(elements.status.textContent, /TWO DISTINCT/);
  assert.equal(calls.some(url => url.includes('/smart/')), false);
});
