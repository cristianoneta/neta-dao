import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import {
  assertProgrammeExecutionAvailable,
  preflight,
  GOVERNANCE
} from '../juno-governance-core.mjs';
import { nativeExecutionFailure } from '../native-governance-display.mjs';

const proposal = JSON.parse(
  readFileSync(new URL('./fixtures/juno-proposal-381.json', import.meta.url))
).proposal;

test('proposal 381 reproduces the parser failure in the exact deployed code 4047 binary', () => {
  const code = readFileSync(new URL('./fixtures/programme-code-4047.wasm', import.meta.url));
  assert.equal(
    createHash('sha256').update(code).digest('hex'),
    'cf70918a88a9e0654e6b439b8927e8d7897bf113f25909973910682af227e287'
  );
  const module = new WebAssembly.Module(code);
  let hostCalls = 0;
  const env = Object.fromEntries(
    WebAssembly.Module.imports(module).map(({ name }) => [
      name,
      () => {
        hostCalls++;
        throw Error('Unexpected host call: ' + name);
      }
    ])
  );
  const { exports: wasm } = new WebAssembly.Instance(module, { env });
  const put = (value) => {
    const bytes = new TextEncoder().encode(JSON.stringify(value));
    const ptr = wasm.allocate(bytes.length),
      view = new DataView(wasm.memory.buffer);
    new Uint8Array(view.buffer, view.getUint32(ptr, true), bytes.length).set(bytes);
    view.setUint32(ptr + 8, bytes.length, true);
    return ptr;
  };
  const pointer = wasm.execute(
    put({
      block: { height: 42894587, time: '1792498250716018552', chain_id: 'juno-1' },
      transaction: { index: 0 },
      contract: { address: proposal.messages[0].contract }
    }),
    put({ sender: GOVERNANCE, funds: [] }),
    put(proposal.messages[0].msg)
  );
  const memory = new DataView(wasm.memory.buffer);
  const result = JSON.parse(
    new TextDecoder().decode(
      new Uint8Array(
        memory.buffer,
        memory.getUint32(pointer, true),
        memory.getUint32(pointer + 8, true)
      )
    )
  );
  assert.equal(result.error + ': execute wasm contract failed', proposal.failed_reason);
  assert.equal(hostCalls, 0, 'Failure occurs before any storage or chain access');
  assert.equal(proposal.messages[0].msg.execute_admin_msgs.msgs.length, 37);
});

test('new claims and preflight reject the incident payload before network or wallet access', async () => {
  assert.throws(
    () => assertProgrammeExecutionAvailable(proposal.messages),
    /incompatible format from proposal #381/
  );
  // A textual or encoded contract payload cannot bypass the contract-level pause.
  const encoded = proposal.messages.map((m) => ({
    ...m,
    msg: Buffer.from(JSON.stringify(m.msg)).toString('base64')
  }));
  assert.throws(() => assertProgrammeExecutionAvailable(encoded));
  assert.doesNotThrow(() => assertProgrammeExecutionAvailable([]));
  let reads = 0;
  await assert.rejects(
    preflight(['https://one.example', 'https://two.example'], proposal, GOVERNANCE, {
      fetcher: async () => {
        reads++;
        throw Error('Must not query');
      }
    }),
    /incompatible format from proposal #381/
  );
  assert.equal(reads, 0);
});

test('execution failure retains the actual chain reason, with no fabricated reason on other statuses', () => {
  assert.equal(
    nativeExecutionFailure(proposal),
    'Execution failed. Chain-reported reason: ' + proposal.failed_reason
  );
  assert.equal(
    nativeExecutionFailure({ ...proposal, failed_reason: undefined }),
    'Execution failed. Chain-reported reason: Unavailable.'
  );
  assert.equal(nativeExecutionFailure({ ...proposal, status: 'PROPOSAL_STATUS_PASSED' }), '');
  assert.equal(nativeExecutionFailure(null), '');
});
