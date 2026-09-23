// Test-only application envelope. Proteus encrypts these bytes, so public
// routing fields must be compared again after decrypting. A mismatch is fatal
// for the local session; never display the decrypted text after it occurs.
const ADDRESS = /^juno1[0-9a-z]{30,100}$/;
const ID = /^[0-9a-f]{64}$/;
const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true });
const CONTRACT = 'juno13uft9dl34x9wdzcxnm80q8m8sh5cw04lkskzknm9vc0wduxchdxsrnr4pa';
const fields = ['chain', 'contract', 'sender', 'senderGeneration', 'senderFingerprint',
  'recipient', 'recipientGeneration', 'recipientFingerprint', 'messageId'];

function check(meta) {
  if (meta?.chain !== 'uni-7' || meta.contract !== CONTRACT ||
      !ADDRESS.test(meta.sender) || !ADDRESS.test(meta.recipient) || !ID.test(meta.messageId) ||
      !ID.test(meta.senderFingerprint) || !ID.test(meta.recipientFingerprint) ||
      !Number.isSafeInteger(meta.senderGeneration) || meta.senderGeneration < 1 ||
      !Number.isSafeInteger(meta.recipientGeneration) || meta.recipientGeneration < 1) {
    throw Error('Invalid encrypted message identity');
  }
}

export function sealEnvelope(meta, message) {
  check(meta);
  if (typeof message !== 'string' || !message || encoder.encode(message).length > 1800) throw Error('Invalid message text');
  return encoder.encode(JSON.stringify({ version: 1, ...Object.fromEntries(fields.map(key => [key, meta[key]])), message }));
}

export function openEnvelope(bytes, expected, remoteFingerprint) {
  check(expected);
  if (!(bytes instanceof Uint8Array) || bytes.length > 3072 || bytes.length < 1 ||
      remoteFingerprint !== expected.senderFingerprint) throw Error('Sender identity changed');
  let envelope;
  try { envelope = JSON.parse(decoder.decode(bytes)); }
  catch { throw Error('Invalid encrypted message'); }
  if (envelope === null || typeof envelope !== 'object' || Array.isArray(envelope) ||
      envelope.version !== 1 || Object.keys(envelope).length !== fields.length + 2 ||
      fields.some(key => envelope[key] !== expected[key]) ||
      typeof envelope.message !== 'string' || !envelope.message ||
      encoder.encode(envelope.message).length > 1800) throw Error('Encrypted message does not match on-chain identity');
  return envelope.message;
}
