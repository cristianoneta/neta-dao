import { isStaking, assertStaking } from '../../juno-programme-staking.mjs';
import { MsgCommunityPoolSpend } from 'cosmjs-types/cosmos/distribution/v1beta1/tx';
import {
  COMMUNITY_POOL_SPEND,
  isCommunityPoolSpend,
  assertCommunityPoolSpend
} from '../../juno-community-pool-proposal.mjs';
import { sha256 } from '@cosmjs/crypto';
import { toHex } from '@cosmjs/encoding';
import { Registry } from '@cosmjs/proto-signing';
import {
  SigningStargateClient,
  StargateClient,
  defaultRegistryTypes,
  GasPrice
} from '@cosmjs/stargate';
import { MsgExecuteContract } from 'cosmjs-types/cosmwasm/wasm/v1/tx';
import { MsgSubmitProposal, MsgDeposit, MsgVote } from 'cosmjs-types/cosmos/gov/v1/tx';
import { TxBody, AuthInfo, TxRaw } from 'cosmjs-types/cosmos/tx/v1beta1/tx';
import { VOTE, choices } from '../../native-voting-core.mjs';
import { validateJunoAddress } from '../../names-profile-core.mjs';
import { DEPOSIT } from '../../juno-community-governance.mjs';
import {
  EXECUTE,
  SUBMIT,
  claimValidators,
  assertProgrammeExecutionAvailable
} from '../../juno-governance-core.mjs';
import { journalBroadcast } from './broadcast-journal.mjs';
import { verifyNativeSignature } from './native-signature-verification.mjs';
export { fixedFee } from './wynd-swap-fee.mjs';
export { inspectSavedVote, resumeVote, replaceVoteGas } from './native-vote-resume.mjs';
export { voteFee } from './native-vote-fee.mjs';
export { proposalFee } from './native-proposal-fee.mjs';

// Conservative application budget, not a claimed chain parameter. The actual
// transaction is simulated separately and checked again after wallet encoding.
export const PROPOSAL_TX_BUDGET = 262144;
const SIGNATURE_RESERVE = 2048;
function encodedProposalSize(msg) {
  const value = MsgSubmitProposal.encode(msg.value).finish();
  const bodyBytes = TxBody.encode(
    TxBody.fromPartial({ messages: [{ typeUrl: SUBMIT, value }] })
  ).finish().length;
  return {
    messageBytes: value.length,
    bodyBytes,
    transactionBudgetBytes: bodyBytes + SIGNATURE_RESERVE,
    limit: PROPOSAL_TX_BUDGET
  };
}
export function proposalSize(content, sender, deposit) {
  return encodedProposalSize(message(content, sender, deposit));
}
export function message(content, sender, deposit) {
  assertProgrammeExecutionAvailable(content.messages);
  const community = isCommunityPoolSpend(content.messages);
  if (community) assertCommunityPoolSpend(content.messages);
  else if (isStaking(content.messages)) assertStaking(content.messages);
  else if (content.messages.length) claimValidators(content.messages);
  if (!/^[1-9]\d*$/.test(deposit)) throw Error('Invalid proposal deposit.');
  const msg = {
    typeUrl: SUBMIT,
    value: MsgSubmitProposal.fromPartial({
      title: content.title,
      summary: content.summary,
      metadata: content.metadata || '',
      expedited: false,
      proposer: sender,
      initialDeposit: [{ denom: 'ujuno', amount: deposit }],
      messages: content.messages.map((m) =>
        community
          ? {
              typeUrl: COMMUNITY_POOL_SPEND,
              value: MsgCommunityPoolSpend.encode(
                MsgCommunityPoolSpend.fromPartial({
                  authority: m.authority,
                  recipient: m.recipient,
                  amount: m.amount
                })
              ).finish()
            }
          : {
              typeUrl: EXECUTE,
              value: MsgExecuteContract.encode(
                MsgExecuteContract.fromPartial({
                  sender: m.sender,
                  contract: m.contract,
                  funds: [],
                  msg: new TextEncoder().encode(JSON.stringify(m.msg))
                })
              ).finish()
            }
      )
    })
  };
  const size = encodedProposalSize(msg);
  if (size.transactionBudgetBytes > size.limit)
    throw Error(
      `Proposal needs ${size.transactionBudgetBytes} bytes including signing reserve, above the ${size.limit}-byte application budget. Review separate execution proposals; no actions were omitted or automatically split.`
    );
  return msg;
}
export async function connect(endpoints, signer) {
  return connectUsing(endpoints, (endpoint) =>
    SigningStargateClient.connectWithSigner(endpoint, signer, {
      registry: new Registry([
        ...defaultRegistryTypes,
        [SUBMIT, MsgSubmitProposal],
        [DEPOSIT, MsgDeposit],
        [VOTE, MsgVote],
        [EXECUTE, MsgExecuteContract]
      ]),
      gasPrice: GasPrice.fromString('0.075ujuno')
    })
  );
}
export const connectForVoteResume = (endpoints) =>
  connectUsing(endpoints, (endpoint) => StargateClient.connect(endpoint));
async function connectUsing(endpoints, create) {
  for (const endpoint of endpoints) {
    let client,
      timer,
      expired = false;
    try {
      const attempt = create(endpoint);
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
async function signingAccount(client, sender) {
  const [chainId, account] = await Promise.all([client.getChainId(), client.getSequence(sender)]);
  if (
    chainId !== 'juno-1' ||
    !account ||
    !Number.isSafeInteger(account.accountNumber) ||
    account.accountNumber < 0 ||
    !Number.isSafeInteger(account.sequence) ||
    account.sequence < 0
  )
    throw Error('Current Juno signing account is unavailable. Nothing was broadcast.');
  return { chainId, accountNumber: account.accountNumber, sequence: account.sequence };
}
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
  // Neither the wallet nor a caller retaining its input objects may change the
  // expected values while the signature request is open.
  const typeUrl = msg.typeUrl,
    bytes = encoder.encode(msg.value).finish(),
    reviewedFee = structuredClone(fee);
  const proxy = {
    getChainId: async () => {
      const chain = await client.getChainId();
      if (chain !== 'juno-1') throw Error('Wrong signing network.');
      return chain;
    },
    getTx: (hash) => client.getTx(hash),
    sign: async (address, messages, signingFee, memo) => {
      await beforeSign();
      await assertWallet();
      const account = await signingAccount(client, sender);
      const signed = structuredClone(
          await client.sign(address, messages, signingFee, memo, { ...account })
        ),
        body = TxBody.decode(signed.bodyBytes),
        auth = AuthInfo.decode(signed.authInfoBytes);
      if (
        !same(TxBody.encode(body).finish(), signed.bodyBytes) ||
        body.messages.length !== 1 ||
        body.messages[0].typeUrl !== typeUrl ||
        !same(body.messages[0].value, bytes) ||
        body.memo !== '' ||
        body.timeoutHeight !== 0n ||
        body.unordered ||
        body.timeoutTimestamp ||
        body.extensionOptions.length ||
        body.nonCriticalExtensionOptions.length
      )
        throw Error('Wallet changed the reviewed proposal. Nothing was broadcast.');
      if (
        !same(AuthInfo.encode(auth).finish(), signed.authInfoBytes) ||
        auth.signerInfos.length !== 1 ||
        !auth.fee ||
        auth.fee.gasLimit.toString() !== reviewedFee.gas ||
        auth.fee.payer ||
        auth.fee.granter ||
        auth.tip ||
        auth.fee.amount.length !== reviewedFee.amount.length ||
        auth.fee.amount.some(
          (c, i) =>
            c.denom !== reviewedFee.amount[i].denom || c.amount !== reviewedFee.amount[i].amount
        )
      )
        throw Error('Wallet changed the reviewed fee. Nothing was broadcast.');
      if (TxRaw.encode(signed).finish().length > PROPOSAL_TX_BUDGET)
        throw Error(
          'Signed transaction exceeds the application byte budget. Nothing was broadcast.'
        );
      await verifyNativeSignature(signed, auth, sender, account);
      const current = await signingAccount(client, sender);
      if (current.accountNumber !== account.accountNumber || current.sequence !== account.sequence)
        throw Error('Juno account changed while signing. Review again. Nothing was broadcast.');
      await assertWallet();
      await beforeSign();
      return signed;
    },
    broadcastTx: async (bytes) => {
      await beforeBroadcast(toHex(sha256(bytes)).toUpperCase());
      return client.broadcastTx(bytes);
    }
  };
  return journalBroadcast(
    proxy,
    sender,
    [{ typeUrl, value: encoder.decode(bytes) }],
    structuredClone(reviewedFee),
    '',
    journalOptions
  );
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

export function voteMessage(id, sender, option) {
  validateJunoAddress(sender, true);
  if (
    !/^[1-9]\d{0,19}$/.test(String(id)) ||
    BigInt(id) > (1n << 64n) - 1n ||
    !Object.hasOwn(choices, option)
  )
    throw Error('Invalid vote.');
  return {
    typeUrl: VOTE,
    value: MsgVote.fromPartial({
      proposalId: BigInt(id),
      voter: sender,
      option: choices[option],
      metadata: ''
    })
  };
}
export const simulateVote = (client, id, sender, option) =>
  client.simulate(sender, [voteMessage(id, sender, option)], '');
export const vote = (client, id, sender, option, fee, options) =>
  signReviewed(client, voteMessage(id, sender, option), MsgVote, sender, fee, options);
