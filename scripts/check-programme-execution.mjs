import { stakingMessages } from '../juno-programme-staking.mjs';
import {
  communityPoolMessages,
  DAI_DENOM,
  DAI_AMOUNT,
  DAI_RECIPIENT
} from '../juno-community-pool-proposal.mjs';
// Isolated execution regression: real Juno v31, original DAO DAO WASM/state,
// synthetic balances/delegations and an ephemeral local-only test signer.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, writeFileSync, openSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { toBech32 } from '../faucet/node_modules/@cosmjs/encoding/build/index.js';
import { MsgWithdrawDelegatorReward } from '../faucet/node_modules/cosmjs-types/cosmos/distribution/v1beta1/tx.js';
import { PROGRAMME } from '../juno-delegation-core.mjs';
import { GOVERNANCE, PROGRAMME_CODE_HASH, rewardMessages } from '../juno-governance-core.mjs';

const binary = resolve(process.argv[2] || ''),
  expectedBinary = '46fddb2c8c3fadcded48c63f72d88e9452cfd8a1da282892878a9f05d47f873c',
  sha = (bytes) => createHash('sha256').update(bytes).digest(),
  load = (path) => JSON.parse(readFileSync(path)),
  save = (path, value) => writeFileSync(path, JSON.stringify(value)),
  chain = 'cosmoot-claim-local',
  rpc = 'http://127.0.0.1:27657',
  rest = 'http://127.0.0.1:1417';
assert.equal(
  sha(readFileSync(binary)).toString('hex'),
  expectedBinary,
  'Pinned official Juno binary required'
);
const home = mkdtempSync(join(tmpdir(), 'cosmoot-programme-execution-'));
const cli = (...args) => {
  const result = spawnSync(binary, [...args, '--home', home], {
    encoding: 'utf8',
    timeout: 45000,
    maxBuffer: 8 * 1024 * 1024
  });
  if (result.error || result.status !== 0)
    throw Error(result.error?.message || result.stderr || result.stdout);
  return result.stdout;
};
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const get = async (url) => {
  const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw Error('Local query HTTP ' + response.status);
  return response.json();
};
async function until(task, timeout = 60000) {
  const deadline = Date.now() + timeout;
  let last;
  while (Date.now() < deadline) {
    try {
      const result = await task();
      if (result) return result;
    } catch (e) {
      last = e;
    }
    await pause(250);
  }
  throw Error('Local chain check timed out: ' + (last?.message || 'condition not met'));
}
let node;
try {
  cli('init', 'cosmoot-execution-test', '--chain-id', chain);
  // Never print or retain the generated test mnemonic in evidence or CI output.
  const voter = JSON.parse(
    cli('keys', 'add', 'local-voter', '--keyring-backend', 'test', '--output', 'json')
  ).address;
  const genesisPath = join(home, 'config/genesis.json'),
    g = load(genesisPath),
    a = g.app_state,
    original = load(new URL('../tests/fixtures/juno-proposal-381.json', import.meta.url)).proposal,
    state = load(new URL('../tests/fixtures/programme-state-4047.json', import.meta.url)),
    wasm = readFileSync(new URL('../tests/fixtures/programme-code-4047.wasm', import.meta.url)),
    validators = original.messages[0].msg.execute_admin_msgs.msgs.map(
      (m) => m.distribution.withdraw_delegator_reward.validator
    ),
    publicKey = load(join(home, 'config/priv_validator_key.json')).pub_key.value,
    consensus = toBech32('junovalcons', sha(Buffer.from(publicKey, 'base64')).subarray(0, 20)),
    moduleAddress = (name) => toBech32('juno', sha(name).subarray(0, 20)),
    coin = (amount) => [{ denom: 'ujuno', amount: String(amount) }],
    decimal = (amount) => coin(amount + '.000000000000000000');
  assert.equal(validators.length, 37);
  assert.equal(sha(wasm).toString('hex'), PROGRAMME_CODE_HASH);
  assert.equal(moduleAddress('gov'), GOVERNANCE);
  g.consensus.params.block.max_gas = '100000000';
  a.auth.accounts = [PROGRAMME, voter].map((address, i) => ({
    '@type': '/cosmos.auth.v1beta1.BaseAccount',
    address,
    pub_key: null,
    account_number: String(i),
    sequence: '0'
  }));
  const amounts = {
    [PROGRAMME]: 123450,
    [voter]: 1e12,
    [moduleAddress('distribution')]: 47000000,
    [moduleAddress('bonded_tokens_pool')]: 110000000,
    [moduleAddress('not_bonded_tokens_pool')]: 360000000
  };
  a.bank.balances = Object.entries(amounts).map(([address, n]) => ({ address, coins: coin(n) }));
  a.bank.supply = coin(Object.values(amounts).reduce((x, y) => x + y, 0));
  const s = a.staking,
    d = a.distribution;
  Object.assign(s.params, { bond_denom: 'ujuno', max_validators: 1 });
  Object.assign(s, {
    exported: true,
    last_total_power: '110',
    last_validator_powers: [{ address: validators[0], power: '110' }],
    validators: [],
    delegations: []
  });
  // Synthetic axlDAI funds exercise the native Community Pool handler, separately
  // from the DAO DAO claims. No bridge or swap is simulated as an on-chain effect.
  const daiCoin = { denom: DAI_DENOM, amount: DAI_AMOUNT };
  a.bank.balances.find((b) => b.address === moduleAddress('distribution')).coins.unshift(daiCoin);
  a.bank.supply.unshift(daiCoin);
  d.fee_pool.community_pool = [{ denom: DAI_DENOM, amount: DAI_AMOUNT + '.000000000000000000' }];
  a.slashing.signing_infos = [
    {
      address: consensus,
      validator_signing_info: {
        address: consensus,
        start_height: '0',
        index_offset: '0',
        jailed_until: '1970-01-01T00:00:00Z',
        tombstoned: false,
        missed_blocks_counter: '0'
      }
    }
  ];
  for (const [i, address] of validators.entries()) {
    const tokens = i === 0 ? 110000000 : 10000000;
    s.validators.push({
      operator_address: address,
      consensus_pubkey: {
        '@type': '/cosmos.crypto.ed25519.PubKey',
        key: i === 0 ? publicKey : sha(address).toString('base64')
      },
      jailed: false,
      status: i === 0 ? 'BOND_STATUS_BONDED' : 'BOND_STATUS_UNBONDED',
      tokens: String(tokens),
      delegator_shares: (i === 36 ? tokens * 0.99 : tokens) + '.000000000000000000',
      description: {
        moniker: `LOCAL TEST ${i}`,
        identity: '',
        website: '',
        security_contact: '',
        details: 'Synthetic local fixture'
      },
      unbonding_height: '0',
      unbonding_time: '1970-01-01T00:00:00Z',
      commission: {
        commission_rates: {
          rate: '0.000000000000000000',
          max_rate: '1.000000000000000000',
          max_change_rate: '1.000000000000000000'
        },
        update_time: '1970-01-01T00:00:00Z'
      },
      min_self_delegation: '1',
      unbonding_on_hold_ref_count: '0',
      unbonding_ids: []
    });
    const delegators = [[PROGRAMME, 10000000], ...(i === 0 ? [[voter, 100000000]] : [])];
    for (const [who, stake] of delegators) {
      s.delegations.push({
        delegator_address: who,
        validator_address: address,
        shares: (i === 36 ? stake * 0.99 : stake) + '.000000000000000000'
      });
      d.delegator_starting_infos.push({
        delegator_address: who,
        validator_address: address,
        starting_info: { previous_period: '0', stake: stake + '.000000000000000000', height: '0' }
      });
    }
    const rewards = i === 0 ? 11000000 : 1000000;
    d.outstanding_rewards.push({
      validator_address: address,
      outstanding_rewards: decimal(rewards)
    });
    d.validator_accumulated_commissions.push({
      validator_address: address,
      accumulated: { commission: [] }
    });
    d.validator_historical_rewards.push({
      validator_address: address,
      period: '0',
      rewards: { cumulative_reward_ratio: [], reference_count: delegators.length + 1 }
    });
    d.validator_current_rewards.push({
      validator_address: address,
      rewards: { rewards: decimal(rewards), period: '1' }
    });
  }
  a.mint.params.mint_denom = 'ujuno';
  a.mint.minter.inflation = '0.000000000000000000';
  a.feemarket.params.fee_denom = 'ujuno';
  a.feemarket.params.enabled = false;
  Object.assign(a.gov.params, {
    min_deposit: coin(10),
    expedited_min_deposit: coin(50),
    voting_period: '15s',
    expedited_voting_period: '5s'
  });
  a.wasm.codes = [
    {
      code_id: '4047',
      code_info: {
        code_hash: sha(wasm).toString('base64'),
        creator: voter,
        instantiate_config: { permission: 'Everybody', addresses: [] }
      },
      code_bytes: wasm.toString('base64'),
      pinned: true
    }
  ];
  a.wasm.contracts = [
    {
      contract_address: PROGRAMME,
      contract_info: { ...state.contract_info, created: { block_height: '0', tx_index: '0' } },
      contract_state: state.models,
      contract_code_history: [
        {
          operation: 'CONTRACT_CODE_HISTORY_OPERATION_TYPE_GENESIS',
          code_id: '4047',
          updated: { block_height: '0', tx_index: '0' },
          msg: {}
        }
      ]
    }
  ];
  a.wasm.sequences = ['lastCodeId', 'lastContractId'].map((key, i) => ({
    id_key: Buffer.from('\x04' + key).toString('base64'),
    value: i === 0 ? '4048' : '2'
  }));
  save(genesisPath, g);
  const configure = (file, changes) => {
    const path = join(home, 'config', file);
    let text = readFileSync(path, 'utf8');
    for (const [from, to] of changes) {
      assert.ok(
        from instanceof RegExp ? from.test(text) : text.includes(from),
        'Expected config: ' + from
      );
      text = text.replace(from, to);
    }
    writeFileSync(path, text);
  };
  configure('config.toml', [
    [/timeout_commit = "[^"]+"/, 'timeout_commit = "200ms"'],
    ['tcp://127.0.0.1:26657', 'tcp://127.0.0.1:27657'],
    ['tcp://0.0.0.0:26656', 'tcp://127.0.0.1:27656'],
    ['pex = true', 'pex = false']
  ]);
  configure('app.toml', [
    ['enable = false', 'enable = true'],
    ['tcp://localhost:1317', 'tcp://127.0.0.1:1417'],
    ['localhost:9090', '127.0.0.1:9190'],
    [/minimum-gas-prices = "[^"]*"/, 'minimum-gas-prices = "0ujuno"']
  ]);
  cli('genesis', 'validate-genesis');
  node = spawn(binary, ['start', '--home', home], {
    stdio: ['ignore', openSync(join(home, 'node.log'), 'w'), 'pipe']
  });
  node.stderr.on('data', () => {});
  await until(
    async () => (await get(rpc + '/status')).result.sync_info.latest_block_height !== '0'
  );
  const assertLocal = async () =>
    assert.equal((await get(rpc + '/status')).result.node_info.network, chain);
  const tx = async (...args) => {
    await assertLocal();
    const sent = JSON.parse(
      cli(
        'tx',
        ...args,
        '--from',
        'local-voter',
        '--keyring-backend',
        'test',
        '--chain-id',
        chain,
        '--node',
        rpc,
        '--gas',
        '10000000',
        '--fees',
        '10000000ujuno',
        '-y',
        '--output',
        'json'
      )
    );
    assert.equal(sent.code, 0, sent.raw_log);
    return until(
      async () => (await get(rest + '/cosmos/tx/v1beta1/txs/' + sent.txhash)).tx_response
    );
  };
  const balance = async () =>
    BigInt(
      (await get(rest + `/cosmos/bank/v1beta1/balances/${PROGRAMME}/by_denom?denom=ujuno`)).balance
        .amount
    );
  const positions = async () =>
    (await get(rest + `/cosmos/staking/v1beta1/delegations/${PROGRAMME}?pagination.limit=100`))
      .delegation_responses;
  const runProposal = async (label, messages) => {
    const file = join(home, label + '.json');
    save(file, {
      messages,
      title: 'LOCAL TEST ' + label,
      summary: 'Synthetic local execution regression',
      metadata: '',
      deposit: '10ujuno',
      expedited: false
    });
    const submission = await tx('gov', 'submit-proposal', file);
    assert.equal(submission.code, 0, submission.raw_log);
    const id = submission.events
      .find((e) => e.type === 'submit_proposal')
      .attributes.find((a) => a.key === 'proposal_id').value;
    const vote = await tx('gov', 'vote', id, 'yes');
    assert.equal(vote.code, 0, vote.raw_log);
    const proposal = await until(async () => {
      const p = (await get(rest + '/cosmos/gov/v1/proposals/' + id)).proposal;
      return (
        ['PROPOSAL_STATUS_FAILED', 'PROPOSAL_STATUS_PASSED', 'PROPOSAL_STATUS_REJECTED'].includes(
          p.status
        ) && p
      );
    });
    assert.ok(BigInt(proposal.final_tally_result.yes_count) > 0n);
    return proposal;
  };
  // RPC height can advance before the REST query store is ready after genesis.
  // Wait only for the initial read snapshot; later execution assertions stay strict.
  const initialState = await until(async () => ({
    balance: await balance(),
    positions: await positions()
  }));
  const before = initialState.balance,
    originalPositions = initialState.positions;
  const unauthorized = await tx(
    'wasm',
    'execute',
    PROGRAMME,
    JSON.stringify(rewardMessages(validators)[0].msg)
  );
  assert.notEqual(unauthorized.code, 0);
  assert.match(unauthorized.raw_log, /Unauthorized/i);
  assert.equal(await balance(), before);
  const old = await runProposal('original-distribution', original.messages);
  assert.equal(old.status, 'PROPOSAL_STATUS_FAILED');
  assert.match(old.failed_reason, /unknown variant `distribution`/);
  assert.equal(await balance(), before);
  const wrongMessages = rewardMessages(validators);
  wrongMessages[0].msg.execute_admin_msgs.msgs[0].stargate.value = Buffer.from(
    MsgWithdrawDelegatorReward.encode({
      delegatorAddress: GOVERNANCE,
      validatorAddress: validators[0]
    }).finish()
  ).toString('base64');
  const wrong = await runProposal('wrong-delegator', wrongMessages);
  assert.equal(wrong.status, 'PROPOSAL_STATUS_FAILED');
  assert.match(wrong.failed_reason, /signer|unauthorized/i);
  assert.equal(await balance(), before);
  const fixed = await runProposal('corrected-stargate', rewardMessages(validators));
  assert.equal(fixed.status, 'PROPOSAL_STATUS_PASSED', fixed.failed_reason);
  const after = await balance();
  assert.ok(after - before >= 37000000n, 'All 37 synthetic rewards must reach the programme');
  assert.deepEqual(await positions(), originalPositions, 'Claim must preserve every delegation');
  // Find the governance execution block; actual SDK withdrawal events prove
  // routing/signers/payouts, beyond merely decoding the contract response.
  const height = Number((await get(rpc + '/status')).result.sync_info.latest_block_height);
  let withdrawals = [];
  for (let h = height; h > Math.max(0, height - 100); h--) {
    const block = (await get(rpc + '/block_results?height=' + h)).result;
    const events = block.finalize_block_events || block.end_block_events || [];
    if (
      events.some(
        (e) =>
          e.type === 'active_proposal' &&
          e.attributes.some((a) => a.key === 'proposal_id' && a.value === fixed.id)
      )
    ) {
      withdrawals = events.filter((e) => e.type === 'withdraw_rewards');
      break;
    }
  }
  assert.equal(withdrawals.length, 37, 'Every validator must emit a real withdrawal event');
  assert.deepEqual(
    withdrawals.map((e) => e.attributes.find((a) => a.key === 'validator').value).sort(),
    [...validators].sort()
  );
  const daiBalance = async () =>
    BigInt(
      (
        await get(
          rest +
            `/cosmos/bank/v1beta1/balances/${DAI_RECIPIENT}/by_denom?denom=${encodeURIComponent(DAI_DENOM)}`
        )
      ).balance.amount
    );
  assert.equal(await daiBalance(), 0n);
  const transfer = await runProposal('community-pool-dai', communityPoolMessages());
  assert.equal(transfer.status, 'PROPOSAL_STATUS_PASSED', transfer.failed_reason);
  assert.equal(await daiBalance(), BigInt(DAI_AMOUNT));
  const remainingPool = (await get(rest + '/cosmos/distribution/v1beta1/community_pool')).pool;
  assert.ok(!remainingPool.some((c) => c.denom === DAI_DENOM && Number(c.amount) > 0));
  assert.deepEqual(await positions(), originalPositions);
  const overdraw = await runProposal('community-pool-insufficient', communityPoolMessages());
  assert.equal(overdraw.status, 'PROPOSAL_STATUS_FAILED');
  assert.match(overdraw.failed_reason, /community pool does not have sufficient coins/i);
  assert.equal(await daiBalance(), BigInt(DAI_AMOUNT));
  const funded = await tx('bank', 'send', voter, PROGRAMME, '100000000ujuno');
  assert.equal(funded.code, 0, funded.raw_log);
  const stakeBefore = await positions();
  const stake = await runProposal(
    'programme-staking',
    stakingMessages([
      {
        kind: 'redelegate',
        source: validators[0],
        destination: validators[1],
        amountRaw: '2000000'
      },
      {
        kind: 'redelegate',
        source: validators[36],
        destination: validators[35],
        amountRaw: '1234567'
      },
      { kind: 'delegate', destination: validators[2], amountRaw: '5000000' },
      { kind: 'undelegate', source: validators[3], amountRaw: '3000000' }
    ])
  );
  assert.equal(stake.status, 'PROPOSAL_STATUS_PASSED', stake.failed_reason);
  const stakeAfter = await positions();
  const held = (rows, address) =>
    BigInt(rows.find((p) => p.delegation.validator_address === address)?.balance.amount || '0');
  for (const [i, delta] of [
    [0, -2000000n],
    [1, 2000000n],
    [2, 5000000n],
    [3, -3000000n]
  ])
    assert.equal(held(stakeAfter, validators[i]) - held(stakeBefore, validators[i]), delta);
  const fractionalCredit = held(stakeAfter, validators[35]) - held(stakeBefore, validators[35]);
  assert.ok(
    fractionalCredit >= 1234566n && fractionalCredit <= 1234567n,
    'Non-unit share exchange rate rounding is bounded'
  );
  const unbondings = (
    await get(rest + `/cosmos/staking/v1beta1/delegators/${PROGRAMME}/unbonding_delegations`)
  ).unbonding_responses;
  assert.equal(
    unbondings.find((v) => v.validator_address === validators[3]).entries[0].balance,
    '3000000'
  );
  assert.ok((await balance()) >= 50000000n, 'Liquid reserve remains available');
  const atomicBefore = await balance();
  const blocked = await runProposal(
    'programme-transitive-atomic',
    stakingMessages([
      { kind: 'delegate', destination: validators[4], amountRaw: '1000000' },
      {
        kind: 'redelegate',
        source: validators[1],
        destination: validators[2],
        amountRaw: '1000000'
      }
    ])
  );
  assert.equal(blocked.status, 'PROPOSAL_STATUS_FAILED');
  assert.match(blocked.failed_reason, /redelegation to this validator already in progress/i);
  assert.deepEqual(
    await positions(),
    stakeAfter,
    'Failed staking proposal rolls back earlier movements'
  );
  assert.equal(
    await balance(),
    atomicBefore,
    'Failed proposal leaves programme liquid funds intact'
  );
  const report = {
    chain,
    juno: 'v31.0.0',
    binarySha256: expectedBinary,
    programmeCodeSha256: PROGRAMME_CODE_HASH,
    unauthorized: 'rejected',
    wrongDelegator: { status: wrong.status, failedReason: wrong.failed_reason },
    original: { status: old.status, failedReason: old.failed_reason },
    corrected: {
      status: fixed.status,
      withdrawals: withdrawals.length,
      programmeReceivedUjuno: String(after - before),
      delegationsUnchanged: true
    },
    staking: {
      status: stake.status,
      movements: 4,
      fractionalCreditUjuno: String(fractionalCredit),
      unbondingUjuno: '3000000',
      transitiveFailure: blocked.status,
      atomicRollback: true
    },
    communityPool: {
      status: transfer.status,
      recipient: DAI_RECIPIENT,
      amount: DAI_AMOUNT,
      denom: DAI_DENOM,
      poolDebited: true,
      insufficientFunds: overdraw.status,
      delegationsUnchanged: true
    },
    scope:
      'Original deployed DAO core and Juno runtime; synthetic local accounts, balances and delegations. No mainnet transaction.'
  };
  if (process.argv[3]) save(resolve(process.argv[3]), report);
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  if (node) console.error(readFileSync(join(home, 'node.log'), 'utf8').slice(-6000));
  throw error;
} finally {
  if (node && node.exitCode === null) {
    node.kill('SIGTERM');
    await once(node, 'exit');
  }
  rmSync(home, { recursive: true, force: true });
}
