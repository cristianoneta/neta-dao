import { ReviewMainnetActivation } from './juno-review-mainnet-activate-core.mjs';
import { connectReviewSetup } from './juno-review-mainnet-deploy-core.mjs';
import { REVIEW_MAINNET_OWNER, REVIEW_MAINNET_WASM } from './juno-review-mainnet-config.mjs';
const $ = (id) => document.getElementById(id);
let session = null,
  busy = false,
  review = null,
  epoch = 0;
function clear() {
  review = null;
  $('review').hidden = true;
  $('review-text').textContent = '';
}
function render() {
  let s;
  try {
    s = session?.setup.state();
  } catch (e) {
    $('status').textContent = e.message;
  }
  $('connect').disabled = busy || !!session;
  $('disconnect').hidden = !session && !busy;
  $('connect').textContent = busy && !session ? 'Connecting…' : 'Connect Keplr · Juno mainnet';
  $('wallet').textContent = session
    ? session.owner
    : busy
      ? 'Connection in progress…'
      : 'Juno setup not connected.';
  $('registry-state').textContent = s?.codeId
    ? `Code ${s.codeId}${s.address ? ' · ' + s.address : ' · ready to create'}`
    : 'Pinned mainnet review; connect to verify.';
  $('pending').textContent = s?.pending
    ? `${s.pending.kind} · outcome pending`
    : session
      ? 'No pending activation.'
      : 'No wallet connected.';
  for (const b of document.querySelectorAll('[data-kind]'))
    b.disabled =
      busy ||
      !$('approve-policy').checked ||
      !s ||
      !!s.pending ||
      s.history.some((x) => !x.receipt.notBroadcast && x.receipt.code === 0);
  $('approve-policy').disabled = busy;
  $('confirm').disabled = busy || !review || !session;
  $('recover').disabled = busy || !s?.pending;
  $('download').disabled = busy || !s?.address || !!s?.pending;
  $('recovery-hash').disabled = busy;
}
async function run(fn, status = $('status')) {
  if (busy) return;
  busy = true;
  render();
  try {
    await fn();
  } catch (e) {
    status.textContent = e.message;
  } finally {
    busy = false;
    render();
  }
}
function disconnected() {
  epoch++;
  session?.disconnect();
  session = null;
  clear();
  $('connection-status').textContent =
    'Disconnected. Activation and transaction records are preserved.';
  render();
}
$('owner').textContent = REVIEW_MAINNET_OWNER;
$('connect').addEventListener('click', () =>
  run(async () => {
    const started = epoch;
    const candidate = await connectReviewSetup({
      Setup: ReviewMainnetActivation,
      assertCurrent: () => {
        if (started !== epoch) throw Error('Wallet connection changed.');
      },
      onStatus: (message) => {
        $('connection-status').textContent = message;
      }
    });
    if (started !== epoch) {
      candidate.disconnect();
      throw Error('Wallet connection changed.');
    }
    session = candidate;
    $('connection-status').textContent = 'Connected. Juno verified. Review one action at a time.';
  }, $('connection-status'))
);
$('disconnect').addEventListener('click', disconnected);
window.addEventListener('keplr_keystorechange', disconnected);
for (const b of document.querySelectorAll('[data-kind]'))
  b.addEventListener('click', () =>
    run(async () => {
      clear();
      if (!$('approve-policy').checked)
        throw Error('Review and approve the mainnet stake policy and owner custody first.');
      const current = session,
        prepared = await current.setup.prepare(b.dataset.kind);
      if (current !== session) throw Error('Wallet connection changed.');
      review = { current, prepared };
      $('review-text').textContent =
        `Network: Juno mainnet · juno-1\nUpgrade authority: owner wallet ${REVIEW_MAINNET_OWNER}\nReviewed WASM SHA-256: ${REVIEW_MAINNET_WASM}\n${JSON.stringify(prepared.request, null, 2)}`;
      $('review').hidden = false;
      $('review-heading').focus();
    })
  );
const result = (r) =>
  r.notBroadcast
    ? 'No broadcast was sent. A new attempt requires a new review.'
    : r.code === 0
      ? 'Confirmed on Juno mainnet · ' + r.transactionHash
      : 'Included transaction failed (code ' + r.code + '). Review any new attempt separately.';
$('confirm').addEventListener('click', () =>
  run(async () => {
    const r = review;
    clear();
    if (!r || r.current !== session) throw Error('Review the action again.');
    $('status').textContent = result(await r.current.setup.execute(r.prepared));
  })
);
$('discard-review').addEventListener('click', () => {
  clear();
  render();
});
$('recover').addEventListener('click', () =>
  run(async () => {
    clear();
    $('status').textContent = result(
      await session.setup.recover($('recovery-hash').value.trim().toUpperCase() || null)
    );
  })
);
$('download').addEventListener('click', () =>
  run(async () => {
    const current = session,
      data = await current.setup.exportBundle();
    if (current !== session) throw Error('Wallet connection changed.');
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(data, null, 2) + '\n'], { type: 'application/json' })
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = 'juno-review-mainnet-activation-receipts.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    $('status').textContent = data.activated
      ? 'Verified: mainnet review is enabled. Public receipts saved.'
      : 'Review remains paused. Public receipts saved.';
  })
);
$('approve-policy').addEventListener('change', () => {
  clear();
  render();
});
render();
