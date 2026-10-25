import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { SigningStargateClient, defaultRegistryTypes } from '@cosmjs/stargate';
import { Registry } from '@cosmjs/proto-signing';
import { sha256 } from '@cosmjs/crypto';
import { toBase64, toHex } from '@cosmjs/encoding';
import { AuthInfo } from 'cosmjs-types/cosmos/tx/v1beta1/tx';
import { MsgExecuteContract } from 'cosmjs-types/cosmwasm/wasm/v1/tx';
import { execute, fixedFee } from '../src/wynd-swap-signing.mjs';

const source = await readFile(new URL('../../buy-neta-wallet.mjs', import.meta.url), 'utf8');
const address = 'juno1d0g7f97v87xwe6r4vr4jj3jfhzcv4vvfhamy8w';
const fee = fixedFee(150000, 1.4, '0.075ujuno', 500000);
const memo = 'cosmoot:wynd-swap:v1';

async function fixture(ignorePreferences = false) {
  const elements = new Map();
  const events = [];
  const rows = new Map();
  let signs = 0;
  let broadcast;
  const window = {
    keplr: {
      enable: async (chain) => assert.equal(chain, 'juno-1'),
      getKey: async () => ({ bech32Address: address }),
      getOfflineSignerAuto: async (chain, options) => {
        assert.equal(chain, 'juno-1');
        assert.notEqual(options?.disableBalanceCheck, true);
        return {
          getAccounts: async () => [
            { address, algo: 'secp256k1', pubkey: new Uint8Array(33).fill(2) }
          ],
          signDirect: async (sender, signDoc) => {
            assert.equal(sender, address);
            signs++;
            const auth = AuthInfo.decode(signDoc.authInfoBytes);
            // Model Keplr's documented defaults: it may replace the fee unless
            // the dApp supplies its per-signer preferences. No real key or RPC.
            if (ignorePreferences || !options?.preferNoSetFee) {
              auth.fee.gasLimit += 10000n;
              auth.fee.amount = [{ denom: 'ujuno', amount: '20000' }];
            }
            return {
              signed: {
                ...signDoc,
                authInfoBytes: AuthInfo.encode(auth).finish()
              },
              signature: { signature: toBase64(new Uint8Array(64)) }
            };
          }
        };
      }
    }
  };
  runInNewContext(source, {
    window,
    document: {
      querySelector: (selector) => {
        const element = { addEventListener: (event, fn) => (element[event] = fn) };
        elements.set(selector, element);
        return element;
      }
    },
    Event,
    dispatchEvent: (event) => events.push(event.type),
    addEventListener: () => {}
  });
  await elements.get('#connect-wallet').click();
  assert.ok(events.includes('neta:wallet-connected'));
  assert.equal(window.keplr.defaultOptions, undefined);
  const client = await SigningStargateClient.offline(window.NETA_WALLET_STATE.signer, {
    registry: new Registry([
      ...defaultRegistryTypes,
      ['/cosmwasm.wasm.v1.MsgExecuteContract', MsgExecuteContract]
    ])
  });
  client.getChainId = async () => 'juno-1';
  client.getSequence = async () => ({ accountNumber: 1, sequence: 2 });
  client.broadcastTx = async (bytes) => {
    assert.equal(broadcast, undefined, 'only one broadcast');
    broadcast = bytes;
    return { transactionHash: toHex(sha256(bytes)).toUpperCase(), height: 42, code: 0 };
  };
  globalThis.localStorage = {
    getItem: (key) => rows.get(key) ?? null,
    setItem: (key, value) => rows.set(key, value),
    removeItem: (key) => rows.delete(key)
  };
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: { locks: { request: async (key, options, fn) => fn({}) } }
  });
  return {
    send: () =>
      execute(client, address, 'pair', { swap: {} }, [], fee, memo, {
        assertWallet: async () => assert.equal(window.NETA_WALLET_STATE.address, address)
      }),
    result: () => ({ signs, broadcast, journalSize: rows.size })
  };
}

test('connected Keplr signer preserves the reviewed fee and memo through CosmJS signing', async () => {
  const f = await fixture();
  await f.send();
  assert.equal(f.result().signs, 1);
  assert.ok(f.result().broadcast);
  assert.equal(f.result().journalSize, 0);
});

test('a wallet that still changes the fee is rejected before broadcast', async () => {
  const f = await fixture(true);
  await assert.rejects(f.send(), /Wallet changed the reviewed fee. Nothing was broadcast/);
  assert.deepEqual(f.result(), { signs: 1, broadcast: undefined, journalSize: 0 });
});
