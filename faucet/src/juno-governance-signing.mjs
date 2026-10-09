import { sha256 } from '@cosmjs/crypto';
import { toHex } from '@cosmjs/encoding';
import { Registry } from '@cosmjs/proto-signing';
import { SigningStargateClient, defaultRegistryTypes, GasPrice } from '@cosmjs/stargate';
import { MsgExecuteContract } from 'cosmjs-types/cosmwasm/wasm/v1/tx';
import { MsgSubmitProposal, MsgDeposit } from 'cosmjs-types/cosmos/gov/v1/tx';
import { TxBody, AuthInfo } from 'cosmjs-types/cosmos/tx/v1beta1/tx';
import { DEPOSIT } from '../../juno-community-governance.mjs';
import { EXECUTE, SUBMIT, claimValidators } from '../../juno-governance-core.mjs';
import { journalBroadcast } from './broadcast-journal.mjs';
export { fixedFee } from './wynd-swap-fee.mjs';

export function message(content, sender, deposit) {
  if (content.messages.length) claimValidators(content.messages);
  if (!/^[1-9]\d*$/.test(deposit)) throw Error('Invalid proposal deposit.');
  return {
    typeUrl: SUBMIT,
    value: MsgSubmitProposal.fromPartial({
      title: content.title,
      summary: content.summary,
      metadata: content.metadata || '',
      expedited: false,
      proposer: sender,
      initialDeposit: [{ denom: 'ujuno', amount: deposit }],
      messages: content.messages.map((m) => ({
        typeUrl: EXECUTE,
        value: MsgExecuteContract.encode(
          MsgExecuteContract.fromPartial({
            sender: m.sender,
            contract: m.contract,
            funds: [],
            msg: new TextEncoder().encode(JSON.stringify(m.msg))
          })
        ).finish()
      }))
    })
  };
}
export async function connect(endpoints, signer) {
  for (const endpoint of endpoints) {
    let client,
      timer,
      expired = false;
    try {
      const attempt = SigningStargateClient.connectWithSigner(endpoint, signer, {
        registry: new Registry([
          ...defaultRegistryTypes,
          [SUBMIT, MsgSubmitProposal],
          [DEPOSIT, MsgDeposit],
          [EXECUTE, MsgExecuteContract]
        ]),
        gasPrice: GasPrice.fromString('0.075ujuno')
      });
      attempt.then(
        (c) => {
          if (expired) c.disconnect();
        },
        () => {}
      );
      client = await Promise.race([
        attempt,
        new Promise((_, reject) => {
          timer = setTimeout(() => {
            expired = true;
            reject(Error('Juno RPC timed out.'));
          }, 12000);
        })
      ]);
      if ((await client.getChainId()) !== 'juno-1') throw Error('Wrong signing network.');
      return client;
    } catch {
      client?.disconnect();
    } finally {
      clearTimeout(timer);
    }
  }
  throw Error('No Juno mainnet signing connection is available.');
}
export const simulate = (client, content, sender, deposit) =>
  client.simulate(sender, [message(content, sender, deposit)], '');
const same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);
async function signReviewed(
  client,
  msg,
  encoder,
  sender,
  fee,
  { assertWallet, beforeSign, beforeBroadcast, journalOptions } = {}
) {
  if (
    typeof assertWallet !== 'function' ||
    typeof beforeSign !== 'function' ||
    typeof beforeBroadcast !== 'function'
  )
    throw Error('Proposal review guards are required.');
  const expected = msg,
    bytes = encoder.encode(expected.value).finish();
  const proxy = {
    getChainId: async () => {
      const chain = await client.getChainId();
      if (chain !== 'juno-1') throw Error('Wrong signing network.');
      return chain;
    },
    getTx: (hash) => client.getTx(hash),
    sign: async (...args) => {
      await beforeSign();
      await assertWallet();
      const signed = await client.sign(...args),
        body = TxBody.decode(signed.bodyBytes),
        auth = AuthInfo.decode(signed.authInfoBytes);
      if (
        body.messages.length !== 1 ||
        body.messages[0].typeUrl !== msg.typeUrl ||
        !same(body.messages[0].value, bytes) ||
        body.memo !== '' ||
        body.timeoutHeight !== 0n ||
        body.extensionOptions.length ||
        body.nonCriticalExtensionOptions.length
      )
        throw Error('Wallet changed the reviewed proposal. Nothing was broadcast.');
      if (
        auth.signerInfos.length !== 1 ||
        !auth.fee ||
        auth.fee.gasLimit.toString() !== fee.gas ||
        auth.fee.payer ||
        auth.fee.granter ||
        auth.tip ||
        auth.fee.amount.length !== fee.amount.length ||
        auth.fee.amount.some(
          (c, i) => c.denom !== fee.amount[i].denom || c.amount !== fee.amount[i].amount
        )
      )
        throw Error('Wallet changed the reviewed fee. Nothing was broadcast.');
      await assertWallet();
      await beforeSign();
      return signed;
    },
    broadcastTx: async (bytes) => {
      await beforeBroadcast(toHex(sha256(bytes)).toUpperCase());
      return client.broadcastTx(bytes);
    }
  };
  return journalBroadcast(proxy, sender, [expected], fee, '', journalOptions);
}

export function submit(client, content, sender, deposit, fee, options) {
  return signReviewed(
    client,
    message(content, sender, deposit),
    MsgSubmitProposal,
    sender,
    fee,
    options
  );
}
export function depositMessage(proposalId, sender, amount) {
  if (!/^[1-9]\d*$/.test(String(proposalId)) || !/^[1-9]\d*$/.test(amount))
    throw Error('Invalid proposal contribution.');
  return {
    typeUrl: DEPOSIT,
    value: MsgDeposit.fromPartial({
      proposalId: BigInt(proposalId),
      depositor: sender,
      amount: [{ denom: 'ujuno', amount }]
    })
  };
}
export const simulateDeposit = (client, id, sender, amount) =>
  client.simulate(sender, [depositMessage(id, sender, amount)], '');
export const contribute = (client, id, sender, amount, fee, options) =>
  signReviewed(client, depositMessage(id, sender, amount), MsgDeposit, sender, fee, options);
