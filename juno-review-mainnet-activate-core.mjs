import { ReviewMainnetSetup } from './juno-review-mainnet-deploy-core.mjs';
import {
  REVIEW_MAINNET_RELEASE as PIN,
  REVIEW_MAINNET_OWNER as OWNER
} from './juno-review-mainnet-config.mjs';
import { verifyMainnetReview } from './juno-review-mainnet-read.mjs';
const stable = (v) =>
  JSON.stringify(v, (_, x) =>
    x && typeof x === 'object' && !Array.isArray(x)
      ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b)))
      : x
  );
export class ReviewMainnetActivation extends ReviewMainnetSetup {
  constructor(options) {
    super(options);
    this.key = 'cosmoot-juno-review-mainnet-activation-v1:' + PIN.contract + ':' + OWNER;
  }
  state() {
    const s = super.state();
    if (
      (s.codeId !== null && s.codeId !== PIN.codeId) ||
      (s.address !== null && s.address !== PIN.contract)
    )
      throw Error('Activation identity changed. Preserve the journal.');
    return { ...s, codeId: PIN.codeId, address: PIN.contract };
  }
  async verifyState() {
    return verifyMainnetReview({ fetcher: this.fetcher });
  }
  async requirePaused() {
    const current = await this.verifyState();
    if (!current.config.paused)
      throw Error('Mainnet review is already enabled. No activation transaction is needed.');
    return current;
  }
  recipe(kind) {
    if (kind !== 'activate') throw Error('Unknown activation action.');
    return {
      kind: 'execute',
      owner: OWNER,
      contract: PIN.contract,
      msg: { set_paused: { paused: false } },
      memo: 'Enable Juno community review on Juno mainnet'
    };
  }
  async prepare(kind) {
    return this.lock(async () => {
      await this.assertWallet(OWNER);
      if (this.state().pending) throw Error('Reconcile the pending activation first.');
      const request = this.recipe(kind);
      await this.requirePaused();
      await this.assertWallet(OWNER);
      return { kind, request };
    });
  }
  async verifyPending() {
    await this.assertWallet(OWNER);
    const p = this.state().pending;
    if (!p) throw Error('No persisted activation intent.');
    const request = { ...p.request };
    delete request.intentId;
    if (stable(request) !== stable(this.recipe(p.kind))) throw Error('Activation request changed.');
    if (this.recovering) await this.verifyState();
    else await this.requirePaused();
    await this.assertWallet(OWNER);
  }
  async recover(hash = null) {
    return this.lock(async () => {
      const p = this.state().pending;
      if (!p) throw Error('No pending activation.');
      this.recovering = true;
      try {
        return await this.settle(await this.bridge.recover({ ...p.request }, hash));
      } finally {
        this.recovering = false;
      }
    });
  }
  async settle(receipt) {
    const s = this.state(),
      p = s.pending;
    if (!p || receipt.intentMatched !== true) throw Error('Missing exact activation receipt.');
    if (
      !receipt.notBroadcast &&
      (!/^[A-F0-9]{64}$/.test(receipt.transactionHash) ||
        receipt.chainId !== 'juno-1' ||
        !Number.isSafeInteger(receipt.height) ||
        receipt.height < 1 ||
        !Number.isInteger(receipt.code) ||
        receipt.code < 0)
    )
      throw Error('Invalid activation receipt.');
    const current = await this.verifyState();
    if (!receipt.notBroadcast && receipt.code === 0 && current.config.paused)
      throw Error(
        'Activation is not yet confirmed by both providers. Check the pending transaction again.'
      );
    s.history.push({ request: p.request, receipt });
    s.pending = null;
    this.save(s);
    return receipt;
  }
  async exportBundle() {
    return this.lock(async () => {
      const s = this.state();
      if (s.pending) throw Error('Reconcile the pending activation first.');
      const current = await this.verifyState();
      return {
        kind: 'juno-review-mainnet-activation-receipts',
        deployment: PIN,
        ...current,
        history: s.history,
        activated: !current.config.paused
      };
    });
  }
}
