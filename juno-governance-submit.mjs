import { proposalContent, verifyGovernance } from './juno-governance-core.mjs';

const memo = 'Cosmoot Juno governance proposal';
const amount = (raw) => {
  const n = BigInt(raw);
  return `${n / 1000000n}.${(n % 1000000n).toString().padStart(6, '0')}`;
};
async function get(url) {
  const r = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(12000) });
  if (!r.ok) throw Error(`Juno query unavailable (HTTP ${r.status}).`);
  return r.json();
}
let bundle;
function signing() {
  return (bundle ||= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = '/assets/juno-governance-signing.js';
    script.onload = () => resolve(window.JunoGovernanceSigning);
    script.onerror = () => {
      bundle = null;
      reject(Error('Could not load Juno signing support.'));
    };
    document.head.append(script);
  }));
}
export function mountSubmission({ panel, context, values, session, busy, done }) {
  let epoch = 0,
    review = null,
    client = null,
    working = false,
    completed = new Set();
  const status = panel.querySelector('[data-submit-status]'),
    details = panel.querySelector('[data-submit-review]'),
    confirm = panel.querySelector('[data-submit-confirm]'),
    cancel = panel.querySelector('[data-submit-cancel]');
  function invalidate() {
    epoch++;
    review = null;
    details.hidden = true;
    confirm.disabled = true;
    if (!working) {
      client?.disconnect();
      client = null;
    }
  }
  function current(c, s, v, e) {
    if (
      e !== epoch ||
      context()?.id !== c.id ||
      context()?.kind !== c.kind ||
      session()?.address !== s.address ||
      session()?.chainId !== 'juno-1' ||
      JSON.stringify(values()) !== JSON.stringify(v)
    )
      throw Error('Proposal or wallet changed. Review again.');
  }
  async function wallet(address) {
    const signer = await window.keplr.getOfflineSignerAuto('juno-1'),
      accounts = await signer.getAccounts(),
      key = await window.keplr.getKey('juno-1');
    if (accounts.length !== 1 || accounts[0].address !== address || key.bech32Address !== address)
      throw Error('Keplr account changed. Reconnect and review again.');
    return signer;
  }
  async function prepare() {
    if (working) return;
    invalidate();
    const e = epoch,
      c = context(),
      s = session(),
      v = structuredClone(values());
    if (!c || completed.has(c.id)) throw Error('This draft was already submitted.');
    if (!s?.address || s.chainId !== 'juno-1') throw Error('Connect Keplr on Juno mainnet first.');
    panel.hidden = false;
    working = true;
    busy(true);
    status.textContent = 'Checking governance authority, current delegations and deposit…';
    try {
      const content = proposalContent(c.kind, v),
        verified = await verifyGovernance(c.kind, content, get);
      current(c, s, v, e);
      const bridge = await signing(),
        signer = await wallet(s.address);
      current(c, s, v, e);
      ({ client } = await bridge.connect(
        ['https://juno-rpc.polkachu.com', 'https://rpc-juno.whispernode.com'],
        signer,
        '0.075ujuno'
      ));
      const gas = await bridge.simulate(
          client,
          s.address,
          c.kind,
          v,
          verified.initialDeposit,
          memo
        ),
        fee = bridge.fixedFee(gas, 1.4, '0.075ujuno', 2000000);
      current(c, s, v, e);
      const count = content.messages[0]?.msg.execute_admin_msgs.msgs.length || 0;
      review = { c, s, v, e, verified, fee, bridge, time: Date.now() };
      panel.querySelector('[data-submit-summary]').textContent =
        `Juno mainnet · ${v.title}\nTopic: Delegation Programme\nProposer: ${s.address}\nDeposit: ${amount(verified.initialDeposit[0].amount)} JUNO (full current minimum)\nNetwork fee: ${amount(fee.amount[0].amount)} JUNO\n${count ? `${count} reward withdrawals through the programme’s governance admin; destination: programme treasury.` : 'Rule approval only; no delegation or transfer actions.'}\nDeposit and fee are paid by your wallet. The deposit is subject to Juno’s return/burn rules. Submitting starts governance; rewards move only if the proposal passes and executes. Transaction simulation checks submission, not future execution.`;
      details.hidden = false;
      confirm.disabled = false;
      status.textContent =
        'Review the proposal text, actions, deposit and fee, then confirm in Keplr.';
      details.focus();
    } catch (error) {
      invalidate();
      status.textContent = error.message;
    } finally {
      working = false;
      busy(false);
      if (!review) {
        client?.disconnect();
        client = null;
      }
    }
  }
  confirm.onclick = async () => {
    if (!review || working) return;
    const r = review;
    working = true;
    busy(true);
    confirm.disabled = true;
    try {
      current(r.c, r.s, r.v, r.e);
      if (Date.now() - r.time > 120000)
        throw Error('Review expired. Check the current deposit and fee again.');
      status.textContent = 'Rechecking current authority and deposit before Keplr…';
      const fresh = await verifyGovernance(r.c.kind, proposalContent(r.c.kind, r.v), get);
      if (JSON.stringify(fresh) !== JSON.stringify(r.verified))
        throw Error('Governance parameters changed. Review again.');
      const assertWallet = async () => {
        current(r.c, r.s, r.v, r.e);
        if (Date.now() - r.time > 120000)
          throw Error('Review expired. Review again before signing.');
        await wallet(r.s.address);
        current(r.c, r.s, r.v, r.e);
        if (Date.now() - r.time > 120000) throw Error('Review expired. Nothing was broadcast.');
      };
      await assertWallet();
      const result = await r.bridge.execute(
        client,
        r.s.address,
        r.c.kind,
        r.v,
        r.verified.initialDeposit,
        r.fee,
        memo,
        { assertWallet }
      );
      completed.add(r.c.id);
      const receipt = {
        transactionHash: result.transactionHash,
        height: result.height,
        submittedAt: new Date().toISOString()
      };
      done(r.c.id, receipt);
      status.textContent = `Submitted to Juno governance at block ${result.height}. Transaction: ${result.transactionHash}. Rewards have not been claimed by submission.`;
    } catch (error) {
      status.textContent = error.message;
    } finally {
      working = false;
      invalidate();
      busy(false);
    }
  };
  cancel.onclick = () => {
    if (!working) {
      invalidate();
      status.textContent = 'Review cancelled. Your draft is preserved.';
    }
  };
  for (const name of [
    'keplr_keystorechange',
    'neta:wallet-change',
    'neta:dao-change',
    'hashchange',
    'pagehide'
  ])
    window.addEventListener(name, invalidate);
  document.querySelector('.proposal-workspace').addEventListener('input', invalidate);
  return { prepare, invalidate };
}
