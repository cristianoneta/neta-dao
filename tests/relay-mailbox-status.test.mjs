import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import test from 'node:test';

const script = await readFile(new URL('../relay-mailbox-status.js', import.meta.url), 'utf8');
const address = 'juno13uft9dl34x9wdzcxnm80q8m8sh5cw04lkskzknm9vc0wduxchdxsrnr4pa';

async function check({ chain = 'uni-7', hash = 'e02c7918d1f8da0f662a0720fc3668765d79ededce8e9e9dcccff9aae2b9e64a', unavailable = false } = {}) {
  const status = { textContent: '' };
  const composer = { hidden: false };
  const button = { addEventListener: (_event, handler) => { button.click = handler; } };
  const paths = [];
  const ctx = {
    document: { querySelector: selector => ({ '#relay-mailbox-status': status, '#relay-new-message': button, '#relay-composer': composer })[selector] },
    fetch: async url => {
      paths.push(url);
      if (unavailable) throw Error('offline');
      let data;
      if (url.endsWith('/node_info')) data = { default_node_info: { network: chain } };
      else if (url.endsWith(`/contract/${address}`)) data = { contract_info: { creator: 'juno1z3xcalwan92yqxu9d406tlft9yy94jy8s5et57', label: 'NETA RELAY mailbox v0.1 · UNI-7', code_id: '9' } };
      else if (url.endsWith('/code/9')) data = { code_info: { data_hash: hash } };
      else throw Error(`Unexpected query: ${url}`);
      return { ok: true, json: async () => data };
    },
    AbortController, setTimeout, clearTimeout, atob,
  };
  runInNewContext(script, ctx);
  button.click();
  for (let i = 0; i < 20 && status.textContent.startsWith('CHECKING'); i++) await new Promise(resolve => setTimeout(resolve, 0));
  return { message: status.textContent, paths };
}

test('only a UNI-7 contract with the expected code hash is shown as verified', async () => {
  const valid = await check();
  assert.match(valid.message, /MAILBOX VERIFIED ON UNI-7/);
  assert.ok(valid.paths.some(path => path.endsWith(`/contract/${address}`)));
  assert.match((await check({ chain: 'juno-1' })).message, /IDENTITY MISMATCH/);
  assert.match((await check({ hash: '0'.repeat(64) })).message, /IDENTITY MISMATCH/);
  assert.match((await check({ unavailable: true })).message, /CHECK UNAVAILABLE/);
});
