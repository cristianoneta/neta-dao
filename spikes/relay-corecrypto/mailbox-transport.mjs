// Test-only UNI-7 contract adapter. Ciphertext is taken exclusively from a
// previously persisted outbox entry. No plaintext or private key enters a tx.
export const MAILBOX = 'juno13uft9dl34x9wdzcxnm80q8m8sh5cw04lkskzknm9vc0wduxchdxsrnr4pa';
const CHAIN = 'uni-7';

function id(value) { if (!/^[0-9a-f]{64}$/.test(value)) throw Error('Invalid message ID'); }
function sameBytes(a, b) {
  return a instanceof Uint8Array && b instanceof Uint8Array && a.length === b.length && a.every((byte, index) => byte === b[index]);
}
function base64(bytes) { return btoa(String.fromCharCode(...bytes)); }

export class MailboxTransport {
  constructor({ sender, network, account, verifyMailbox, query, execute, outbox }) {
    if (!sender?.startsWith('juno1') || typeof network !== 'function' || typeof account !== 'function' || typeof verifyMailbox !== 'function' || typeof query !== 'function' || typeof execute !== 'function' || !outbox?.reconcile) throw Error('Invalid mailbox adapter');
    Object.assign(this, { sender, network, account, verifyMailbox, query, execute, outbox });
  }
  async assertWallet() {
    if (await this.network() !== CHAIN || await this.account() !== this.sender) throw Error('Wrong chain or wallet');
  }
  async device(address) { return this.query(MAILBOX, { device: { address } }); }
  async sent(messageId) { id(messageId); return this.query(MAILBOX, { sent: { sender: this.sender, message_id: messageId } }); }

  async sendReady({ messageId, recipient, generation, deviceId, fingerprint, initialPrekeyId, initialPrekeyBundle }) {
    id(messageId);
    await this.assertWallet();
    if (await this.verifyMailbox(MAILBOX) !== true) throw Error('Mailbox code identity not verified');
    const pending = await this.outbox.reconcile(messageId, () => this.sent(messageId));
    if (pending.state === 'confirmed') return pending;
    if (pending.state !== 'ready' || pending.recipient !== recipient || pending.generation !== generation || !(pending.ciphertext instanceof Uint8Array) || pending.ciphertext.length < 16 || pending.ciphertext.length > 4096) throw Error('Outbox entry does not match intended recipient');
    const receiver = await this.device(recipient);
    const sender = await this.device(this.sender);
    if (!sender?.active || !receiver?.active || receiver.generation !== generation || receiver.device_id !== deviceId || receiver.fingerprint !== fingerprint) throw Error('Device identity changed; do not send');
    let message;
    if (initialPrekeyId !== undefined) {
      if (!Number.isInteger(initialPrekeyId) || initialPrekeyId < 0 || initialPrekeyId > 65535 || !(initialPrekeyBundle instanceof Uint8Array)) throw Error('Invalid initial prekey');
      const onChain = receiver.prekeys?.find(prekey => prekey.id === initialPrekeyId);
      if (!onChain || !sameBytes(Uint8Array.from(atob(onChain.bundle), char => char.charCodeAt(0)), initialPrekeyBundle)) throw Error('Recipient prekey changed or already consumed');
      message = { send_initial: { recipient, recipient_generation: generation, prekey_id: initialPrekeyId, message_id: messageId, ciphertext: base64(pending.ciphertext) } };
    } else {
      message = { send: { recipient, recipient_generation: generation, message_id: messageId, ciphertext: base64(pending.ciphertext) } };
    }
    await this.assertWallet();
    // A rejected or timed-out execute is ambiguous. Leave the exact encrypted
    // entry in the outbox; reconciliation must query chain before any retry.
    await this.execute(MAILBOX, message, 'RELAY encrypted UNI-7 message');
    const confirmed = await this.outbox.reconcile(messageId, () => this.sent(messageId));
    if (confirmed.state !== 'confirmed') throw Error('Broadcast outcome uncertain; reconcile before retry');
    return confirmed;
  }
}
