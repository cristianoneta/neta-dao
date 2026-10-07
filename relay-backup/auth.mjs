import { pubkeyToAddress, serializeSignDoc } from '@cosmjs/amino';
import { Secp256k1, Secp256k1Signature, sha256 } from '@cosmjs/crypto';
import { fromBech32, fromBase64, toBase64, toUtf8 } from '@cosmjs/encoding';
export function validWallet(wallet) {
  try {
    const d = fromBech32(wallet);
    return d.prefix === 'juno' && d.data.length === 20 && wallet === wallet.toLowerCase();
  } catch {
    return false;
  }
}
export async function verifyOwnership(wallet, message, signature) {
  try {
    if (
      !validWallet(wallet) ||
      signature?.pub_key?.type !== 'tendermint/PubKeySecp256k1' ||
      pubkeyToAddress(signature.pub_key, 'juno') !== wallet
    )
      return false;
    const doc = {
      chain_id: '',
      account_number: '0',
      sequence: '0',
      fee: { gas: '0', amount: [] },
      msgs: [
        { type: 'sign/MsgSignData', value: { signer: wallet, data: toBase64(toUtf8(message)) } }
      ],
      memo: ''
    };
    return await Secp256k1.verifySignature(
      Secp256k1Signature.fromFixedLength(fromBase64(signature.signature)),
      sha256(serializeSignDoc(doc)),
      fromBase64(signature.pub_key.value)
    );
  } catch {
    return false;
  }
}
