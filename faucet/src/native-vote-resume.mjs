import { pubkeyToAddress } from '@cosmjs/amino';
import { Secp256k1, Secp256k1Signature, sha256 } from '@cosmjs/crypto';
import { fromBase64, toBase64, toHex } from '@cosmjs/encoding';
import { TxRaw, TxBody, AuthInfo, SignDoc } from 'cosmjs-types/cosmos/tx/v1beta1/tx';
import { PubKey } from 'cosmjs-types/cosmos/crypto/secp256k1/keys';
import { MsgVote } from 'cosmjs-types/cosmos/gov/v1/tx';
import { choices, VOTE } from '../../native-voting-core.mjs';

const keyFor = (sender) => 'neta-pending-tx-v1:juno-1:' + sender;
const same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);
const invalid = () =>
  Error('Saved vote could not be verified. Its transaction record is preserved.');

// Only the original, ordered, directly signed native vote is eligible. A hash
// lookup miss does not unlock the account or authorize a new signature.
async function inspect(client, id, sender, hash, storage) {
  if (!storage || (await client.getChainId()) !== 'juno-1') throw invalid();
  const key = keyFor(sender),
    raw = storage.getItem(key),
    row = JSON.parse(raw || 'null');
  if (
    row?.version !== 1 ||
    row.status !== 'pending' ||
    row.chain !== 'juno-1' ||
    row.sender !== sender ||
    row.hash !== hash ||
    !/^[A-F0-9]{64}$/.test(hash) ||
    typeof row.bytes !== 'string' ||
    row.bytes.length > 8192
  )
    throw invalid();
  const bytes = fromBase64(row.bytes);
  if (toBase64(bytes) !== row.bytes || toHex(sha256(bytes)).toUpperCase() !== hash) throw invalid();
  const tx = TxRaw.decode(bytes),
    body = TxBody.decode(tx.bodyBytes),
    auth = AuthInfo.decode(tx.authInfoBytes);
  if (
    !same(TxRaw.encode(tx).finish(), bytes) ||
    !same(TxBody.encode(body).finish(), tx.bodyBytes) ||
    !same(AuthInfo.encode(auth).finish(), tx.authInfoBytes) ||
    body.messages.length !== 1 ||
    body.messages[0].typeUrl !== VOTE ||
    body.memo ||
    body.timeoutHeight !== 0n ||
    body.unordered ||
    body.timeoutTimestamp ||
    body.extensionOptions.length ||
    body.nonCriticalExtensionOptions.length ||
    auth.signerInfos.length !== 1 ||
    tx.signatures.length !== 1 ||
    tx.signatures[0].length !== 64
  )
    throw invalid();
  const vote = MsgVote.decode(body.messages[0].value),
    signer = auth.signerInfos[0],
    fee = auth.fee;
  const option = Object.keys(choices).find((name) => choices[name] === vote.option);
  if (
    !same(MsgVote.encode(vote).finish(), body.messages[0].value) ||
    !option ||
    vote.metadata ||
    vote.proposalId.toString() !== String(id) ||
    vote.voter !== sender ||
    signer.sequence.toString() !== row.sequence ||
    signer.modeInfo?.single?.mode !== 1 ||
    signer.modeInfo.multi ||
    signer.publicKey?.typeUrl !== '/cosmos.crypto.secp256k1.PubKey' ||
    auth.tip ||
    !fee ||
    fee.payer ||
    fee.granter ||
    fee.gasLimit < 1n ||
    fee.gasLimit > 2000000n ||
    fee.amount.length !== 1 ||
    fee.amount[0].denom !== 'ujuno' ||
    !/^[1-9]\d{0,5}$/.test(fee.amount[0].amount) ||
    BigInt(fee.amount[0].amount) > 150000n
  )
    throw invalid();
  const publicKey = PubKey.decode(signer.publicKey.value).key;
  if (
    pubkeyToAddress({ type: 'tendermint/PubKeySecp256k1', value: toBase64(publicKey) }, 'juno') !==
    sender
  )
    throw invalid();
  const included = await client.getTx(hash);
  if (included)
    throw Error('This transaction was found by the RPC. Use Check vote status to confirm it.');
  const account = await client.getAccount(sender);
  if (
    !account ||
    account.address !== sender ||
    !Number.isSafeInteger(account.accountNumber) ||
    account.accountNumber < 0 ||
    !Number.isSafeInteger(account.sequence) ||
    account.sequence < 0 ||
    BigInt(account.sequence) !== signer.sequence
  )
    throw Error(
      'The account sequence changed or is unavailable. Check vote status; the saved transaction remains locked.'
    );
  const signDoc = SignDoc.fromPartial({
    bodyBytes: tx.bodyBytes,
    authInfoBytes: tx.authInfoBytes,
    chainId: 'juno-1',
    accountNumber: BigInt(account.accountNumber)
  });
  if (
    !(await Secp256k1.verifySignature(
      Secp256k1Signature.fromFixedLength(tx.signatures[0]),
      sha256(SignDoc.encode(signDoc).finish()),
      publicKey
    ))
  )
    throw invalid();
  if (storage.getItem(key) !== raw) throw Error('Saved transaction changed. Review again.');
  return {
    key,
    raw,
    bytes,
    review: {
      hash,
      proposalId: String(id),
      sender,
      option,
      sequence: row.sequence,
      fee: { gas: fee.gasLimit.toString(), amount: fee.amount }
    }
  };
}

export async function inspectSavedVote(client, id, sender, hash, options = {}) {
  return (await inspect(client, id, sender, hash, options.storage || globalThis.localStorage))
    .review;
}

// Called only after a separate review and explicit click. Never signs, changes
// fees, clears an unknown journal, or retries through another endpoint itself.
export async function resumeVote(
  client,
  reviewed,
  { assertWallet, beforeBroadcast, journalOptions = {} } = {}
) {
  if (typeof assertWallet !== 'function' || typeof beforeBroadcast !== 'function')
    throw Error('Saved vote review guards are required.');
  const storage = journalOptions.storage || globalThis.localStorage,
    locks = journalOptions.locks || globalThis.navigator?.locks;
  if (!storage || !locks?.request)
    throw Error('PERSISTENT TRANSACTION STORAGE AND DEVICE LOCK REQUIRED');
  return locks.request(
    keyFor(reviewed.sender),
    { mode: 'exclusive', ifAvailable: true },
    async (lock) => {
      if (!lock) throw Error('ANOTHER TAB IS SIGNING FOR THIS ACCOUNT');
      await assertWallet();
      const saved = await inspect(
        client,
        reviewed.proposalId,
        reviewed.sender,
        reviewed.hash,
        storage
      );
      if (JSON.stringify(saved.review) !== JSON.stringify(reviewed))
        throw Error('Saved vote review changed. Review again.');
      await beforeBroadcast();
      await assertWallet();
      if (storage.getItem(saved.key) !== saved.raw)
        throw Error('Saved transaction changed. Review again.');
      // Keep the existing journal until the UI has independent inclusion receipts.
      const result = await client.broadcastTx(saved.bytes);
      if (
        result?.transactionHash?.toUpperCase() !== reviewed.hash ||
        !Number.isSafeInteger(result.height) ||
        result.height < 1 ||
        !Number.isInteger(result.code) ||
        result.code < 0
      )
        throw Error('Saved vote outcome is still unconfirmed. Check vote status.');
      return result;
    }
  );
}
