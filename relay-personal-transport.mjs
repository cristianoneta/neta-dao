// SPDX-License-Identifier: GPL-3.0-only
// Personal transport for the exact-byte signing bridge (NetaNamesSigning).
// A ready packet never gets re-encrypted. Only an explicitly reviewed attempt
// may sign, and an unknown prior attempt can only be reconciled, never retried.
const id = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join('');
const hex = /^[a-f0-9]{64}$/;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const base64 = bytes => btoa(String.fromCharCode(...bytes));
export function personalSendRequest(profile, wallet, row, intentId) {
  if (!['uni-7','juno-1'].includes(profile?.chain) || row?.meta?.chain !== profile.chain ||
      row.meta.contract !== profile.contract || row.meta.sender !== wallet || !hex.test(row.id) ||
      row.send?.messageId !== row.id || row.send.recipient !== row.meta.recipient ||
      row.send.generation !== row.meta.recipientGeneration || row.send.fingerprint !== row.meta.recipientFingerprint ||
      !Array.isArray(row.ciphertext) || row.ciphertext.length < 16 || row.ciphertext.length > 4096 ||
      row.ciphertext.some(n => !Number.isInteger(n) || n < 0 || n > 255) || !/^[a-f0-9]{32}$/.test(intentId))
    throw Error('Invalid saved personal packet');
  const body = {recipient: row.meta.recipient, recipient_generation: row.meta.recipientGeneration,
    sender_generation: row.meta.senderGeneration,
    message_id: row.id, ciphertext: base64(row.ciphertext)};
  const initial = row.send.initialPrekeyId !== undefined;
  if (initial) body.prekey_id = row.send.initialPrekeyId;
  return {owner: wallet, contract: profile.contract, intentId, kind: 'execute',
    msg: {[initial ? 'send_initial' : 'send']: body}, memo: 'RELAY personal encrypted message · ' + profile.chain};
}
export class PersonalMessageTransport {
  constructor({adapter, journal, bridge, locks = globalThis.navigator?.locks}) {
    if (!adapter?.profile || !journal?.entries || !journal?.save || !bridge?.execute || !bridge?.recover || !locks?.request)
      throw Error('Verified adapter, encrypted journal and exact transaction bridge required');
    Object.assign(this, {adapter, journal, bridge, locks});
  }
  async exclusive(action) {
    const p = this.adapter.profile;
    return this.locks.request(['relay-personal-transport',p.chain,p.contract,this.adapter.address].join(':'),
      {mode:'exclusive',ifAvailable:true}, lock => {
        if (!lock) throw Error('Another tab is handling this personal packet');
        return action();
      });
  }
  review(id) { return this.exclusive(() => this._review(id)); }
  submit(review) { return this.exclusive(() => this._submit(review)); }
  recover(id) { return this.exclusive(() => this._recover(id)); }
  async row(messageId) {
    if (!hex.test(messageId)) throw Error('Invalid message ID');
    const row = (await this.journal.entries()).find(r => r.id === messageId);
    if (!row || !['ready','confirmed'].includes(row.state)) throw Error('No ready personal packet');
    return row;
  }
  async receipt(row) {
    return this.journal.reconcile(row.id, () => this.adapter.smart({sent:{sender:row.meta.sender,message_id:row.id}}));
  }
  async validate(row) {
    await this.adapter.assertWallet(); await this.adapter.verify();
    if (row.meta.sender !== this.adapter.address) throw Error('Wallet changed');
    const own = await this.adapter.device(), remote = await this.adapter.device(row.meta.recipient);
    if (!own?.active || own.generation !== row.meta.senderGeneration || own.fingerprint !== row.meta.senderFingerprint ||
        !remote?.active || remote.generation !== row.meta.recipientGeneration || remote.fingerprint !== row.meta.recipientFingerprint ||
        remote.device_id !== row.send.deviceId) throw Error('Device generation changed; preserve packet');
    const blocked = await this.adapter.smart({blocked:{recipient:row.meta.recipient,sender:row.meta.sender}});
    if (blocked !== false) throw Error('Recipient blocked sender or source unavailable');
    const consent = await this.adapter.smart({consent:{recipient:row.meta.recipient,sender:row.meta.sender}});
    if (!same(consent,[remote.generation,own.generation])) throw Error('Recipient consent required for these generations');
    if (row.send.initialPrekeyId !== undefined) {
      const found = remote.prekeys?.find(p => p.id === row.send.initialPrekeyId);
      if (!found || found.bundle !== base64(row.send.initialPrekeyBundle)) throw Error('Initial prekey no longer available');
    }
    await this.adapter.assertWallet();
  }
  async _review(messageId) {
    const row = await this.row(messageId);
    if ((await this.receipt(row)).state === 'confirmed') throw Error('Message already confirmed');
    if (row.attempt && !['not_broadcast','failed'].includes(row.attempt.outcome)) throw Error('Previous attempt unresolved; reconcile only');
    await this.validate(row);
    return Object.freeze({messageId, chain: this.adapter.profile.chain,
      request: personalSendRequest(this.adapter.profile, this.adapter.address, row, id())});
  }
  async _submit(review) {
    const row = await this.row(review?.messageId);
    if (review.chain !== this.adapter.profile.chain || !same(review.request,
        personalSendRequest(this.adapter.profile, this.adapter.address, row, review.request?.intentId))) throw Error('Review changed');
    if ((await this.receipt(row)).state === 'confirmed') throw Error('Message already confirmed');
    if (row.attempt && !['not_broadcast','failed'].includes(row.attempt.outcome)) throw Error('Previous attempt unresolved');
    await this.validate(row);
    // Save before the bridge can sign. Crash between stores remains unresolved.
    const attempt = {request: structuredClone(review.request), outcome: 'pending'};
    await this.journal.save({...row, attempt, attempts: [...(row.attempts || []), ...(row.attempt ? [row.attempt] : [])]});
    await this.bridge.execute(review.request, {beforeSign: () => this.validate(row)});
    return this._recover(row.id);
  }
  async _recover(messageId) {
    await this.adapter.assertWallet();
    const row = await this.row(messageId);
    if (row.meta.sender !== this.adapter.address) throw Error('Wallet changed');
    const received = await this.receipt(row);
    if (received.state === 'confirmed') return received;
    if (!row.attempt) return {state:'ready', reviewRequired:true};
    const expected = personalSendRequest(this.adapter.profile, row.meta.sender, row, row.attempt.request?.intentId);
    if (!same(expected,row.attempt.request)) throw Error('Saved transaction intent changed');
    // Only the exact-byte bridge can classify an attempt. Text errors and a null
    // message query are never evidence that a transaction did not broadcast.
    const evidence = await this.bridge.recover(expected);
    if (evidence?.intentMatched !== true) throw Error('Unverified transaction outcome');
    let outcome;
    if (evidence.notBroadcast === true) outcome = 'not_broadcast';
    else if (evidence.chainId === this.adapter.profile.chain && /^[A-F0-9]{64}$/.test(evidence.transactionHash || '') &&
        Number.isSafeInteger(evidence.height) && evidence.height > 0 && Number.isInteger(evidence.code) && evidence.code > 0) outcome = 'failed';
    else throw Error('Successful or uncertain transaction lacks message receipt; keep locked');
    // Recheck after transaction lookup to catch a lagging first message query.
    const rechecked = await this.receipt(row);
    if (rechecked.state === 'confirmed') return rechecked;
    await this.journal.save({...row, attempt:{...row.attempt, outcome, evidence}});
    return {state:'ready', outcome, reviewRequired:true};
  }
}
