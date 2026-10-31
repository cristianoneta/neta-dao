(async () => {
  // Capture the incoming handoff before any asynchronous initialization.
  const plannerParams = new URLSearchParams(location.search);
  if (plannerParams.has('plannerDraft') || plannerParams.has('proposalTemplate')) {
    document.querySelector('#planner-proposal-context').hidden = false;
    document.querySelector('#planner-proposal-context-text').textContent =
      'Loading your Juno governance draft…';
    document.querySelector('#primary-action').disabled = true;
    for (const id of ['proposal-title', 'proposal-summary', 'proposal-body', 'proposal-actions'])
      document.getElementById(id).disabled = true;
  }
  const {
    COMMUNITY_POOL_TEMPLATE,
    COMMUNITY_POOL_KIND,
    communityPoolProposal,
    isCommunityPoolSpend,
    assertCommunityPoolSpend
  } = await import('./juno-community-pool-proposal.mjs');
  const { normalizedComment } = await import('./src/governance/comments.mjs');
  const { unitsFor, resolveSelection, selectionParams } = await import(
    './dao-hierarchy.mjs?v=20261006-structure-1'
  );
  const ORGANIZATIONS = window.NetaDaoOrganizations;
  const { reviewActionState, nativeSubmissionVisible } = await import(
    './src/governance/review-state.mjs'
  );
  const { loadSocialsSigning } = await import('./browser-signing.mjs');
  const { governanceQueries, deadline } = await import('./src/governance/queries.mjs');
  const { reviewSession } = await import('./src/governance/review-session.mjs');
  const { proposalEditor } = await import('./src/governance/proposal-editor.mjs');
  const { publishedReview, indexingUnavailable, reviewEventId } = await import(
    './review-publication.mjs'
  );
  const {
    normalizeNativeProposal,
    linkedNativeId,
    readNativeVoting,
    formatVoteAmount,
    nativeExecutionFailure
  } = await import('./native-governance-display.mjs');
  const { displayJuno, assertProgrammeExecutionAvailable } = await import(
    './juno-governance-core.mjs'
  );
  const { isStaking } = await import('./juno-programme-staking.mjs');
  const { readExecutionReview } = await import('./juno-rebalance-execution.mjs');
  const { verifyRebalanceValues } = await import('./juno-rebalance-chain.mjs');
  const { readProposalReview, verifyRuleReview } = await import('./juno-delegation-review.mjs');
  const { usesRuleReference, RULE_REFERENCE_MARKER, assertPinnedReview } = await import(
    './juno-rule-reference.mjs'
  );
  const { readReferencedRuleProposal } = await import('./juno-rule-reference-read.mjs');
  const { renderRuleReview } = await import('./juno-rule-review-view.mjs');
  let frozenViewEpoch = 0;
  async function renderFrozenValues(v, editing = false) {
    const format = document.querySelector('#rule-proposal-format');
    const convert = document.querySelector('#rule-proposal-convert');
    if (format) format.hidden = true;
    if (convert) convert.hidden = true;
    const transfer = document.querySelector('#community-pool-transfer');
    transfer.hidden = true;
    try {
      const messages = JSON.parse(v.actions_json || '[]');
      if (isCommunityPoolSpend(messages)) {
        transfer.hidden = false;
        assertCommunityPoolSpend(messages);
        transfer.textContent =
          'Transfer after approval: 460.9 axlDAI from the Juno Community Pool to Dimi · ' +
          messages[0].recipient +
          '. Conversion to USDC and return to the Community Pool are performed separately by Dimi.';
      }
    } catch (error) {
      transfer.textContent = error.message;
    }
    const epoch = ++frozenViewEpoch,
      host = document.querySelector('#proposal-rule-review');
    host.replaceChildren();
    host.hidden = true;
    let executionMessages = [];
    try {
      executionMessages = JSON.parse(v.actions_json || '[]');
    } catch {
      /* Invalid editor JSON remains editable. */
    }
    if (isStaking(executionMessages)) {
      host.hidden = false;
      host.textContent = 'Verifying rebalance movements…';
      try {
        const execution = await readExecutionReview(v);
        const allocation =
          execution.value.calculation.rule.schema >= 7
            ? await verifyRuleReview(execution.value.calculation)
            : null;
        if (epoch !== frozenViewEpoch) return;
        const totals = execution.value.plan.totals;
        host.textContent = `Approved rule proposal #${execution.value.calculation.parent.proposalId} · ${execution.value.plan.moves.length} movements. Delegate ${displayJuno(totals.delegate)} JUNO · Redelegate ${displayJuno(totals.redelegate)} JUNO · Begin unbonding ${displayJuno(totals.undelegate)} JUNO. Targets use the recorded observations; actual execution depends on chain state after voting.`;
        if (allocation) {
          const details = document.createElement('section');
          renderRuleReview(details, allocation, { scope: 'execution', rules: false });
          host.append(details);
        }
      } catch (error) {
        if (epoch === frozenViewEpoch)
          host.textContent = 'Rebalance verification failed: ' + error.message;
      }
      return;
    }
    const reference = v.body?.includes(RULE_REFERENCE_MARKER);
    if (
      !reference &&
      !v.body?.includes('## Frozen allocation review') &&
      !/"schema"\s*:\s*3/.test(v.body || '')
    )
      return;
    host.hidden = false;
    host.textContent = 'Verifying the frozen rule comparison…';
    try {
      const frozen = reference
        ? await readReferencedRuleProposal(state.selected?.proposal?.raw)
        : await readProposalReview(v);
      if (epoch !== frozenViewEpoch) return;
      host.hidden = !frozen;
      if (frozen) {
        if (reference) document.querySelector('#proposal-summary').value = frozen.proposalSummary;
        renderRuleReview(host, frozen, {
          scope: !editing && state.selected ? 'published' : 'draft'
        });
        if (format && usesRuleReference(v)) {
          format.hidden = false;
          document.querySelector('#rule-proposal-format-text').textContent =
            `The native proposal uses your summary and a link to this exact on-chain review. Rules and calculation evidence stay in the review. Review body: ${[...v.body.trim()].length.toLocaleString('en-US')} / 10,000 characters; summary: ${[...(v.summary || '').trim()].length} / 300 characters. The exact native text is shown after finalization, before submission.`;
          if (!editing) setDetails(false);
        }
        if (
          convert &&
          !usesRuleReference(v) &&
          !reference &&
          !state.selected &&
          isNativeReview() &&
          CHAIN_ID === 'juno-1'
        )
          convert.hidden = false;
      }
    } catch (error) {
      if (epoch !== frozenViewEpoch) return;
      host.textContent = 'Rule comparison unavailable: ' + error.message;
    }
  }
  async function verifyFrozenAction(values) {
    const messages = JSON.parse(values.actions_json);
    assertProgrammeExecutionAvailable(messages);
    const context = reviewContext();
    if (isCommunityPoolSpend(messages)) {
      const { readCommunityPool } = await import('./juno-community-governance.mjs');
      await readCommunityPool(MAINNET_RESTS, messages);
    } else if (isStaking(messages)) {
      await verifyRebalanceValues(values);
    } else if (messages.length) {
      const { readClaimContext, assertClaimContext } = await import('./claim-numbering.mjs');
      assertClaimContext(
        { title: values.title, summary: values.summary + '\n\n' + values.body, messages },
        await readClaimContext(MAINNET_RESTS)
      );
    }
    const frozen = await readProposalReview(values);
    if (usesRuleReference(values) && (!frozen || messages.length || CHAIN_ID !== 'juno-1'))
      throw Error('A referenced rule proposal requires its complete verified Juno rule review.');
    if (frozen) {
      const { currentApprovedRules } = await import('./juno-approved-rules.mjs');
      const { parentMatches } = await import('./juno-delegation-review.mjs');
      const approved = await currentApprovedRules();
      if (!parentMatches(frozen.value.parent, approved.current))
        throw Error(
          'The approved rules changed after this comparison was prepared. Return to the planner and prepare a new comparison.'
        );
    }
    context.assert();
  }

  let votingEpoch = 0,
    votingRequest = null;
  let authorRenderer;
  async function renderAuthorName(element, owner, current) {
    element.textContent = owner;
    const { authorNameRenderer } = await import('./proposal-identity.mjs?v=20261011-1');
    if (!current()) return;
    authorRenderer ||= authorNameRenderer();
    await authorRenderer(element, owner, current, reviewLabel());
  }
  const { selectedReviewNetwork } = await import('./juno-review-network.mjs');
  const { verifyMainnetReview } = await import('./juno-review-mainnet-read.mjs');
  const { executeMainnetReview, loadReviewSigning } = await import(
    './juno-review-transactions.mjs'
  );
  let CHAIN_ID = 'uni-7';
  let RPCS = ['https://juno.test.rpc.nodeshub.online', 'https://juno.rpc.t.stavr.tech'],
    RESTS = ['https://juno.test.api.nodeshub.online', 'https://juno.api.t.stavr.tech'];
  const MAINNET_RESTS = [
      'https://juno-api.polkachu.com',
      'https://rest.lavenderfive.com/juno',
      'https://juno.api.m.stavr.tech'
    ],
    MAINNET_RPCS = [
      'https://juno.rpc.m.stavr.tech',
      'https://juno-rpc.kleomedes.network',
      'https://juno-rpc.polkachu.com',
      'https://rpc-juno.whispernode.com'
    ],
    GOVERNANCE_CHAINS = [{ id: 'juno', name: 'Juno' }],
    DAOS = window.NetaDaoDirectory;
  const DAO_STORAGE_KEY = 'neta-governance-selected-dao',
    JUNO_REVIEW_CONTRACT_KEY = 'neta-governance-juno-review-contract',
    TEST_ACCESS_CONTRACT = 'juno10739807rjqkf4kmtvpu5ll5e67dkch82xzgph83cmn5h8n0fxmnszasg86',
    TEST_ADMIN = 'juno1z3xcalwan92yqxu9d406tlft9yy94jy8s5et57';
  function storedScope() {
    try {
      return JSON.parse(localStorage.getItem('neta-governance-scope') || 'null');
    } catch {
      return null;
    }
  }
  const initialScope = resolveSelection(plannerParams, ORGANIZATIONS, DAOS, storedScope());
  const initialDao = initialScope.dao;
  const nativeReviewDao = (dao) => dao.mode === 'native-gov' || dao.id === 'juno-delegation';
  let reviewNetwork = selectedReviewNetwork(plannerParams, nativeReviewDao(initialDao));
  function useReviewNetwork(params, dao) {
    reviewNetwork = selectedReviewNetwork(params, nativeReviewDao(dao));
    CHAIN_ID = reviewNetwork.chainId;
    RPCS = reviewNetwork.rpcs;
    RESTS = reviewNetwork.rests;
  }
  useReviewNetwork(plannerParams, initialDao);
  const reviewContractFor = (dao) =>
    nativeReviewDao(dao) ? reviewNetwork.contract : dao.workshopContract;
  const reviewLabel = () => reviewNetwork.label;
  const reviewRequirement = () =>
    CHAIN_ID === 'juno-1' ? '1 JUNO DELEGATED' : '1 JUNOX + 1 TEST NETA STAKED';
  let upgradePlannerValues = (value) => value;
  let plannerDraft = null,
    plannerDraftError = null,
    PLANNER_DRAFT_PREFIX = null;
  if (plannerParams.has('proposalTemplate')) {
    try {
      if (
        plannerParams.get('proposalTemplate') !== COMMUNITY_POOL_TEMPLATE ||
        plannerParams.getAll('proposalTemplate').length !== 1 ||
        initialDao.id !== 'juno' ||
        CHAIN_ID !== 'juno-1' ||
        ['plannerDraft', 'review', 'proposal'].some((k) => plannerParams.has(k))
      )
        throw Error('Open the DAI conversion template in the Juno Community Pool workspace.');
      const { savePlannerProposal } = await import('./planner-proposal-draft.mjs');
      const prepared = new URL(
        savePlannerProposal(localStorage, communityPoolProposal()),
        location.origin
      );
      plannerParams.delete('proposalTemplate');
      plannerParams.set('plannerDraft', prepared.searchParams.get('plannerDraft'));
      history.replaceState(null, '', prepared);
    } catch (error) {
      plannerDraftError = error.message;
    }
  }
  if (plannerParams.has('plannerDraft')) {
    try {
      const bridge = await import('./planner-proposal-draft.mjs');
      PLANNER_DRAFT_PREFIX = bridge.PLANNER_DRAFT_PREFIX;
      upgradePlannerValues = bridge.upgradeLegacyPlannerValues;
      plannerDraft = bridge.readPlannerProposal(localStorage, plannerParams, initialDao.id);
      // Render the prepared content before chain history or wallet modules load.
      for (const [field, key] of [
        ['title', 'title'],
        ['summary', 'summary'],
        ['body', 'body'],
        ['actions', 'actions_json']
      ])
        document.querySelector('#proposal-' + field).value = plannerDraft.values[key];
    } catch (error) {
      plannerDraftError = error.message;
    }
  }
  let CONTRACT = reviewContractFor(initialDao),
    proposalModule = initialDao.proposalModule;
  const CHAIN = {
    chainId: 'uni-7',
    chainName: 'Juno Testnet',
    rpc: 'https://juno.test.rpc.nodeshub.online',
    rest: 'https://juno.test.api.nodeshub.online',
    bip44: { coinType: 118 },
    bech32Config: {
      bech32PrefixAccAddr: 'juno',
      bech32PrefixAccPub: 'junopub',
      bech32PrefixValAddr: 'junovaloper',
      bech32PrefixValPub: 'junovaloperpub',
      bech32PrefixConsAddr: 'junovalcons',
      bech32PrefixConsPub: 'junovalconspub'
    },
    currencies: [{ coinDenom: 'JUNOX', coinMinimalDenom: 'ujunox', coinDecimals: 6 }],
    feeCurrencies: [
      {
        coinDenom: 'JUNOX',
        coinMinimalDenom: 'ujunox',
        coinDecimals: 6,
        gasPriceStep: { low: 0.1, average: 0.2, high: 0.3 }
      }
    ],
    stakeCurrency: { coinDenom: 'JUNOX', coinMinimalDenom: 'ujunox', coinDecimals: 6 },
    features: ['cosmwasm']
  };
  const state = {
    address: null,
    walletChain: null,
    client: null,
    mainnetClient: null,
    access: null,
    configOwner: null,
    chain:
      GOVERNANCE_CHAINS.find((chain) => chain.id === initialDao.chainId) || GOVERNANCE_CHAINS[0],
    dao: initialDao,
    scope: initialScope,
    proposals: [],
    chainProposals: [],
    selected: null,
    revisions: [],
    comments: [],
    replyTo: null,
    nativeThreads: false,
    busy: false,
    filter: 'all',
    countdown: null,
    requestEpoch: 0,
    walletEpoch: 0,
    connecting: false,
    actionMessage: '',
    actionKind: 'ready',
    actionButton: null
  };
  const $ = (s) => document.querySelector(s),
    node = (tag, cls, text) => {
      const n = document.createElement(tag);
      if (cls) n.className = cls;
      if (text !== undefined) n.textContent = text;
      return n;
    };
  let sharedFinal = null;
  const { finalizedReview, reviewKind, matchesReview, proposalIdentity, canonical } = await import(
    './juno-community-governance.mjs'
  );
  const isNativeReview = () => nativeReviewDao(state.dao);
  const hasLegacyReceipt = () => {
    if (!plannerDraft || state.selected || state.dao.id !== plannerDraft.daoId) return false;
    try {
      return (
        localStorage.getItem(`cosmoot:juno:planner-proposal:${plannerDraft.id}:submission`) !== null
      );
    } catch {
      return true;
    }
  };
  const submissionDraft = () =>
    sharedFinal ? { ...sharedFinal, review: sharedFinal } : plannerDraft;
  const mainnetStage = () =>
    !!sharedFinal || !!state.selected?.proposal?.native || hasLegacyReceipt();
  const isPlannerGovernance = () => !!plannerDraft && state.dao.id === plannerDraft.daoId;
  const { nativePlanner } = await import(
    './planner-native-governance.mjs?v=20261027-proposal-gas-1'
  );
  const plannerGov = nativePlanner({
    active: () =>
      nativeSubmissionVisible({
        finalized: !!sharedFinal,
        legacyReceipt: hasLegacyReceipt(),
        invalid: !!plannerDraftError,
        visible: document.body.dataset.workspaceView === 'governance'
      }),
    draft: submissionDraft,
    values: () => (sharedFinal ? sharedFinal.values : values()),
    address: () => state.address,
    chain: () => state.walletChain,
    connectWallet: connect,
    rests: MAINNET_RESTS,
    rpcs: MAINNET_RPCS,
    reviewRests: () => RESTS,
    blocked: () => state.busy,
    onSubmitted: openSubmittedProposal,
    status,
    busy: (value) => {
      state.busy = value;
      renderWallet();
      renderActions();
    },
    rerender: renderActions
  });
  const { proposalFunding } = await import('./juno-proposal-funding.mjs');
  const funding = proposalFunding({
    selected: () => state.selected,
    address: () => state.address,
    chain: () => state.walletChain,
    connectWallet: connect,
    rests: MAINNET_RESTS,
    rpcs: MAINNET_RPCS,
    status,
    busy: (value) => {
      state.busy = value;
      renderWallet();
      renderActions();
    }
  });
  const { nativeVoting } = await import('./native-voting-ui.mjs?v=20261027-gas-1');
  const nativeVote = nativeVoting({
    selected: () => state.selected,
    address: () => state.address,
    chain: () => state.walletChain,
    connectWallet: connect,
    rests: MAINNET_RESTS,
    rpcs: MAINNET_RPCS,
    blocked: () => state.busy,
    busy: (value) => {
      state.busy = value;
      renderWallet();
      renderActions();
    },
    onVoted: () => {
      setTimeout(() => {
        void refreshNativeVoting();
      }, 0);
    }
  });
  const reads = governanceQueries({
    review: () => ({ rests: RESTS, contract: CONTRACT, address: state.address }),
    mainnet: () => ({ rests: MAINNET_RESTS, proposalModule })
  });
  const {
    query,
    testnetGet,
    nativeGet,
    mainnetQuery,
    queryAll,
    findUploadedCode,
    findReviewContract
  } = reads;
  const { reviewContext, receiptKey, saveReviewReceipt, pendingReview, reconcileReview } =
    reviewSession({
      context: () => ({
        address: state.address,
        contract: CONTRACT,
        chainId: CHAIN_ID,
        walletChain: state.walletChain,
        walletEpoch: state.walletEpoch,
        requestEpoch: state.requestEpoch,
        selectedKey: state.selected?.key,
        selectedId: state.selected?.id || null
      }),
      label: reviewLabel,
      lookup: reads.transaction,
      feedback: actionFeedback
    });
  const editor = proposalEditor({
    $,
    node,
    isPlannerGovernance,
    isNativeReview,
    renderFrozenValues
  });
  const { values, setValues, validate, renderAccounting, renderDeliverables } = editor;

  async function openSubmittedProposal(id) {
    const epoch = state.requestEpoch;
    await load();
    if (epoch + 1 !== state.requestEpoch) return;
    const item = state.chainProposals.find((p) => String(p.id) === String(id));
    if (!item) throw Error('Submission confirmed; refresh mainnet proposals to open funding.');
    selectChain(item, true);
  }
  const short = (a) => (a ? `${a.slice(0, 9)}…${a.slice(-6)}` : '—'),
    when = (t) => new Date(Number(t) * 1000).toLocaleString(),
    indexingDisabled = indexingUnavailable;
  function status(text, error = false) {
    $('#gov-status').textContent = text;
    $('#gov-status').dataset.state = error ? 'error' : 'ready';
  }

  function actionFeedback(text, kind = 'pending') {
    state.actionMessage = text;
    state.actionKind = kind;
    renderReviewActivity();
  }
  function renderReviewActivity() {
    for (const element of document.querySelectorAll('[data-review-status]')) {
      element.textContent = state.actionMessage;
      element.hidden = !state.actionMessage;
      element.dataset.state = state.actionKind;
    }
    const pending = pendingReview();
    for (const button of document.querySelectorAll('[data-review-check]')) {
      button.hidden = !pending;
      button.disabled = state.busy;
    }
    if (pending) {
      $('#primary-action').disabled = true;
      $('#publish-revision').disabled = true;
      $('#publish-comment').disabled = true;
    }
    $('.proposal-workspace').setAttribute('aria-busy', String(state.busy));
    if (state.busy && state.actionButton) {
      state.actionButton.disabled = true;
      state.actionButton.classList.add('review-action-busy');
      state.actionButton.textContent = 'PROCESSING…';
    }
  }

  async function refreshReviewResult(saved, context) {
    context.assert();
    if (saved.contract !== CONTRACT)
      throw Error('Select the original DAO to open this confirmed review action.');
    let id = reviewEventId(saved.result, CONTRACT) || saved.selectedId;
    if (!id && saved.intent) {
      const rows = await queryAll(
        (startAfter) => ({ proposal_summaries: { start_after: startAfter, limit: 100 } }),
        (item) => item.proposal.id
      );
      // A later revision must not hide the original publication.
      for (const row of rows.filter(
        (r) => r.proposal.id > saved.intent.after && r.proposal.author === saved.intent.author
      )) {
        const revisions = await query({
          revisions: { proposal_id: row.proposal.id, start_after: null, limit: 1 }
        });
        row.latest_revision = revisions[0];
      }
      id = publishedReview(rows, saved.intent)?.proposal.id;
    }
    context.assert();
    if (isNativeReview()) await loadJunoReviews(state.requestEpoch);
    else await load();
    if (!id || !state.proposals.some((p) => p.id === id))
      throw Error(
        'Transaction confirmed. Check status again to load its review; do not publish again.'
      );
    // load() advances the request epoch for legacy DAOs, but wallet/contract must still match.
    if (context.address !== state.address || context.contract !== CONTRACT)
      throw Error('Governance context changed. Check status again.');
    await select(id);
    if (
      context.address !== state.address ||
      context.contract !== CONTRACT ||
      state.selected?.key !== `workshop:${id}`
    )
      throw Error('Governance context changed. Check status again.');
    renderList();
  }
  function namesChain() {
    return document.body.dataset.workspaceView === 'relay' &&
      ['register', 'profile'].includes(document.body.dataset.relayPanel)
      ? $('#nns-network')?.value || 'juno-1'
      : null;
  }
  function walletChain() {
    return (
      namesChain() ||
      (mainnetStage() && document.body.dataset.workspaceView !== 'relay' ? 'juno-1' : null) ||
      (document.body.dataset.workspaceView === 'relay' &&
      document.body.dataset.relayPanel === 'inbox'
        ? 'juno-1'
        : CHAIN_ID)
    );
  }
  function renderNetwork() {
    $('.testnet-pill').hidden = document.body.dataset.workspaceView === 'treasury';
    const relay = document.body.dataset.workspaceView === 'relay';
    $('.testnet-pill').textContent = relay
      ? document.body.dataset.relayPanel === 'inbox'
        ? 'JUNO MAINNET · INBOX'
        : namesChain() === 'juno-1'
          ? 'JUNO MAINNET · NAMES'
          : 'UNI-7 TESTNET'
      : mainnetStage()
        ? 'JUNO MAINNET · GOVERNANCE'
        : state.dao.mode === 'dao-readonly' && !isNativeReview()
          ? 'JUNO MAINNET · READ ONLY'
          : isNativeReview()
            ? `MAINNET DATA · ${reviewLabel().toUpperCase()} REVIEW`
            : 'UNI-7 TESTNET';
  }
  window.addEventListener('hashchange', renderNetwork);
  window.addEventListener('neta:relay-panel', renderNetwork);
  window.addEventListener('neta:nns-network', () => {
    clearWallet();
    renderNetwork();
  });
  let announcedWallet = null,
    announcedChain = null;
  window.NetaWorkspaceWallet = Object.freeze({
    getAddress: () => state.address,
    getSession: () => ({ address: state.address, chainId: state.walletChain })
  });
  function renderWallet() {
    renderNetwork();
    const button = $('#gov-connect');
    button.textContent = state.connecting
      ? 'Connecting…'
      : state.address
        ? short(state.address)
        : 'Connect Keplr';
    button.disabled = state.busy || state.connecting;
    if (state.address) {
      button.title = state.address;
      button.setAttribute('aria-label', `Connected wallet ${state.address}. Reconnect Keplr`);
    } else {
      button.removeAttribute('title');
      button.removeAttribute('aria-label');
    }
    $('#gov-disconnect').hidden = !state.address;
    $('#gov-disconnect').disabled = state.busy;
    if (announcedWallet !== state.address || announcedChain !== state.walletChain) {
      announcedWallet = state.address;
      announcedChain = state.walletChain;
      window.dispatchEvent(
        new CustomEvent('neta:wallet-change', {
          detail: { address: state.address, chainId: state.walletChain }
        })
      );
    }
  }
  function clearWallet() {
    plannerGov.invalidate();
    state.walletEpoch += 1;
    state.requestEpoch += 1;
    state.connecting = false;
    state.client?.disconnect?.();
    state.mainnetClient?.disconnect?.();
    state.client = null;
    state.mainnetClient = null;
    state.address = null;
    state.walletChain = null;
    state.access = null;
    renderWallet();
  }
  function disconnectWallet() {
    if (state.busy) return;
    clearWallet();
    resetCommentForm();
    renderActions();
    renderComments();
    status('WALLET DISCONNECTED');
    $('#gov-connect').focus();
  }
  function updateWorkflow(stage) {
    const stages = [
      '01 NEW DRAFT',
      '02 SAVE LOCALLY',
      '03 PUBLISH FOR REVIEW',
      '04 DISCUSS + REVISE',
      '05 FINALIZE',
      '06 VOTING'
    ];
    const nativeStages = [
      '01 DRAFT',
      '02 PREVIEW',
      '03 PUBLISH REVIEW',
      '04 DISCUSS + REVISE',
      '05 SUBMIT + FUND',
      '06 VOTING'
    ];
    document.querySelectorAll('.workflow [data-stage]').forEach((item) => {
      const value = Number(item.dataset.stage);
      item.textContent = (isNativeReview() ? nativeStages : stages)[value - 1];
      item.classList.toggle('active', value === stage);
      item.classList.toggle('complete', value < stage);
    });
  }
  function renderDaoOptions(term = '') {
    const list = $('#dao-options'),
      needle = term.trim().toLowerCase(),
      matches = ORGANIZATIONS.filter(
        (dao) => dao.chainId === state.chain.id && dao.name.toLowerCase().includes(needle)
      ).sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));
    list.replaceChildren();
    matches.forEach((dao) => {
      const button = node('button', dao.id === state.scope.organization.id ? 'active' : null);
      button.type = 'button';
      button.setAttribute('role', 'option');
      button.setAttribute('aria-selected', String(dao.id === state.scope.organization.id));
      button.append(node('strong', null, dao.name));
      button.onclick = () => selectOrganization(dao);
      button.onkeydown = (event) => {
        const options = [...list.querySelectorAll('button')],
          index = options.indexOf(button);
        if (event.key === 'ArrowDown') {
          event.preventDefault();
          options[(index + 1) % options.length]?.focus();
        }
        if (event.key === 'ArrowUp') {
          event.preventDefault();
          options[(index - 1 + options.length) % options.length]?.focus();
        }
        if (event.key === 'Escape') {
          closeDaoOptions();
          $('#dao-search').focus();
        }
      };
      list.append(button);
    });
    if (!matches.length) list.append(node('div', 'revision-item', 'NO WHITELISTED DAO FOUND'));
    list.hidden = false;
    $('#dao-search').setAttribute('aria-expanded', 'true');
  }
  function closeDaoOptions() {
    $('#dao-options').hidden = true;
    $('#dao-search').setAttribute('aria-expanded', 'false');
    $('#dao-search').value = state.scope.organization.name;
  }
  function renderScope() {
    const select = $('#subdao-select'),
      scope = state.scope;
    select.replaceChildren();
    const overall = node('option', null, 'Consolidated overview');
    overall.value = 'all';
    select.append(overall);
    const group = node('optgroup');
    group.label = 'DAO units';
    for (const dao of scope.units) {
      const option = node('option', null, dao.unitName);
      option.value = dao.id;
      group.append(option);
    }
    select.append(group);
    select.value = scope.consolidated ? 'all' : state.dao.id;
    document.body.dataset.consolidated = String(scope.consolidated);
  }
  function notifyDaoSelection() {
    renderScope();
    renderNetwork();
    window.NETA_SELECTED_DAO = state.dao.id;
    window.NETA_DAO_SCOPE = state.scope;
    window.dispatchEvent(
      new CustomEvent('neta:dao-change', {
        detail: { id: state.dao.id, name: state.dao.name, mode: state.dao.mode, scope: state.scope }
      })
    );
  }
  function selectOrganization(organization) {
    return selectDao(
      DAOS.find((d) => d.id === organization.mainDaoId),
      true
    );
  }
  async function selectDao(dao, consolidated = false) {
    if (state.busy) {
      renderScope();
      closeDaoOptions();
      return;
    }
    const organization = ORGANIZATIONS.find((o) => o.id === dao.organizationId);
    state.scope = { organization, units: unitsFor(organization, DAOS), dao, consolidated };
    const url = new URL(window.location.href);
    selectionParams(state.scope, url.searchParams);
    if (dao !== state.dao) {
      url.searchParams.delete('review');
      url.searchParams.delete('reviewChain');
      url.searchParams.delete('reviewContract');
      url.searchParams.delete('proposal');
    }
    if (plannerDraft && dao.id !== plannerDraft.daoId) {
      url.searchParams.delete('plannerDraft');
      plannerDraft = null;
      plannerDraftError = null;
    }
    history.replaceState(null, '', url);
    try {
      localStorage.setItem(DAO_STORAGE_KEY, dao.id);
      localStorage.setItem(
        'neta-governance-scope',
        JSON.stringify({ organizationId: organization.id, unitId: consolidated ? null : dao.id })
      );
    } catch {}
    state.chain = GOVERNANCE_CHAINS.find((chain) => chain.id === dao.chainId) || state.chain;
    $('#chain-select').value = state.chain.id;
    if (dao === state.dao) {
      closeDaoOptions();
      notifyDaoSelection();
      return;
    }
    state.requestEpoch += 1;
    state.dao = dao;
    closeDaoOptions();
    notifyDaoSelection();
    useReviewNetwork(url.searchParams, dao);
    CONTRACT = reviewContractFor(dao);
    proposalModule = dao.proposalModule;
    clearWallet();
    state.selected = null;
    state.proposals = [];
    state.chainProposals = [];
    renderWallet();
    $('.testnet-pill').textContent =
      dao.mode === 'dao-readonly' && !nativeReviewDao(dao)
        ? 'JUNO MAINNET · READ ONLY'
        : nativeReviewDao(dao)
          ? `MAINNET DATA · ${reviewLabel().toUpperCase()} REVIEW`
          : 'UNI-7 TESTNET';
    $('#native-funding-panel').hidden = dao.mode !== 'native-gov';
    newDraft();
    status(`LOADING ${dao.name.toUpperCase()}…`);
    try {
      await load();
      renderActions();
    } catch (error) {
      status(`${dao.name.toUpperCase()} SELECTED · ${error.message || String(error)}`, true);
    }
  }
  async function selectGovernanceChain(chainId) {
    const chain = GOVERNANCE_CHAINS.find((item) => item.id === chainId);
    if (!chain) return;
    state.chain = chain;
    const available = DAOS.filter((dao) => dao.chainId === chain.id);
    if (!available.includes(state.dao) && available.length)
      return selectOrganization(ORGANIZATIONS.find((o) => o.chainId === chain.id));
    closeDaoOptions();
  }

  const draftKey = () =>
    plannerDraft && state.dao.id === plannerDraft.daoId
      ? `${PLANNER_DRAFT_PREFIX}${plannerDraft.id}:revision${CHAIN_ID === 'juno-1' ? ':juno-1:' + CONTRACT : ''}`
      : `neta-governance-local-draft:${state.dao.id}${CHAIN_ID === 'juno-1' ? ':juno-1:' + CONTRACT : ''}`;
  function localDraft() {
    try {
      const restored = JSON.parse(
        localStorage.getItem(draftKey()) ||
          (plannerDraft && state.dao.id === plannerDraft.daoId
            ? JSON.stringify(plannerDraft.values)
            : null) ||
          (state.dao.id === 'neta-operations'
            ? localStorage.getItem('neta-governance-local-draft')
            : null) ||
          'null'
      );
      return isPlannerGovernance() && plannerDraft.legacy && restored
        ? upgradePlannerValues(restored, plannerDraft.kind)
        : restored;
    } catch (error) {
      if (isPlannerGovernance()) {
        plannerDraftError = error.message;
        return plannerDraft.values;
      }
      return null;
    }
  }

  for (const id of ['proposal-title', 'proposal-summary', 'proposal-body', 'proposal-actions'])
    document.getElementById(id).addEventListener('input', () => {
      void renderFrozenValues(
        {
          title: $('#proposal-title').value,
          body: $('#proposal-body').value,
          actions_json: $('#proposal-actions').value
        },
        true
      );
    });

  const chainGroup = (s) =>
      ['passed', 'executed'].includes(s)
        ? 'approved'
        : ['open', 'deposit'].includes(s)
          ? 'in_progress'
          : 'rejected',
    chainLabel = (s) =>
      ({
        deposit: 'FUNDING',
        open: 'VOTING',
        passed: 'PASSED',
        executed: 'EXECUTED',
        rejected: 'REJECTED',
        closed: 'CLOSED',
        execution_failed: 'EXECUTION FAILED'
      })[s] || String(s).toUpperCase();
  // Owner-selected historical test reviews; exact chain/contract/id/title match only.
  const hiddenTestReviews = new Map([
    [1, 'Make Cristiano the new Senator'],
    [2, 'Testing 1']
  ]);
  function isHiddenTestReview(p) {
    return (
      CHAIN_ID === 'uni-7' &&
      CONTRACT === 'juno18d3mzk3ver06zfr5nf752aycss75vtcqd8fsdcuuzmh5mzj4cm6qrgx3fw' &&
      hiddenTestReviews.get(Number(p.id)) === p.title
    );
  }
  function renderList() {
    const list = $('#proposal-list');
    list.replaceChildren();
    const hiddenCount = state.proposals.filter(isHiddenTestReview).length;
    $('#test-review-toggle').hidden = !hiddenCount;
    const workshop = state.proposals
        .filter((p) => !p.nativeId && ($('#show-test-reviews').checked || !isHiddenTestReview(p)))
        .map((p) => ({
          source: 'workshop',
          group: ['declined', 'rejected', 'withdrawn'].includes(String(p.status).toLowerCase())
            ? 'rejected'
            : 'in_progress',
          sort: Number(p.created_time || p.id),
          record: p
        })),
      chain = state.chainProposals.map((p) => ({
        source: 'chain',
        group: chainGroup(p.proposal.status),
        sort: Number(p.id),
        record: p
      })),
      draft = localDraft(),
      local = draft
        ? [
            {
              source: 'local',
              group: 'in_progress',
              sort: Date.parse(draft.saved_at) || Date.now(),
              record: draft
            }
          ]
        : [],
      rows = [...local, ...workshop, ...chain]
        .filter((x) => state.filter === 'all' || x.group === state.filter)
        .sort((a, b) => b.sort - a.sort);
    $('#proposal-count').textContent = rows.length;
    rows.forEach((item) => {
      const p = item.record,
        isLocal = item.source === 'local',
        b = node(
          'button',
          (isLocal && !state.selected) ||
            state.selected?.key === `${item.source}:${p.id}` ||
            (item.source === 'chain' && state.selected?.nativeId === p.id)
            ? 'active'
            : null
        );
      b.type = 'button';
      const workshopStatus =
          String(p.status).toLowerCase() === 'declined'
            ? 'WITHDRAWN'
            : String(p.status).toUpperCase(),
        label = isLocal
          ? 'PRIVATE DRAFT'
          : item.source === 'chain'
            ? chainLabel(p.proposal.status)
            : workshopStatus,
        title = isLocal
          ? p.title || 'UNTITLED LOCAL DRAFT'
          : item.source === 'chain'
            ? p.proposal.title
            : p.title,
        meta = node('small', `status status-${label.toLowerCase().replaceAll(' ', '-')}`, label),
        context = isLocal
          ? 'ONLY IN THIS BROWSER'
          : `#${p.id} · ${item.source === 'chain' ? 'JUNO MAINNET' : 'PUBLIC REVIEW'}`;
      b.append(node('strong', null, title), meta, node('small', null, context));
      b.onclick = () => {
        if (state.busy) return;
        state.actionMessage = '';
        isLocal ? newDraft() : item.source === 'chain' ? selectChain(p) : select(p.id);
      };
      list.append(b);
    });
    if (!rows.length) list.append(node('div', 'revision-item', 'NO PROPOSALS MATCH THIS FILTER'));
  }
  $('#show-test-reviews').onchange = () => renderList();
  function setEditable(enabled) {
    [
      '#proposal-title',
      '#proposal-summary',
      '#proposal-body',
      '#proposal-actions',
      '#change-note'
    ].forEach((s) => ($(s).disabled = !enabled));
    $('#add-action').disabled = !enabled;
    $('#add-deliverable').disabled = !enabled;
    document
      .querySelectorAll(
        '[data-deliverable-field],[data-remove-deliverable],[data-accounting-action]'
      )
      .forEach((item) => (item.disabled = !enabled));
  }
  function setDetails(open) {
    $('#proposal-details').hidden = !open;
    const button = $('#proposal-details-toggle');
    button.setAttribute('aria-expanded', String(open));
    $('#proposal-details-state').textContent = open ? 'Hide details −' : 'View details +';
  }
  function resetCommentForm() {
    state.replyTo = null;
    $('#comment-title').hidden = false;
    $('#comment-title').value = '';
    $('#comment-body').value = '';
    $('#comment-body').placeholder = 'Introduce the topic';
    $('#comment-form-title').textContent = 'START A NEW TOPIC';
    $('#publish-comment').textContent = 'START THREAD';
    $('#cancel-reply').hidden = true;
  }
  function beginReply(comment) {
    state.replyTo = comment.id;
    $('#comment-title').hidden = true;
    $('#comment-form-title').textContent = `REPLY TO: ${comment.title || short(comment.author)}`;
    $('#comment-body').placeholder = 'Reply to this comment';
    $('#publish-comment').textContent = 'PUBLISH REPLY';
    $('#cancel-reply').hidden = false;
    $('#comment-body').focus();
  }
  function renderRevisions() {
    const list = $('#revision-list');
    list.replaceChildren();
    state.revisions
      .slice()
      .reverse()
      .forEach((r) => {
        const x = node('div', 'revision-item');
        x.append(
          node('strong', null, `REVISION ${r.revision} · ${r.change_note}`),
          node('small', null, `${short(r.author)} · ${when(r.created_time)}`)
        );
        x.onclick = () => {
          setValues({ ...r, title: state.selected.title });
          renderActions();
        };
        list.append(x);
      });
  }
  function renderComments() {
    const list = $('#comment-list');
    list.replaceChildren();
    const comments = state.comments.map(normalizedComment),
      byId = new Map(comments.map((c) => [c.id, c])),
      roots = comments.filter((c) => c.parent_id === null),
      allowed = !!state.access?.can_comment && state.selected?.status === 'discussion';
    comments
      .filter((c) => c.parent_id !== null && !byId.has(c.parent_id))
      .forEach((c) => {
        c.parent_id = null;
        c.title = c.title || 'Earlier discussion';
        roots.push(c);
      });
    const children = new Map();
    comments.forEach((c) => {
      if (c.parent_id === null) return;
      const group = children.get(c.parent_id) || [];
      group.push(c);
      children.set(c.parent_id, group);
    });
    const descendantCount = (id) => {
      const queue = [...(children.get(id) || [])];
      let total = 0;
      while (queue.length) {
        const c = queue.pop();
        total++;
        queue.push(...(children.get(c.id) || []));
      }
      return total;
    };
    const renderReply = (comment, depth = 1) => {
      const item = node('div', 'reply-item');
      item.style.setProperty('--reply-depth', String(Math.min(depth, 4)));
      const controls = node('div', 'reply-controls'),
        reply = node('button', null, 'REPLY');
      reply.type = 'button';
      reply.disabled = !allowed || !!comment.moderation?.hidden;
      reply.onclick = () => beginReply(comment);
      controls.append(
        node(
          'div',
          'thread-meta',
          `${isNativeReview() && CHAIN_ID === 'juno-1' ? 'JUNO ELIGIBILITY VERIFIED AT POSTING' : Number(comment.verified_stake) / 1e6 + ' NETA VERIFIED'} · ${when(comment.created_time)}`
        ),
        reply
      );
      item.append(
        node('strong', null, short(comment.author)),
        node('p', null, comment.body),
        controls
      );
      if (depth < 32)
        (children.get(comment.id) || []).forEach((child) =>
          item.append(renderReply(child, depth + 1))
        );
      else if (children.has(comment.id))
        item.append(node('p', null, 'DEEPER REPLIES OMITTED · DISPLAY DEPTH LIMIT 32'));
      return item;
    };
    roots.forEach((root) => {
      root.title = root.title || 'Earlier discussion';
      const thread = node('article', 'thread'),
        head = node('div', 'thread-head'),
        title = node('h4', null, root.title),
        meta = node(
          'div',
          'thread-meta',
          `${short(root.author)} · ${isNativeReview() && CHAIN_ID === 'juno-1' ? 'JUNO ELIGIBILITY VERIFIED AT POSTING' : Number(root.verified_stake) / 1e6 + ' NETA VERIFIED'} · ${when(root.created_time)}`
        ),
        controls = node('div', 'thread-controls'),
        reply = node('button', null, 'REPLY');
      reply.type = 'button';
      reply.disabled = !allowed || !!root.moderation?.hidden;
      reply.onclick = () => beginReply(root);
      const replyCount = descendantCount(root.id);
      controls.append(
        reply,
        node('span', 'thread-meta', `${replyCount} ${replyCount === 1 ? 'REPLY' : 'REPLIES'}`)
      );
      head.append(title, node('p', null, root.body), meta, controls);
      thread.append(head);
      const replies = children.get(root.id) || [];
      if (replies.length) {
        const replyList = node('div', 'reply-list');
        replies.forEach((c) => replyList.append(renderReply(c)));
        thread.append(replyList);
      }
      list.append(thread);
    });
    if (!roots.length)
      list.append(node('div', 'comment-item', 'NO TOPICS YET · START THE FIRST THREAD BELOW'));
    $('#comment-title').disabled = !allowed;
    $('#comment-body').disabled = !allowed;
    $('#publish-comment').disabled = !allowed || state.busy || pendingReview();
  }
  function nativeAccess() {
    const junox = Number(state.access?.active_native_stake || 0) / 1e6,
      neta = Number(state.access?.active_neta_stake || 0) / 1e6,
      missing = [];
    if (junox < 1) missing.push(`${Math.max(0, 1 - junox)} MORE ${reviewNetwork.coin} DELEGATED`);
    if (reviewNetwork.minimumNeta && neta < 1)
      missing.push(`${Math.max(0, 1 - neta)} MORE TEST NETA STAKED`);
    const holdings = `${junox} ${reviewNetwork.coin} DELEGATED${reviewNetwork.minimumNeta ? ` + ${neta} TEST NETA STAKED` : ''}`;
    return {
      junox,
      neta,
      missing,
      holdings,
      label: state.access?.paused
        ? 'REVIEW PAUSED · OWNER ACTIVATION REQUIRED'
        : missing.length
          ? `${missing.join(' + ')} REQUIRED`
          : `ELIGIBLE · ${holdings}`
    };
  }
  function renderActions() {
    renderPlannerContext();
    plannerGov.render();
    funding.render();
    nativeVote.render();
    let community = false;
    try {
      community =
        isNativeReview() && isCommunityPoolSpend(JSON.parse($('#proposal-actions').value));
    } catch {}
    const planner =
      community ||
      (isPlannerGovernance() && !state.selected) ||
      (isNativeReview() && !!state.selected && state.dao.id === 'juno-delegation');
    $('.deliverables-panel').hidden = planner;
    $('.accounting-help').hidden = planner;
    $('#proposal-accounting').hidden = planner;
    $('#add-action').hidden = planner;
    $('#new-draft').disabled = state.busy;
    $('#discard-action').disabled = state.busy;
    $('#save-local').disabled = state.busy;
    if (plannerDraftError) {
      $('#primary-action').disabled = true;
      $('#action-hint').textContent = plannerDraftError;
      return;
    }
    if (hasLegacyReceipt()) {
      setEditable(false);
      $('#native-funding-panel').hidden = true;
      $('#discussion-panel').hidden = true;
      return;
    }
    const selected = state.selected,
      native = isNativeReview(),
      permissions = reviewActionState({
        selected,
        native,
        readOnly: state.dao.mode === 'dao-readonly',
        address: state.address,
        walletChain: state.walletChain,
        reviewChain: CHAIN_ID,
        canPublish: !!state.access?.can_publish,
        contract: CONTRACT,
        setupAdmin: TEST_ADMIN,
        configOwner: state.configOwner,
        busy: state.busy,
        pending: pendingReview(),
        hasSubmissionReceipt: !!sharedFinal && plannerGov.hasReceipt()
      }),
      { member, discussion, needsSetup, canSetup, withdrawable, canWithdraw } = permissions,
      access = native && state.address ? nativeAccess() : null,
      commentBlocked =
        discussion && !!state.address && !state.access?.can_comment && !!state.dao.commentStakeUrl;
    $('#native-review-setup').hidden = !native || !!CONTRACT;
    $('#change-note-wrap').hidden = true;
    $('#revision-panel').hidden = !selected;
    $('#discussion-panel').hidden =
      !selected || selected.source === 'chain' || (!discussion && !state.comments.length);
    $('#comment-form').hidden = !discussion;
    $('#revision-panel').hidden = !selected || selected.source === 'chain';
    $('#save-local').hidden = !!selected;
    $('#publish-revision').hidden = !discussion;
    $('#eligibility-action').hidden = !commentBlocked;
    $('#eligibility-action').textContent = state.dao.commentStakeLabel || 'OPEN STAKING';
    if (native && CHAIN_ID === 'juno-1') $('#eligibility-action').textContent = 'DELEGATE JUNO';
    $('#primary-action').hidden = !!selected && !discussion;
    $('#discard-action').hidden =
      !!selected && !(withdrawable && selected.source === 'workshop' && native) && !canWithdraw;
    $('#discard-action').textContent = selected ? 'WITHDRAW REVIEW' : 'DISCARD DRAFT';
    $('#discard-action').disabled = selected ? !permissions.withdraw : state.busy;
    $('#discard-action').title =
      selected && !canWithdraw
        ? `Only the draft author can withdraw this review. Connect the author wallet on ${reviewLabel()}.`
        : `Withdraw this review on ${reviewLabel()} before native submission, keeping its public history.`;
    setEditable(permissions.edit);
    if (!selected) {
      $('#action-hint').textContent = needsSetup
        ? canSetup
          ? 'First publication will set up the shared UNI-7 review workspace, verify your stake and then publish this draft.'
          : 'The shared UNI-7 review workspace must be set up by the configured administrator.'
        : member
          ? native
            ? `Publish this Juno proposal on ${reviewLabel()} for community review. Native deposit and submission become available after finalization.`
            : 'Save this private draft locally or publish it on Uni-7 for public review.'
          : native
            ? access
              ? `${access.label} · CURRENT: ${access.holdings}`
              : `CONNECT KEPLR · ${reviewRequirement()} REQUIRED`
            : !CONTRACT
              ? 'Local drafts are available. Public review and proposal submission are not connected for this DAO.'
              : 'Connect an eligible DAO wallet to publish. Local saving remains available.';
      $('#primary-action').textContent = needsSetup
        ? 'SET UP + PUBLISH FOR REVIEW'
        : native && access?.missing.length
          ? access.missing[0]
          : 'PUBLISH FOR REVIEW';
      $('#primary-action').disabled = !permissions.publish;
    } else if (discussion) {
      $('#action-hint').textContent = member
        ? native
          ? 'Publish a revision or finalize the community review. Mainnet deposit and submission remain locked.'
          : 'Publish a revision or finalize this version and move it to Voting.'
        : native
          ? access
            ? `${access.label} · CURRENT: ${access.holdings}`
            : 'Connect Keplr to verify review access. The draft author can withdraw this review.'
          : 'Public Discussion view. DAO voting power is required to revise or finalize.';
      $('#save-local').hidden = false;
      $('#save-local').textContent = 'SAVE REVISION LOCALLY';
      $('#publish-revision').disabled = !permissions.revise;
      $('#primary-action').textContent = native ? 'FINALIZE REVIEW' : 'FINALIZE + SUBMIT ON-CHAIN';
      $('#primary-action').disabled = !permissions.finalize;
    } else {
      $('#action-hint').textContent =
        native && selected?.status === 'ready'
          ? 'Community review finalized. Supported programme proposals can now be submitted by any wallet.'
          : selected?.source === 'chain'
            ? `Juno governance · ${chainLabel(selected.proposal.status)}.`
            : `This proposal is in ${String(selected.status).toUpperCase()}.`;
      $('#primary-action').hidden = true;
    }
    if (discussion && native && state.address && !canWithdraw)
      $('#action-hint').textContent += ' Only the draft author can withdraw this review.';
    $('#native-funding-panel').hidden = true;
    if (selected?.source === 'workshop' && selected.nativeId) {
      setEditable(false);
      $('#planner-native-panel').hidden = true;
      $('#discard-action').hidden = true;
      $('#primary-action').hidden = true;
      $('#action-hint').textContent =
        `Review history · submitted as Juno proposal #${selected.nativeId}.`;
      const link = node('button', null, `Open proposal #${selected.nativeId}`);
      link.type = 'button';
      link.onclick = () =>
        selectChain(state.chainProposals.find((p) => p.id === selected.nativeId));
      $('#action-hint').append(' ', link);
      renderReviewActivity();
      return;
    }
    if (sharedFinal) {
      setEditable(false);
      plannerGov.render();
    }
    if (native && !sharedFinal && selected?.source !== 'chain') {
      try {
        assertProgrammeExecutionAvailable(JSON.parse($('#proposal-actions').value || '[]'));
      } catch (error) {
        $('#primary-action').disabled = true;
        $('#publish-revision').disabled = true;
        $('#action-hint').textContent = error.message;
      }
    }
    renderReviewActivity();
  }

  const formatJuno = (amount) =>
      `${(Number(amount || 0) / 1e6).toLocaleString(undefined, { maximumFractionDigits: 6 })} JUNO`,
    formatDuration = (value) => {
      const days = Math.round(Number(String(value || 0).replace('s', '')) / 86400);
      return `${days} ${days === 1 ? 'DAY' : 'DAYS'}`;
    };
  async function loadNative(epoch) {
    const [first, depositData, votingData] = await Promise.all([
        nativeGet(
          '/cosmos/gov/v1/proposals?pagination.reverse=true&pagination.limit=100&pagination.count_total=true'
        ),
        nativeGet('/cosmos/gov/v1/params/deposit'),
        nativeGet('/cosmos/gov/v1/params/voting')
      ]),
      proposals = [...(first.proposals || [])],
      total = Number(first.pagination?.total || proposals.length);
    for (let offset = proposals.length; offset < total; offset += 100) {
      const page = await nativeGet(
        `/cosmos/gov/v1/proposals?pagination.reverse=true&pagination.limit=100&pagination.offset=${offset}`
      );
      proposals.push(...(page.proposals || []));
    }
    if (epoch !== state.requestEpoch) return;
    const params = depositData.params || {},
      coin =
        (params.min_deposit || []).find((item) => item.denom === 'ujuno') ||
        params.min_deposit?.[0],
      minimum = Number(coin?.amount || 0),
      ratio = Number(params.min_initial_deposit_ratio || 0);
    $('#native-min-deposit').textContent = formatJuno(minimum);
    $('#native-initial-deposit').textContent = formatJuno(minimum * ratio);
    $('#native-deposit-period').textContent = formatDuration(params.max_deposit_period);
    $('#native-voting-period').textContent = formatDuration(votingData.params?.voting_period);
    state.proposals = [];
    state.chainProposals = proposals.map(normalizeNativeProposal);
    renderList();
    status(`${state.chainProposals.length} JUNO GOVERNANCE PROPOSALS · LIVE CHAIN DATA`);
  }
  async function loadJunoReviews(epoch) {
    if (!CONTRACT) {
      state.proposals = [];
      return;
    }
    const [config, summaries] = await Promise.all([
      CHAIN_ID === 'juno-1' ? verifyMainnetReview().then((x) => x.config) : query({ config: {} }),
      queryAll(
        (startAfter) => ({ proposal_summaries: { start_after: startAfter, limit: 100 } }),
        (item) => item.proposal.id
      )
    ]);
    if (epoch !== state.requestEpoch) return;
    state.nativeThreads = true;
    state.configOwner = config.owner;
    state.reviewPaused = config.paused;
    const reviews = await Promise.all(
      summaries
        .filter(({ latest_revision }) => {
          if (state.dao.id !== 'juno-delegation') return true;
          try {
            return reviewKind(latest_revision) !== COMMUNITY_POOL_KIND;
          } catch {
            return false;
          }
        })
        .map(async ({ proposal, latest_revision: latest }) => ({
          ...proposal,
          nativeId: await linkedNativeId(proposal, latest, CHAIN_ID, state.chainProposals),
          title: latest.title || `Juno community proposal #${proposal.id}`,
          status: proposal.withdrawn
            ? 'withdrawn'
            : proposal.finalized_version
              ? 'ready'
              : 'discussion',
          current_revision: proposal.latest_version
        }))
    );
    if (epoch === state.requestEpoch) state.proposals = reviews;
  }
  async function load() {
    const epoch = ++state.requestEpoch;
    if (isNativeReview()) {
      await loadNative(epoch);
      if (epoch !== state.requestEpoch) return;
      await loadJunoReviews(epoch);
      if (epoch !== state.requestEpoch) return;
      renderList();
      $('#native-review-setup').hidden = !!CONTRACT;
      status(
        `${state.chainProposals.length} JUNO MAINNET · ${state.proposals.length} ${reviewLabel().toUpperCase()} REVIEWS${state.reviewPaused ? ' · REVIEW PAUSED' : ''}`
      );
      return;
    }
    const history = [];
    let start_before = null;
    for (let page = 0; page < 20; page++) {
      const result = await mainnetQuery({ reverse_proposals: { start_before, limit: 30 } }),
        batch = result.proposals || [];
      history.push(...batch);
      if (batch.length < 30) break;
      start_before = batch.at(-1).id;
    }
    if (!CONTRACT) {
      if (epoch !== state.requestEpoch) return;
      state.nativeThreads = false;
      state.configOwner = null;
      state.proposals = [];
      state.chainProposals = history;
      renderList();
      status(`${history.length} MAINNET PROPOSALS · PUBLIC REVIEW NOT CONFIGURED`);
      return;
    }
    const [config, proposals] = await Promise.all([
      query({ config: {} }),
      queryAll(
        (startAfter) => ({ proposals: { start_after: startAfter, limit: 100 } }),
        (item) => item.id
      )
    ]);
    if (epoch !== state.requestEpoch) return;
    state.nativeThreads = Object.prototype.hasOwnProperty.call(config, 'minimum_comment_stake');
    state.configOwner = config.owner;
    state.proposals = proposals;
    state.chainProposals = history;
    renderList();
    status(`${history.length} ON-CHAIN · ${state.proposals.length} PUBLIC REVIEWS`);
  }
  async function select(id, showHistory = false) {
    stopNativeVoting();
    const epoch = state.requestEpoch,
      daoId = state.dao.id,
      found = state.proposals.find((p) => p.id === Number(id));
    if (!found) return;
    void renderFrozenValues({});
    sharedFinal = null;
    plannerGov.invalidate();
    funding.invalidate();
    state.selected = { ...found, key: `workshop:${id}`, source: 'workshop' };
    $('#onchain-panel').hidden = true;
    setDetails(false);
    renderList();
    let [revisions, comments] = await Promise.all([
      isNativeReview()
        ? queryAll(
            (startAfter) => ({
              revisions: { proposal_id: Number(id), start_after: startAfter, limit: 100 }
            }),
            (item) => item.version
          )
        : query({ revisions: { proposal_id: Number(id) } }),
      queryAll(
        (startAfter) => ({
          comments: { proposal_id: Number(id), start_after: startAfter, limit: 100 }
        }),
        (item) => item.id
      )
    ]);
    if (
      epoch !== state.requestEpoch ||
      daoId !== state.dao.id ||
      state.selected?.key !== `workshop:${id}`
    )
      return;
    if (isNativeReview())
      revisions = revisions.map((item) => ({
        ...item,
        revision: item.version,
        change_note: item.change_log
      }));
    resetCommentForm();
    state.revisions = revisions;
    state.comments = comments;
    const current =
      revisions.find((r) => r.revision === state.selected.current_revision) || revisions.at(-1);
    let pinnedFinal = null;
    if (
      plannerParams.get('review') === String(id) &&
      (plannerParams.has('reviewRevision') || plannerParams.has('reviewHash'))
    ) {
      try {
        const pin = await finalizedReview(found, current, CHAIN_ID, { readOnly: true });
        assertPinnedReview(plannerParams, found, current, CHAIN_ID, CONTRACT, pin.hash);
        pinnedFinal = pin;
      } catch (error) {
        if (epoch === state.requestEpoch && state.selected?.key === `workshop:${id}`) {
          setValues({});
          setEditable(false);
          $('#primary-action').hidden = true;
          $('#save-local').hidden = true;
          status(error.message, true);
        }
        return;
      }
      if (epoch !== state.requestEpoch || state.selected?.key !== `workshop:${id}`) return;
    }
    setValues({ ...current, title: state.selected.title });
    if (isNativeReview() && state.selected.status === 'ready') {
      let final;
      try {
        final = await finalizedReview(found, current, CHAIN_ID);
      } catch (error) {
        status(error.message, true);
      }
      if (epoch !== state.requestEpoch || state.selected?.key !== `workshop:${id}`) return;
      sharedFinal = final || null;
    }
    const reviewUrl = new URL(location.href);
    reviewUrl.searchParams.delete('plannerDraft');
    reviewUrl.searchParams.delete('proposal');
    reviewUrl.searchParams.delete('reviewRevision');
    reviewUrl.searchParams.delete('reviewHash');
    const linkFinal = sharedFinal || pinnedFinal;
    if (linkFinal && usesRuleReference(current)) {
      reviewUrl.searchParams.set('reviewRevision', String(current.version));
      reviewUrl.searchParams.set('reviewHash', linkFinal.hash);
    }
    reviewUrl.searchParams.set('review', String(id));
    if (showHistory) reviewUrl.searchParams.set('reviewHistory', '1');
    else reviewUrl.searchParams.delete('reviewHistory');
    reviewUrl.searchParams.set('reviewChain', CHAIN_ID);
    if (isNativeReview()) reviewUrl.searchParams.set('reviewContract', CONTRACT);
    reviewUrl.hash = 'governance';
    const authorReview = state.selected;
    void renderAuthorName(
      $('#shared-review-author'),
      found.author,
      () => daoId === state.dao.id && state.selected === authorReview
    );
    $('#review-author-card').hidden = false;
    history.replaceState(null, '', reviewUrl);
    renderNetwork();
    $('#proposal-stage').textContent =
      `PROPOSAL #${state.selected.id} · REVISION ${state.selected.current_revision}`;
    $('#proposal-heading').textContent = state.selected.title;
    $('#proposal-badge').textContent = String(state.selected.status).toUpperCase();
    updateWorkflow(
      ['withdrawn', 'declined'].includes(state.selected.status)
        ? 0
        : state.selected.status === 'discussion'
          ? 4
          : state.selected.status === 'voting'
            ? 6
            : 5
    );
    renderRevisions();
    renderComments();
    renderActions();
    if (sharedFinal) {
      const submitted = state.chainProposals.find((p) =>
        matchesReview(p.proposal.raw, sharedFinal.content)
      );
      if (submitted && !showHistory) selectChain(submitted);
      if (submitted && showHistory) {
        sharedFinal = null;
        state.selected.nativeId = submitted.id;
        renderActions();
      }
    }
    if (!isNativeReview() && revisions.length >= 100)
      status('LEGACY REVISION HISTORY MAY BE TRUNCATED AT 100 RECORDS', true);
  }
  function stopNativeVoting() {
    nativeVote.invalidate();
    votingEpoch++;
    votingRequest = null;
    clearInterval(state.countdown);
    $('#proposal-review-history').hidden = true;
  }
  function renderVotingTotals(votes, native) {
    $('#vote-veto-card').hidden = !native;
    $('#onchain-panel').classList.toggle('native-voting', native);
    $('#legacy-voting-heading').hidden = native;
    $('#onchain-panel .vote-totals').hidden = native;
    if (native) nativeVote.renderTally(votes);
    for (const key of ['yes', 'no', 'abstain', 'veto']) {
      $('#vote-' + key).textContent =
        votes?.[key] == null ? '—' : native ? formatVoteAmount(votes[key]) : votes[key];
    }
  }

  async function refreshNativeVoting() {
    const selected = state.selected,
      generation = votingEpoch;
    if (
      !selected?.proposal?.native ||
      state.busy ||
      document.hidden ||
      document.body.dataset.workspaceView !== 'governance' ||
      votingRequest
    )
      return;
    const request = {};
    votingRequest = request;
    void nativeVote.refresh();
    $('#voting-refresh').disabled = true;
    const current = () => generation === votingEpoch && state.selected === selected;
    try {
      const result = await readNativeVoting(MAINNET_RESTS, selected.id);
      if (!current() || state.busy) return;
      if (
        canonical(proposalIdentity(selected.proposal.raw)) !==
        canonical(proposalIdentity(result.proposal.raw))
      )
        throw Error(
          'The refreshed proposal differs from the displayed proposal. Reload before continuing.'
        );
      selected.proposal = { ...result.proposal, votes: result.votes };
      const stored = state.chainProposals.find((p) => p.id === selected.id);
      if (stored) stored.proposal = selected.proposal;
      renderVotingTotals(result.votes, true);
      $('#proposal-badge').textContent = chainLabel(selected.proposal.status);
      renderExecutionFailure(selected.proposal);
      $('#voting-data-status').textContent =
        `${selected.proposal.status === 'open' ? 'Current tally' : selected.proposal.status === 'deposit' ? 'Voting has not started' : 'Final tally'} · ${new Date(result.checkedAt).toLocaleTimeString()} · Block ${result.height} · ${new URL(result.endpoint).hostname}`;
      updateCountdown();
      renderList();
      funding.render();
      nativeVote.render();
      updateWorkflow(selected.proposal.status === 'deposit' ? 5 : 6);
      $('.next-actions').dataset.status =
        selected.proposal.status === 'open' ? 'voting' : chainGroup(selected.proposal.status);
    } catch (error) {
      if (!current()) return;
      renderVotingTotals(null, true);
      $('#voting-data-status').textContent =
        'Current results unavailable. Retry refresh. ' + error.message;
    } finally {
      if (votingRequest === request) votingRequest = null;
      if (current()) $('#voting-refresh').disabled = false;
    }
  }
  $('#voting-refresh').onclick = refreshNativeVoting;
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) void refreshNativeVoting();
  });
  window.addEventListener('hashchange', () => {
    void refreshNativeVoting();
  });
  window.addEventListener('pagehide', stopNativeVoting);
  function expiryMs(expiration) {
    return expiration?.at_time ? Number(BigInt(expiration.at_time) / 1000000n) : null;
  }
  function updateCountdown() {
    const p = state.selected?.proposal,
      target = expiryMs(p?.expiration);
    if (!p || p.status !== 'open') {
      $('#voting-deadline').textContent = '';
      return;
    }
    if (!Number.isFinite(target)) {
      $('#voting-deadline').textContent = 'Voting deadline unavailable';
      return;
    }
    const left = target - Date.now(),
      minutes = Math.max(0, Math.floor(left / 60000)),
      days = Math.floor(minutes / 1440),
      hours = Math.floor((minutes % 1440) / 60);
    $('#voting-deadline').textContent =
      left <= 0
        ? 'VOTING ENDED'
        : `${days ? `${days}D ` : ''}${hours}H ${minutes % 60}M REMAINING · ENDS ${new Date(target).toLocaleString()}`;
  }
  function renderExecutionFailure(proposal) {
    let target = $('#native-execution-failure');
    if (!target) {
      target = node('p', 'gov-status');
      target.id = 'native-execution-failure';
      target.dataset.state = 'error';
      target.setAttribute('role', 'status');
      $('#onchain-panel').prepend(target);
    }
    target.textContent = nativeExecutionFailure(proposal.raw);
    target.hidden = !target.textContent;
  }
  function selectChain(item, confirmed = false) {
    if (state.busy && !confirmed) return;
    stopNativeVoting();
    sharedFinal = null;
    funding.invalidate();
    $('#planner-proposal-context').hidden = true;
    $('#review-author-card').hidden = true;
    const chainUrl = new URL(location.href);
    chainUrl.searchParams.delete('plannerDraft');
    chainUrl.searchParams.delete('review');
    chainUrl.searchParams.delete('reviewHistory');
    chainUrl.searchParams.delete('reviewRevision');
    chainUrl.searchParams.delete('reviewHash');
    chainUrl.searchParams.set('proposal', String(item.id));
    chainUrl.hash = 'governance';
    history.replaceState(null, '', chainUrl);
    clearInterval(state.countdown);
    state.selected = { ...item, key: `chain:${item.id}`, source: 'chain' };
    plannerGov.invalidate();
    state.revisions = [];
    state.comments = [];
    setDetails(false);
    const p = item.proposal,
      v = p.votes || {},
      native = !!p.native;
    setValues({
      title: p.title,
      summary: p.description,
      body: p.description,
      actions_json: JSON.stringify(p.msgs || [], null, 2)
    });
    $('#proposal-stage').textContent = `JUNO MAINNET · PROPOSAL ${native ? '#' : 'A'}${item.id}`;
    $('#proposal-heading').textContent = p.title;
    $('#proposal-badge').textContent = chainLabel(p.status);
    $('#onchain-panel').hidden = false;
    renderExecutionFailure(p);
    nativeVote.render();
    renderVotingTotals(native ? p.votes : v, native);
    $('#voting-refresh').hidden = !native;
    $('#voting-data-status').textContent = native ? 'Loading current voting results…' : '';
    const review = state.proposals.find((r) => String(r.nativeId) === String(item.id));
    $('#proposal-review-history').hidden = !review;
    if (review) {
      $('#proposal-review-history').textContent = `View community review #${review.id}`;
      $('#proposal-review-history').onclick = () => select(review.id, true);
    }
    const open =
      p.status === 'open' && (!expiryMs(p.expiration) || expiryMs(p.expiration) > Date.now());
    $('#vote-actions').hidden = !open || native || !state.dao.canVote;
    $('#vote-hint').textContent = native
      ? 'Vote directly with Keplr on Juno mainnet.'
      : state.dao.canVote
        ? 'Connect Keplr on Juno Mainnet to vote.'
        : 'Voting is read-only until this DAO transaction adapter is verified.';
    $('#revision-panel').hidden = true;
    $('#discussion-panel').hidden = true;
    setEditable(false);
    $('#change-note-wrap').hidden = true;
    $('#save-local').hidden = true;
    $('#publish-revision').hidden = true;
    $('#primary-action').hidden = true;
    $('#discard-action').hidden = true;
    $('#action-hint').textContent = native
      ? 'This proposal is read directly from Juno native governance.'
      : `This record is read directly from the ${state.dao.name} proposal module.`;
    $('.next-actions').dataset.status = p.status === 'open' ? 'voting' : chainGroup(p.status);
    updateWorkflow(p.status === 'deposit' ? 5 : 6);
    renderList();
    updateCountdown();
    state.countdown = setInterval(() => {
      updateCountdown();
      void refreshNativeVoting();
    }, 30000);
    if (native) void refreshNativeVoting();
    renderNetwork();
    funding.refresh();
  }
  function newDraft() {
    stopNativeVoting();
    sharedFinal = null;
    state.selected = null;
    $('#review-author-card').hidden = true;
    funding.invalidate();
    plannerGov.invalidate();
    clearInterval(state.countdown);
    state.selected = null;
    state.revisions = [];
    state.comments = [];
    setDetails(true);
    resetCommentForm();
    $('#onchain-panel').hidden = true;
    $('#native-funding-panel').hidden = !isNativeReview();
    $('#discard-action').hidden = false;
    $('#discard-action').textContent = 'DISCARD DRAFT';
    const draft = localDraft();
    setValues(draft || {});
    $('#proposal-stage').textContent =
      isPlannerGovernance() || isNativeReview()
        ? 'JUNO · PRIVATE LOCAL DRAFT'
        : 'PRIVATE LOCAL DRAFT';
    $('#proposal-heading').textContent = 'NEW PROPOSAL';
    $('#proposal-badge').textContent = 'DRAFT';
    $('#change-note-wrap').hidden = true;
    $('#revision-panel').hidden = true;
    $('#discussion-panel').hidden = true;
    updateWorkflow(draft ? 2 : 1);
    renderList();
    renderActions();
    renderPlannerContext();
  }
  function renderPlannerContext() {
    const panel = $('#planner-proposal-context');
    const current = plannerDraft && state.dao.id === plannerDraft.daoId && !state.selected;
    const community = current && plannerDraft.kind === COMMUNITY_POOL_KIND;
    panel.querySelector('a').href = community
      ? '/?chain=juno&dao=juno#treasury'
      : `/community-tools/juno/delegation/#${current && plannerDraft.kind === 'CLAIM_REWARDS' ? 'overview' : current && plannerDraft.kind === 'ALLOCATION_EXECUTION' ? 'rebalance' : 'rules'}`;
    panel.querySelector('a').textContent = community
      ? 'View Community Pool →'
      : 'Return to delegation planner →';
    panel.hidden = !current && !plannerDraftError;
    $('#planner-proposal-context-text').textContent =
      plannerDraftError ||
      (community
        ? 'DAI conversion draft · 460.9 axlDAI → Dimi → USDC via Injective → Juno Community Pool. Not published. Review the text and transfer below, then publish for community review. Dimi performs the swap and return separately.'
        : current
          ? `${plannerDraft.kind === 'CLAIM_REWARDS' ? 'Rewards claim' : plannerDraft.kind === 'ALLOCATION_EXECUTION' ? 'Rebalance execution' : 'Allocation rules'} draft from the planner · not submitted. Existing drafts are preserved. Topic: Delegation Programme · Submission and voting: Juno native governance. Publish this draft for community review. Mainnet funding is available after finalization.`
          : '');
  }

  function saveLocal() {
    const button = $('#save-local'),
      original = button.textContent;
    try {
      const v = values();
      validate(v);
      const savedAt = new Date(),
        message = state.selected
          ? `REVISION SAVED LOCALLY ${savedAt.toLocaleTimeString()} · NOT YET PUBLISHED`
          : `PRIVATE DRAFT SAVED LOCALLY ${savedAt.toLocaleTimeString()} · ONLY IN THIS BROWSER`;
      localStorage.setItem(draftKey(), JSON.stringify({ ...v, saved_at: savedAt.toISOString() }));
      renderList();
      status(message);
      delete $('.next-actions').dataset.status;
      updateWorkflow(2);
      renderActions();
      button.textContent = 'SAVED LOCALLY ✓';
      button.dataset.saved = 'true';
      setTimeout(() => {
        button.textContent = original;
        delete button.dataset.saved;
      }, 1800);
    } catch (error) {
      const message = error?.message || String(error);
      status(message, true);
      $('#action-hint').textContent = `COULD NOT SAVE · ${message}`;
      $('.next-actions').dataset.status = 'error';
      button.textContent = 'SAVE FAILED';
      setTimeout(() => {
        button.textContent = original;
      }, 1800);
    }
  }
  async function signer() {
    if (state.client) return state.client;
    if (!state.address) throw new Error('CONNECT KEPLR FIRST');
    const context = reviewContext();
    if (CHAIN_ID === 'juno-1') await loadReviewSigning();
    else await loadSocialsSigning();
    context.assert();
    const base = window.keplr.getOfflineSigner?.(CHAIN_ID) || window.getOfflineSigner?.(CHAIN_ID);
    const wrapped = {
      getAccounts: () => base.getAccounts(),
      signDirect: async (a, d) => {
        actionFeedback('Confirm this review action in Keplr.');
        const signed = await window.keplr.signDirect(CHAIN_ID, a, d, { preferNoSetFee: true });
        actionFeedback(`Signature received. Waiting for ${reviewLabel()} confirmation…`);
        return signed;
      },
      signAmino: async (a, d) => {
        actionFeedback('Confirm this review action in Keplr.');
        const signed = await window.keplr.signAmino(CHAIN_ID, a, d, { preferNoSetFee: true });
        actionFeedback(`Signature received. Waiting for ${reviewLabel()} confirmation…`);
        return signed;
      }
    };
    for (const rpc of RPCS)
      try {
        const connected = await deadline(
          CHAIN_ID === 'juno-1'
            ? NetaNamesSigning.connect(rpc, wrapped, CHAIN_ID)
            : NetaSocialsTestnet.connect(rpc, wrapped),
          45000,
          'RPC CONNECTION'
        );
        try {
          context.assert();
        } catch (error) {
          connected.disconnect?.();
          throw error;
        }
        return (state.client = connected);
      } catch (error) {
        context.assert();
      }
    throw new Error(`ALL ${reviewLabel().toUpperCase()} RPC ENDPOINTS FAILED`);
  }
  async function recover(check, label) {
    for (let i = 0; i < 8; i++) {
      if (i) await new Promise((r) => setTimeout(r, 2000));
      const hit = await check();
      if (hit) return hit;
    }
    throw new Error(`${label} WAS BROADCAST BUT COULD NOT BE RECOVERED`);
  }
  async function execute(msg, memo, check, intent = null) {
    if (!CONTRACT) throw new Error('PUBLIC REVIEW IS NOT CONFIGURED FOR THIS DAO');
    if (state.walletChain !== CHAIN_ID)
      throw new Error(`Reconnect Keplr on ${reviewLabel()} to publish this review.`);
    const context = reviewContext();
    const client = await signer();
    context.assert();
    const active = (await window.keplr.getOfflineSigner(CHAIN_ID).getAccounts())[0]?.address;
    context.assert();
    if (active !== context.address) throw new Error('KEPLR ACCOUNT CHANGED · RECONNECT');
    if (localStorage.getItem(receiptKey(context.address)))
      throw Error('A confirmed review action is waiting to be opened. Check transaction status.');
    // Retain the action binding before the signing client can clear its journal.
    // An interrupted view write then remains status-only even across reloads.
    saveReviewReceipt(null, context, intent);
    const prepared = localStorage.getItem(receiptKey(context.address));
    let result;
    try {
      result =
        CHAIN_ID === 'juno-1'
          ? await executeMainnetReview({
              client,
              sender: context.address,
              contract: context.contract,
              msg,
              memo,
              assertWallet: async (sender) => {
                context.assert();
                if (
                  (await window.keplr.getOfflineSigner(context.chainId).getAccounts())[0]
                    ?.address !== sender
                )
                  throw Error('KEPLR ACCOUNT CHANGED · RECONNECT');
                context.assert();
              }
            })
          : await NetaSocialsTestnet.execute(client, context.address, context.contract, msg, memo);
    } catch (error) {
      if (!localStorage.getItem(`neta-pending-tx-v1:${CHAIN_ID}:${context.address}`)) {
        // The signing adapter retains every unknown broadcast, including interrupted signatures.
        // Without a journal this exception is pre-broadcast rejection or verified failure.
        if (localStorage.getItem(receiptKey(context.address)) === prepared)
          localStorage.removeItem(receiptKey(context.address));
        throw error;
      }
      context.assert();
      if (!error.cause) throw error; // A different tab’s pending action is status-only, never this action’s result.
      result = await reconcileReview(context, intent);
      if (!result) throw error;
      if (result.code !== 0) {
        if (localStorage.getItem(receiptKey(context.address)) === prepared)
          localStorage.removeItem(receiptKey(context.address));
        throw Error(
          `Transaction failed (code ${result.code}). Review the action before trying again.`
        );
      }
    }
    // Persist confirmed outcome before any subsequent view lookup. A failed read
    // or changed account must never offer the same publication as a fresh write.
    saveReviewReceipt(result, context, intent);
    context.assert();
    return result;
  }
  async function run(button, task) {
    if (state.busy) return false;
    state.busy = true;
    state.actionButton = button;
    const old = button.textContent;
    const context = reviewContext();
    const savedReceiptKey = receiptKey(context.address);
    renderWallet();
    renderActions();
    actionFeedback('Preparing your review action…');
    try {
      // A click after an unknown outcome checks the saved transaction only.
      // It must never turn recovery of publication into a new comment/signature.
      if (pendingReview()) {
        let saved = JSON.parse(localStorage.getItem(savedReceiptKey) || 'null');
        if (saved && saved.contract !== context.contract)
          throw Error('Select the original DAO to check this review transaction.');
        if (!saved?.result) {
          const result = await reconcileReview(context, saved?.intent);
          if (!result)
            throw Error(
              'Interrupted review confirmation. Check wallet history; this action remains locked.'
            );
          if (result.code !== 0) {
            localStorage.removeItem(savedReceiptKey);
            throw Error(
              `Previous transaction failed (code ${result.code}). Review the action before trying again.`
            );
          }
          saved = JSON.parse(localStorage.getItem(savedReceiptKey));
        }
        actionFeedback('Transaction confirmed. Updating the review…');
        await refreshReviewResult(saved, context);
        localStorage.removeItem(savedReceiptKey);
        const message =
          'Previous transaction confirmed. The review is up to date; you can continue.';
        status(message);
        actionFeedback(message, 'ready');
        return true;
      }
      const message = await task();
      localStorage.removeItem(savedReceiptKey);
      const success = typeof message === 'string' ? message : 'Review action confirmed.';
      status(success);
      actionFeedback(success, 'ready');
      return true;
    } catch (e) {
      const message = e.message || String(e);
      status(message, true);
      actionFeedback(message, 'error');
      return false;
    } finally {
      state.busy = false;
      button.classList.remove('review-action-busy');
      button.textContent = old;
      state.actionButton = null;
      renderWallet();
      renderActions();
      renderComments();
    }
  }
  function openRevisionDialog() {
    const v = values();
    validate(v);
    $('#revision-change-note').value = $('#change-note').value.trim();
    $('#revision-dialog-error').hidden = true;
    $('#revision-dialog').hidden = false;
    document.body.classList.add('revision-dialog-open');
    requestAnimationFrame(() => $('#revision-change-note').focus());
  }
  function closeRevisionDialog() {
    $('#revision-dialog').hidden = true;
    document.body.classList.remove('revision-dialog-open');
    $('#revision-dialog-error').hidden = true;
    $('#revision-change-note').value = '';
    $('#change-note').value = '';
    $('#publish-revision').focus();
  }
  async function deployNativeReview() {
    if (!isNativeReview() || CHAIN_ID !== 'uni-7')
      throw new Error('Testnet setup is only available on UNI-7.');
    if (!state.address) throw new Error('CONNECT KEPLR FIRST');
    if (state.address !== TEST_ADMIN)
      throw new Error('ONLY THE CONFIGURED TEST ADMIN MAY SET UP THE REVIEW WORKSPACE');
    const [response, checksumResponse] = await Promise.all([
      fetch('assets/neta_proposal_workshop.wasm', { cache: 'no-store' }),
      fetch('assets/neta_proposal_workshop.sha256', { cache: 'no-store' })
    ]);
    if (!response.ok || !checksumResponse.ok)
      throw new Error('VERIFIED REVIEW CONTRACT ARTIFACT NOT FOUND');
    const wasm = new Uint8Array(await response.arrayBuffer()),
      expected = (await checksumResponse.text()).trim().split(/\s+/)[0].toLowerCase(),
      actual = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', wasm)), (byte) =>
        byte.toString(16).padStart(2, '0')
      ).join('');
    if (actual !== expected) throw new Error('REVIEW CONTRACT CHECKSUM MISMATCH');
    const client = await signer();
    let uploaded = await findUploadedCode(expected);
    if (!uploaded)
      try {
        uploaded = await NetaSocialsTestnet.upload(
          client,
          state.address,
          wasm,
          'Upload Juno governance review workshop v0.3.0'
        );
      } catch (error) {
        if (!indexingDisabled(error)) throw error;
        uploaded = await recover(() => findUploadedCode(expected), 'JUNO REVIEW CODE UPLOAD');
      }
    let instance = await findReviewContract(uploaded.codeId);
    if (!instance)
      try {
        instance = await NetaSocialsTestnet.instantiate(
          client,
          state.address,
          uploaded.codeId,
          {
            owner: state.address,
            dao_voting_contract: TEST_ACCESS_CONTRACT,
            stake_contract: TEST_ACCESS_CONTRACT,
            minimum_comment_stake: '0',
            community_gate: {
              native_denom: 'ujunox',
              minimum_native_stake: '1000000',
              minimum_neta_stake: '1000000'
            }
          },
          'Juno Governance Community Review · UNI-7',
          'Instantiate Juno governance review workshop v0.3.0'
        );
      } catch (error) {
        if (!indexingDisabled(error)) throw error;
        instance = await recover(
          () => findReviewContract(uploaded.codeId),
          'JUNO REVIEW INSTANTIATION'
        );
      }
    CONTRACT = instance.contractAddress;
    const config = await query({ config: {} });
    if (config.paused !== false)
      await execute(
        { set_paused: { paused: false } },
        'Unpause Juno governance review workshop',
        async () => {
          const updated = await query({ config: {} });
          return updated.paused === false;
        }
      );
    localStorage.setItem(JUNO_REVIEW_CONTRACT_KEY, CONTRACT);
    state.access = await query({ access: { address: state.address } });
    if (!state.access?.can_publish)
      throw new Error(
        'REVIEW WORKSPACE READY · 1 JUNOX DELEGATED AND 1 TEST NETA STAKED ARE REQUIRED'
      );
    return CONTRACT;
  }
  async function connect(request = null) {
    if (state.busy || state.connecting) return;
    if (
      state.dao.mode === 'dao-readonly' &&
      !isNativeReview() &&
      !mainnetStage() &&
      document.body.dataset.workspaceView !== 'relay'
    ) {
      status(
        'This DAO is read-only. Explore active members under People; wallet connection is not required.'
      );
      return;
    }
    const epoch = ++state.walletEpoch,
      dao = state.dao,
      contract = CONTRACT,
      contextChain = walletChain(),
      requestedChain = request === CHAIN_ID ? request : contextChain;
    const current = () =>
      epoch === state.walletEpoch && dao === state.dao && contextChain === walletChain();
    state.connecting = true;
    renderWallet();
    status('CONNECTING · CHECK KEPLR');
    try {
      if (!window.keplr) throw new Error('KEPLR NOT FOUND');
      if (requestedChain === 'uni-7') {
        if (!window.keplr.experimentalSuggestChain)
          throw new Error('KEPLR CHAIN SUGGESTION UNAVAILABLE');
        await deadline(window.keplr.experimentalSuggestChain(CHAIN), 45000, 'CHAIN SUGGESTION');
        if (!current()) return;
      }
      await deadline(window.keplr.enable(requestedChain), 15000, 'KEPLR ACCESS');
      if (!current()) return;
      const base =
          window.keplr.getOfflineSigner?.(requestedChain) ||
          window.getOfflineSigner?.(requestedChain),
        account = (await base.getAccounts())[0];
      if (!current()) return;
      if (!account?.address) throw new Error('NO KEPLR ACCOUNT AVAILABLE');
      state.client?.disconnect?.();
      state.mainnetClient?.disconnect?.();
      state.client = null;
      state.mainnetClient = null;
      state.address = account.address;
      state.walletChain = requestedChain;
      state.access = null;
      renderWallet();
      renderActions();
      renderComments();
      const access =
        contract && requestedChain === CHAIN_ID
          ? await query({ access: { address: account.address } })
          : null;
      if (!current()) return;
      state.access = access;
      if (requestedChain === 'juno-1' && !nativeReviewDao(dao)) {
        status('CONNECTED TO JUNO MAINNET · REVIEW YOUR GOVERNANCE PROPOSAL');
      } else if (nativeReviewDao(dao)) {
        const neta = Number(access?.active_neta_stake || 0) / 1e6,
          junox = Number(access?.active_native_stake || 0) / 1e6;
        status(
          contract
            ? `${nativeAccess().label} · ${reviewLabel()}`
            : 'CONNECTED · DEPLOY THE JUNO REVIEW CONTRACT'
        );
      } else
        status(
          `${access?.can_publish ? 'DAO MEMBER' : 'CONNECTED'} · ${Number(access?.staked_neta || 0) / 1e6} NETA STAKED`
        );
    } catch (e) {
      if (current()) status(e.message || String(e), true);
    } finally {
      if (epoch === state.walletEpoch) {
        state.connecting = false;
        renderWallet();
        renderActions();
        renderComments();
      }
    }
  }
  for (const button of document.querySelectorAll('[data-review-check]'))
    button.onclick = () => run(button, async () => 'No pending review transaction.');
  $('#proposal-actions').addEventListener('input', renderAccounting);
  $('#subdao-select').onchange = (e) => {
    const scope = state.scope;
    if (e.target.value === 'all') selectOrganization(scope.organization);
    else {
      const dao = scope.units.find((d) => d.id === e.target.value);
      if (dao) selectDao(dao);
    }
  };
  $('#chain-select').onchange = (e) => selectGovernanceChain(e.currentTarget.value);
  $('#dao-search').onfocus = (e) => {
    e.currentTarget.select();
    renderDaoOptions('');
  };
  $('#dao-search').oninput = (e) => renderDaoOptions(e.currentTarget.value);
  $('#dao-search').onkeydown = (e) => {
    if (e.key === 'Escape') closeDaoOptions();
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if ($('#dao-options').hidden) renderDaoOptions(e.currentTarget.value);
      $('#dao-options button')?.focus();
    }
  };
  $('#dao-search').onblur = () =>
    setTimeout(() => {
      if (!$('.dao-picker').contains(document.activeElement)) closeDaoOptions();
    }, 0);
  $('#gov-connect').onclick = connect;
  $('#gov-disconnect').onclick = disconnectWallet;
  $('#new-draft').onclick = () => {
    if (state.busy) return;
    plannerDraft = null;
    plannerDraftError = null;
    const url = new URL(location.href);
    url.searchParams.delete('plannerDraft');
    url.searchParams.delete('proposalTemplate');
    url.searchParams.delete('review');
    url.searchParams.delete('proposal');
    history.replaceState(null, '', url);
    clearWallet();
    newDraft();
    load().catch((e) => status(e.message, true));
  };
  $('#save-local').onclick = saveLocal;
  $('#rule-proposal-convert').onclick = async () => {
    if (state.selected || state.busy || CHAIN_ID !== 'juno-1') return;
    const original = values(),
      identity = JSON.stringify(original);
    try {
      const frozen = await readProposalReview(original);
      if (!frozen) throw Error('Open a verified local rule draft first.');
      const { frozenRuleProposal } = await import('./planner-proposal-draft.mjs');
      const next = await frozenRuleProposal(frozen, { referenced: true });
      if (state.selected || state.busy || JSON.stringify(values()) !== identity)
        throw Error('The draft changed while preparing the new text. Please retry.');
      setValues(next.values);
      saveLocal();
      status(
        'READABLE RULE PROPOSAL SAVED LOCALLY · Rules and frozen comparison preserved. Summary regenerated; review it before publishing.'
      );
    } catch (error) {
      status(error.message, true);
    }
  };
  $('#proposal-details-toggle').onclick = () => setDetails($('#proposal-details').hidden);
  $('#cancel-reply').onclick = resetCommentForm;
  $('#add-action').onclick = () => {
    const a = $('#proposal-actions');
    if (a.value.trim() === '[]') a.value = '[{"type":"wasm_execute","contract":"","msg":{}}]';
    renderAccounting();
    a.focus();
  };
  $('#add-deliverable').onclick = () => {
    editor.addDeliverable(state.address || '');
    setEditable(
      !state.selected || (state.selected.status === 'discussion' && !!state.access?.can_publish)
    );
    $('[data-deliverable-field]')?.focus();
  };
  $('#primary-action').onclick = (e) =>
    sharedFinal || hasLegacyReceipt()
      ? plannerGov.run()
      : run(e.currentTarget, async () => {
          const native = isNativeReview();
          if (!state.selected) {
            const v = values();
            validate(v);
            if (native && isPlannerGovernance() && plannerDraft.kind === 'CLAIM_REWARDS') {
              const context = reviewContext();
              actionFeedback('Checking the next mainnet claim number…');
              const { readClaimContext, withClaimContext } = await import('./claim-numbering.mjs');
              context.assert();
              Object.assign(v, withClaimContext(v, await readClaimContext(MAINNET_RESTS)));
              context.assert();
              $('#proposal-title').value = v.title;
              $('#proposal-body').value = v.body;
            }
            if (!v.body.includes('This proposal was created on cosmoot.com.')) {
              v.body += '\n\nThis proposal was created on cosmoot.com.';
              $('#proposal-body').value = v.body;
            }
            validate(v);
            if (native) await verifyFrozenAction(v);
            if (native && !CONTRACT) await deployNativeReview();
            const author = state.address;
            const before = native
              ? await queryAll(
                  (startAfter) => ({ proposal_summaries: { start_after: startAfter, limit: 100 } }),
                  (item) => item.proposal.id
                )
              : [];
            const intent = {
              author,
              values: v,
              after: Math.max(0, ...before.map((r) => r.proposal.id))
            };
            let result;
            if (native)
              result = await execute(
                { publish_proposal: { content: v } },
                'Juno Governance publish review',
                async () => {
                  const rows = await queryAll(
                    (startAfter) => ({
                      proposal_summaries: { start_after: startAfter, limit: 100 }
                    }),
                    (item) => item.proposal.id
                  );
                  return publishedReview(rows, intent);
                },
                intent
              );
            else
              await execute({ publish_draft: v }, 'NETA Governance publish draft', async () => {
                const rows = await queryAll(
                  (startAfter) => ({ proposals: { start_after: startAfter, limit: 100 } }),
                  (item) => item.id
                );
                return rows.find((p) => p.author === state.address && p.title === v.title);
              });
            actionFeedback('Publication confirmed. Opening the community review…');
            const savedDraftKey = draftKey();
            if (native) {
              await refreshReviewResult(
                JSON.parse(localStorage.getItem(receiptKey())),
                reviewContext()
              );
            } else {
              await load();
              const hit = state.proposals
                .slice()
                .reverse()
                .find((p) => p.author === author && p.title === v.title);
              if (!hit)
                throw Error(
                  'Publication confirmed. Reload reviews to open it; do not publish again.'
                );
              await select(hit.id);
            }
            localStorage.removeItem(savedDraftKey);
            plannerDraft = null;
            plannerDraftError = null;
            if (!native) localStorage.removeItem('neta-governance-local-draft');
            renderList();
            $('#proposal-heading').setAttribute('tabindex', '-1');
            $('#proposal-heading').focus();
            $('#proposal-heading').scrollIntoView({ block: 'start', behavior: 'auto' });
            return 'Published for community review. You can now discuss and revise this proposal.';
          } else {
            const id = state.selected.id;
            if (native) {
              const version = state.selected.current_revision;
              const stored = state.revisions.find((r) => r.revision === version);
              if (!stored) throw Error('The selected revision is unavailable. Reload the review.');
              const exact = { ...stored, title: state.selected.title };
              validate(exact);
              await verifyFrozenAction(exact);
              await execute(
                { finalize: { proposal_id: id, version } },
                'Juno Governance finalize review',
                async () => {
                  const p = await query({ proposal: { proposal_id: id } });
                  return (
                    p.finalized_version !== null && /^[0-9a-f]{64}$/.test(p.finalized_hash || '')
                  );
                }
              );
            } else
              await execute(
                { finalize_and_submit: { proposal_id: id } },
                'NETA Governance finalize proposal',
                async () => {
                  const p = await query({ proposal: { proposal_id: id } });
                  return p.status === 'voting';
                }
              );
            actionFeedback('Finalization confirmed. Opening the next step…');
            if (native) await loadJunoReviews(state.requestEpoch);
            else await load();
            await select(id);
            return 'Review finalized. The proposal is ready for submission.';
          }
        });
  $('#publish-revision').onclick = () => {
    try {
      openRevisionDialog();
    } catch (error) {
      status(error.message || String(error), true);
    }
  };
  $('#revision-dialog-form').onsubmit = async (event) => {
    event.preventDefault();
    const change_note = $('#revision-change-note').value.trim(),
      error = $('#revision-dialog-error');
    if (!change_note) {
      error.textContent = 'DESCRIBE WHAT CHANGED AND WHY';
      error.hidden = false;
      $('#revision-change-note').focus();
      return;
    }
    error.hidden = true;
    $('#change-note').value = change_note;
    const v = values(),
      id = state.selected.id,
      native = isNativeReview(),
      success = await run($('#confirm-revision'), async () => {
        validate(v);
        if (native) await verifyFrozenAction(v);
        if (native)
          await execute(
            { add_revision: { proposal_id: id, content: v, change_log: change_note } },
            'Juno Governance publish revision',
            async () => {
              const rows = await query({
                revisions: { proposal_id: id, start_after: null, limit: 100 }
              });
              return rows.length > state.revisions.length;
            }
          );
        else
          await execute(
            {
              publish_revision: {
                proposal_id: id,
                summary: v.summary,
                body: v.body,
                actions_json: v.actions_json,
                change_note
              }
            },
            'NETA Governance publish revision',
            async () => {
              const rows = await query({ revisions: { proposal_id: id } });
              return rows.length > state.revisions.length;
            }
          );
        if (native) await loadJunoReviews(state.requestEpoch);
        else await load();
        await select(id);
      });
    if (success) closeRevisionDialog();
    else {
      error.textContent = $('#gov-status').textContent;
      error.hidden = false;
    }
  };
  $('#cancel-revision').onclick = closeRevisionDialog;
  $('[data-close-revision-dialog]').onclick = closeRevisionDialog;
  document.addEventListener('keydown', (event) => {
    const dialog = $('#revision-dialog');
    if (dialog.hidden) return;
    if (event.key === 'Escape') closeRevisionDialog();
    if (event.key === 'Tab') {
      const focusable = [
          ...dialog.querySelectorAll('button:not([disabled]),textarea:not([disabled])')
        ],
        first = focusable[0],
        last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  });
  $('#deploy-native-review').onclick = (event) =>
    run(event.currentTarget, async () => {
      await deployNativeReview();
      await load();
      newDraft();
      status(`JUNO REVIEW WORKSPACE READY · ${short(CONTRACT)}`);
    });
  $('#eligibility-action').onclick = () => {
    const url =
      isNativeReview() && CHAIN_ID === 'juno-1'
        ? 'https://www.mintscan.io/juno/validators'
        : state.dao.commentStakeUrl;
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  };
  $('#comment-form').onsubmit = (e) => {
    e.preventDefault();
    const button = $('#publish-comment');
    run(button, async () => {
      const body = $('#comment-body').value.trim(),
        title = $('#comment-title').value.trim(),
        parentId = state.replyTo,
        id = state.selected.id;
      if (!body) throw new Error('COMMENT IS EMPTY');
      if (parentId === null && !title) throw new Error('NAME THE TOPIC FIRST');
      const encodedBody =
          parentId === null
            ? `[[NETA_THREAD:${encodeURIComponent(title)}]]\n${body}`
            : `[[NETA_REPLY:${parentId}]]\n${body}`,
        message = state.nativeThreads
          ? {
              add_comment: {
                proposal_id: id,
                version: state.selected.current_revision,
                parent_id: parentId,
                title: parentId === null ? title : null,
                body
              }
            }
          : { add_comment: { proposal_id: id, body: encodedBody } },
        expectedBody = state.nativeThreads ? body : encodedBody;
      await execute(
        message,
        parentId === null
          ? 'NETA Governance start discussion thread'
          : 'NETA Governance reply to discussion',
        async () => {
          const rows = await query({
            comments: { proposal_id: id, start_after: null, limit: 100 }
          });
          return rows.some((c) => c.author === state.address && c.body === expectedBody);
        }
      );
      await select(id);
      return parentId === null ? 'Discussion thread published.' : 'Reply published.';
    });
  };
  document.querySelectorAll('[data-filter]').forEach(
    (button) =>
      (button.onclick = () => {
        state.filter = button.dataset.filter;
        document
          .querySelectorAll('[data-filter]')
          .forEach((x) => x.classList.toggle('active', x === button));
        renderList();
      })
  );
  $('#discard-action').onclick = async (e) => {
    if (state.busy) return;
    if (!state.selected) {
      if (!localDraft() || confirm('Delete this private local draft?')) {
        localStorage.removeItem(draftKey());
        if (state.dao.id === 'neta-operations')
          localStorage.removeItem('neta-governance-local-draft');
        if (plannerDraft && state.dao.id === plannerDraft.daoId) {
          localStorage.removeItem(PLANNER_DRAFT_PREFIX + plannerDraft.id);
          plannerDraft = null;
          const url = new URL(location.href);
          url.searchParams.delete('plannerDraft');
          history.replaceState(null, '', url);
          renderPlannerContext();
        }
        setValues({});
        updateWorkflow(1);
        renderList();
        clearWallet();
        renderActions();
        status('PRIVATE DRAFT DELETED');
      }
      return;
    }
    const native = isNativeReview();
    if (
      state.selected.source !== 'workshop' ||
      !(state.selected.status === 'discussion' || (native && state.selected.status === 'ready')) ||
      state.selected.author !== state.address ||
      (!native && state.address !== state.configOwner)
    )
      return;
    const selectedKey = state.selected.key,
      author = state.selected.author,
      button = e.currentTarget;
    if (!confirm('Withdraw this published proposal? Its history will remain visible.')) return;
    if (state.walletChain !== CHAIN_ID) await connect(CHAIN_ID);
    if (
      state.walletChain !== CHAIN_ID ||
      state.selected?.key !== selectedKey ||
      state.address !== author
    )
      return;
    run(button, async () => {
      const id = state.selected.id;
      if (native) {
        const withdraw = () =>
          execute(
            { withdraw: { proposal_id: id } },
            'Juno Governance withdraw review',
            async () => {
              const p = await query({ proposal: { proposal_id: id } });
              return p.withdrawn;
            }
          );
        if (sharedFinal) await plannerGov.withdraw(withdraw);
        else await withdraw();
      } else
        await execute(
          { set_status: { proposal_id: id, status: 'declined', dao_proposal_id: null } },
          'NETA Governance withdraw proposal',
          async () => {
            const p = await query({ proposal: { proposal_id: id } });
            return p.status === 'declined';
          }
        );
      if (native) await loadJunoReviews(state.requestEpoch);
      else await load();
      await select(id);
      return 'Review withdrawn. Its proposal text and discussion remain available.';
    });
  };
  async function mainnetSigner(assertCurrent) {
    assertCurrent();
    if (state.mainnetClient) return state.mainnetClient;
    await loadSocialsSigning();
    assertCurrent();
    if (!window.keplr) throw new Error('KEPLR NOT FOUND');
    await window.keplr.enable('juno-1');
    assertCurrent();
    const base = window.keplr.getOfflineSigner('juno-1'),
      account = (await base.getAccounts())[0];
    assertCurrent();
    if (!account?.address) throw new Error('NO KEPLR ACCOUNT AVAILABLE');
    state.address = account.address;
    state.walletChain = 'juno-1';
    renderWallet();
    const wrapped = {
      getAccounts: () => base.getAccounts(),
      signDirect: (a, d) => window.keplr.signDirect('juno-1', a, d, { preferNoSetFee: true }),
      signAmino: (a, d) => window.keplr.signAmino('juno-1', a, d, { preferNoSetFee: true })
    };
    for (const rpc of MAINNET_RPCS)
      try {
        const connected = await NetaSocialsTestnet.connect(rpc, wrapped, '0.075ujuno');
        try {
          assertCurrent();
        } catch (error) {
          connected.disconnect?.();
          throw error;
        }
        return (state.mainnetClient = connected);
      } catch {
        assertCurrent();
      }
    throw new Error('ALL JUNO MAINNET RPC ENDPOINTS FAILED');
  }
  document.querySelectorAll('[data-vote]').forEach(
    (button) =>
      (button.onclick = () =>
        run(button, async () => {
          const selected = state.selected,
            epoch = state.requestEpoch,
            walletEpoch = state.walletEpoch,
            module = proposalModule,
            dao = state.dao;
          if (!dao.canVote || selected?.source !== 'chain' || selected.proposal.status !== 'open')
            throw new Error('VOTING IS NOT OPEN');
          const assertCurrent = () => {
            if (
              epoch !== state.requestEpoch ||
              walletEpoch !== state.walletEpoch ||
              module !== proposalModule ||
              dao !== state.dao ||
              state.selected?.key !== selected.key
            )
              throw new Error('VOTING CONTEXT CHANGED · REVIEW AGAIN');
          };
          const client = await mainnetSigner(assertCurrent);
          assertCurrent();
          const active = (await window.keplr.getOfflineSigner('juno-1').getAccounts())[0]?.address;
          assertCurrent();
          if (active !== state.address) throw new Error('KEPLR ACCOUNT CHANGED · RECONNECT');
          await NetaSocialsTestnet.execute(
            client,
            state.address,
            module,
            { vote: { proposal_id: selected.id, vote: button.dataset.vote } },
            `${state.dao.name} proposal A${selected.id}: ${button.dataset.vote}`
          );
          const refreshed = await mainnetQuery({ proposal: { proposal_id: selected.id } });
          selectChain({ id: selected.id, proposal: refreshed });
        }))
  );
  $('#chain-select').replaceChildren(
    ...GOVERNANCE_CHAINS.map((chain) => {
      const option = node('option', null, chain.name);
      option.value = chain.id;
      return option;
    })
  );
  $('#chain-select').value = state.chain.id;
  $('#dao-search').value = state.scope.organization.name;
  $('#dao-search').disabled = false;
  $('.testnet-pill').textContent =
    state.dao.mode === 'dao-readonly' && !isNativeReview()
      ? 'JUNO MAINNET · READ ONLY'
      : isNativeReview()
        ? `MAINNET DATA · ${reviewLabel().toUpperCase()} REVIEW`
        : 'UNI-7 TESTNET';
  $('#native-funding-panel').hidden = !isNativeReview();
  $('#native-review-setup').hidden = !isNativeReview() || !!CONTRACT;
  notifyDaoSelection();
  window.addEventListener('neta:select-dao', (event) => {
    const dao = DAOS.find((item) => item.id === event.detail?.id);
    if (dao)
      selectDao(
        dao,
        event.detail?.consolidated === true && ORGANIZATIONS.some((o) => o.mainDaoId === dao.id)
      );
  });
  window.addEventListener('neta:open-proposal', async (event) => {
    const id = Number(event.detail?.id);
    if (!Number.isFinite(id)) return;
    let item = state.chainProposals.find((proposal) => Number(proposal.id) === id);
    if (!item) {
      await load();
      item = state.chainProposals.find((proposal) => Number(proposal.id) === id);
    }
    if (item) selectChain(item);
    else status(`ON-CHAIN PROPOSAL A${id} NOT FOUND`, true);
  });
  window.addEventListener('neta:relay-open', async (event) => {
    const id = Number(event.detail?.proposalId),
      dao = DAOS.find((item) => item.id === event.detail?.dao);
    if (!dao || !Number.isFinite(id)) return;
    if (state.dao.id !== dao.id || state.scope.consolidated) await selectDao(dao);
    let item = state.chainProposals.find((proposal) => Number(proposal.id) === id);
    if (!item) {
      await load();
      item = state.chainProposals.find((proposal) => Number(proposal.id) === id);
    }
    if (item) selectChain(item);
    else status(`PROPOSAL #${id} NOT FOUND`, true);
  });
  window.addEventListener('keplr_keystorechange', () => {
    clearWallet();
    status('WALLET CHANGED · RECONNECT TO VERIFY ACCESS');
    renderActions();
    renderComments();
  });
  newDraft();
  renderWallet();
  load()
    .then(async () => {
      const reviewId = plannerParams.get('review'),
        proposalId = plannerParams.get('proposal');
      if (reviewId && /^[1-9]\d*$/.test(reviewId) && isNativeReview()) {
        if (!state.proposals.some((p) => String(p.id) === reviewId))
          throw Error('Shared review not found in this workspace.');
        await select(Number(reviewId), plannerParams.get('reviewHistory') === '1');
      } else if (proposalId && /^[1-9]\d*$/.test(proposalId)) {
        const item = state.chainProposals.find((p) => String(p.id) === proposalId);
        if (!item) throw Error('On-chain proposal not found.');
        selectChain(item);
      }
      renderActions();
    })
    .catch((e) => status(e.message || String(e), true));
})().catch((error) => {
  const context = document.querySelector('#planner-proposal-context');
  context.hidden = false;
  document.querySelector('#planner-proposal-context-text').textContent =
    `Proposal workspace could not initialize: ${error.message}. Reload this page to retry; your saved draft has not been removed.`;
  document.querySelector('#primary-action').disabled = true;
});
