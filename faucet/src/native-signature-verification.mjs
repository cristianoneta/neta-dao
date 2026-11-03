import { pubkeyToAddress } from '@cosmjs/amino';
import { Secp256k1, Secp256k1Signature, sha256 } from '@cosmjs/crypto';
import { toBase64 } from '@cosmjs/encoding';
import { SignDoc } from 'cosmjs-types/cosmos/tx/v1beta1/tx';
import { PubKey } from 'cosmjs-types/cosmos/crypto/secp256k1/keys';

const same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

// Native gov v1 already requires direct signing in every caller. Other signing
// routes (including legacy Amino) do not use this verifier.
export async function verifyNativeSignature(tx, auth, sender, account) {
  try {
    const signer = auth.signerInfos[0];
    if (
      auth.signerInfos.length !== 1 ||
      tx.signatures.length !== 1 ||
      tx.signatures[0].length !== 64 ||
      signer.sequence !== BigInt(account.sequence) ||
      signer.modeInfo?.single?.mode !== 1 ||
      signer.modeInfo.multi ||
      signer.publicKey?.typeUrl !== '/cosmos.crypto.secp256k1.PubKey'
    )
      throw Error();
    const decoded = PubKey.decode(signer.publicKey.value),
      publicKey = decoded.key;
    if (
      !same(PubKey.encode(decoded).finish(), signer.publicKey.value) ||
      publicKey.length !== 33 ||
      ![2, 3].includes(publicKey[0]) ||
      pubkeyToAddress(
        { type: 'tendermint/PubKeySecp256k1', value: toBase64(publicKey) },
        'juno'
      ) !== sender
    )
      throw Error();
    const doc = SignDoc.fromPartial({
      bodyBytes: tx.bodyBytes,
      authInfoBytes: tx.authInfoBytes,
      chainId: account.chainId,
      accountNumber: BigInt(account.accountNumber)
    });
    if (
      !(await Secp256k1.verifySignature(
        Secp256k1Signature.fromFixedLength(tx.signatures[0]),
        sha256(SignDoc.encode(doc).finish()),
        publicKey
      ))
    )
      throw Error();
  } catch {
    throw Error(
      'Wallet signature does not match the reviewed Juno account. Nothing was broadcast.'
    );
  }
}
