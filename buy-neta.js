import {
  ASSETS as assets,
  POOLS,
  findPool,
  selectAssets,
  verifyPool,
  reserve,
  poolValuation,
  parseSwapQuote,
  buildSwapTransaction,
  receivedFromEvents
} from './wynd-swap-core.mjs';
// Adapted from neta-website 7ad0bbf: direct WYND swap, current Cosmoot shell.
(() => {
  'use strict';
  const LCD_ENDPOINTS = [
    'https://juno.api.m.stavr.tech',
    'https://juno-api.polkachu.com',
    'https://juno-rest.publicnode.com'
  ];
  const LIMIT_USD = 50;
  const DECIMALS = 6;
  const QUOTE_REFRESH_MS = 12000;
  const SIGNING = window.NETA_SWAP_SIGNING;
  const dom = {
    amount: document.querySelector('#offer-amount'),
    receive: document.querySelector('#receive-amount'),
    offerSymbol: document.querySelector('#offer-symbol'),
    receiveSymbol: document.querySelector('#receive-symbol'),
    offerLogo: document.querySelector('#offer-logo'),
    receiveLogo: document.querySelector('#receive-logo'),
    offerUsd: document.querySelector('#offer-usd'),
    receiveUsd: document.querySelector('#receive-usd'),
    offerBalance: document.querySelector('#offer-balance'),
    max: document.querySelector('#max-button'),
    reverse: document.querySelector('#reverse-swap'),
    message: document.querySelector('#quote-error'),
    age: document.querySelector('#quote-age'),
    rate: document.querySelector('#quote-rate'),
    impact: document.querySelector('#price-impact'),
    fee: document.querySelector('#pool-fee'),
    minimum: document.querySelector('#minimum-received'),
    slippageSummary: document.querySelector('#slippage-summary'),
    slippageSummaryButton: document.querySelector('#slippage-summary-button'),
    contractState: document.querySelector('#contract-state'),
    source: document.querySelector('#quote-source'),
    reserves: document.querySelector('#pool-reserves'),
    poolList: document.querySelector('#pool-list'),
    pairLabel: document.querySelector('#swap-pair-label'),
    poolLink: document.querySelector('#pool-contract-link'),
    offerSelect: document.querySelector('#offer-asset'),
    receiveSelect: document.querySelector('#receive-asset'),
    assetMenu: document.querySelector('#asset-menu'),
    assetOptions: document.querySelector('#asset-options'),
    poolObserved: document.querySelector('#pool-observed'),
    priceObserved: document.querySelector('#price-observed'),
    settings: document.querySelector('#slippage-settings'),
    settingsToggle: document.querySelector('#settings-toggle'),
    custom: document.querySelector('#custom-slippage'),
    slippageButtons: [...document.querySelectorAll('[data-slippage]')],
    action: document.querySelector('#swap-action'),
    modal: document.querySelector('#swap-modal'),
    modalState: document.querySelector('#swap-modal-state'),
    preview: document.querySelector('#swap-preview'),
    modalMessage: document.querySelector('#swap-modal-message'),
    confirm: document.querySelector('#confirm-swap'),
    close: document.querySelector('#close-swap'),
    result: document.querySelector('#swap-result'),
    resultLabel: document.querySelector('#swap-result-label'),
    resultHash: document.querySelector('#swap-result-hash'),
    explorer: document.querySelector('#swap-explorer')
  };
  if (!dom.amount || !window.NetaCosmosClient) return;
  const client = new window.NetaCosmosClient(LCD_ENDPOINTS);
  let offer = 'JUNO',
    receive = 'NETA',
    selected = findPool('JUNO', 'NETA'),
    slippage = 5,
    prices = {},
    pool = null,
    contractValid = false;
  let quote = null,
    requestId = 0,
    debounceTimer = null,
    refreshTimer = null,
    ageTimer = null,
    balanceRaw = null;
  let signing = false,
    previewIntent = null,
    balanceRequest = 0,
    marketRevision = 0;
  let poolCheckedAt = null,
    priceTimestamp = null,
    marketTimer = null;

  const poolStates = new Map();
  let menuSide = null,
    menuTrigger = null;
  const other = (symbol) => (symbol === offer ? receive : offer);
  const asNumber = (raw) => Number(raw) / 10 ** DECIMALS;
  const money = (value) =>
    Number.isFinite(value)
      ? `≈ $${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : '≈ —';
  const amountText = (raw, max = 6) => {
    const value = BigInt(raw),
      fraction = String(value % 1000000n)
        .padStart(6, '0')
        .slice(0, max)
        .replace(/0+$/, '');
    return String(value / 1000000n) + (fraction ? '.' + fraction : '');
  };
  const signingConfigValid = Boolean(
    SIGNING &&
      SIGNING.chainId === 'juno-1' &&
      SIGNING.publicMaxUsd === LIMIT_USD &&
      JSON.stringify(SIGNING.pairs) === JSON.stringify(POOLS.map((p) => p.address))
  );

  function parseAmount(value) {
    const clean = value.trim().replace(',', '.');
    if (!/^(?:\d+)(?:\.\d{0,6})?$/.test(clean))
      throw new Error('ENTER A VALID AMOUNT WITH UP TO 6 DECIMALS');
    const [whole, fraction = ''] = clean.split('.');
    const raw = BigInt(whole) * 1000000n + BigInt((fraction + '000000').slice(0, 6));
    if (raw <= 0n) throw new Error('Enter an amount GREATER THAN ZERO');
    return raw;
  }

  function tokenUsd(symbol) {
    return poolValuation(selected, pool, prices)?.prices[symbol] ?? null;
  }

  function renderPools() {
    const rows = POOLS.map((p) => {
      const state = poolStates.get(p.id);
      const valuation =
        state?.pool && Date.now() - state.at < 120000 ? poolValuation(p, state.pool, prices) : null;
      return { p, state, valuation };
    }).sort((a, b) => (b.valuation?.liquidity ?? -1) - (a.valuation?.liquidity ?? -1));
    dom.poolList.replaceChildren(
      ...rows.map(({ p, state, valuation }) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'pool-row';
        button.dataset.pool = p.id;
        button.setAttribute('aria-pressed', String(p.id === selected.id));
        button.disabled = signing;
        const name = document.createElement('span');
        name.className = 'pool-name';
        name.textContent = p.assets.join(' / ');
        const value = document.createElement('span');
        value.className = 'pool-liquidity';
        value.textContent = valuation
          ? '≈ ' +
            valuation.liquidity.toLocaleString('en-US', {
              style: 'currency',
              currency: 'USD',
              maximumFractionDigits: 0
            })
          : state?.error
            ? 'Unavailable'
            : state?.pool
              ? 'USD unavailable'
              : 'Loading…';
        button.append(name, value);
        button.addEventListener('click', () => changePair(p.assets[0], p.assets[1]));
        return button;
      })
    );
  }

  function renderPoolOverview(state = '') {
    const valuation = contractValid && pool ? poolValuation(selected, pool, prices) : null;
    dom.reserves.replaceChildren(
      ...selected.assets.map((symbol) => {
        const row = document.createElement('div'),
          label = document.createElement('dt'),
          value = document.createElement('dd');
        label.textContent = symbol + ' in pool';
        value.textContent =
          pool && contractValid
            ? (Number(reserve(pool, symbol)) / 1e6).toLocaleString('en-US', {
                maximumFractionDigits: 6
              })
            : '—';
        value.dataset.reserve = symbol;
        row.append(label, value);
        return row;
      })
    );
    dom.poolObserved.textContent = valuation
      ? `Pool read ${new Date(poolCheckedAt).toLocaleString()}`
      : state || 'Pool or USD data unavailable. Refresh to try again.';
    dom.priceObserved.textContent = valuation
      ? `USD snapshot: ${new Date(priceTimestamp).toLocaleString()}. ${valuation.derived.length ? valuation.derived.join(', ') + ' price estimated from this pool’s reserve ratio. ' : ''}Liquidity includes both reserves; swap fees and price impact are not included.`
      : 'USD values require a fresh price snapshot and verified pool reserves.';
    renderPools();
  }

  function setMessage(text, state = '') {
    dom.message.textContent = text;
    if (state) dom.message.dataset.state = state;
    else delete dom.message.dataset.state;
  }

  function clearQuote(message = 'Enter an amount to get a quote', state = '') {
    quote = null;
    dom.receive.textContent = '0.0';
    dom.receiveUsd.textContent = '≈ $0.00';
    dom.age.textContent = 'Enter an amount';
    dom.rate.textContent = '—';
    dom.impact.textContent = '—';
    delete dom.impact.dataset.alert;
    dom.fee.textContent = '0.30%';
    dom.minimum.textContent = '—';
    setMessage(message, state);
    renderAction();
  }

  function renderDirection() {
    const receive = other(offer);
    dom.offerSymbol.textContent = offer;
    dom.receiveSymbol.textContent = receive;
    for (const [side, symbol] of [
      ['offer', offer],
      ['receive', receive]
    ]) {
      const img = dom[side + 'Logo'];
      img.hidden = !assets[symbol].logo;
      if (assets[symbol].logo) img.src = assets[symbol].logo;
      const badge = document.querySelector('#' + side + '-badge');
      badge.hidden = !!assets[symbol].logo;
      badge.textContent = symbol.slice(0, 1);
      badge.dataset.symbol = symbol;
      dom[side + 'Select'].setAttribute(
        'aria-label',
        'Select ' + (side === 'offer' ? 'pay' : 'receive') + ' asset, ' + symbol
      );
    }
    dom.pairLabel.textContent = 'WYND · ' + selected.assets.join(' / ');
    dom.reverse.setAttribute('aria-label', 'Reverse ' + offer + ' and ' + receive);
    dom.poolLink.href = 'https://atomscan.com/juno/accounts/' + selected.address;
    renderPools();
    dom.offerUsd.textContent = '≈ $0.00';
    dom.receiveUsd.textContent = '≈ $0.00';
    updateBalance();
    renderAction();
  }

  function signingAuthority() {
    const address = window.NETA_WALLET_STATE?.address;
    if (!SIGNING?.enabled || !signingConfigValid)
      return { ok: false, label: 'SWAP SIGNING IS DISABLED' };
    if (!address) return { ok: false, label: 'Connect Keplr first' };
    if (!contractValid) return { ok: false, label: 'Pool verification required' };
    if (!quote) return { ok: false, label: 'Enter an amount' };
    if (balanceRaw === null) return { ok: false, label: 'Balance unavailable' };
    if (quote.raw > balanceRaw) return { ok: false, label: `INSUFFICIENT ${offer} BALANCE` };
    return { ok: true, label: 'Review swap' };
  }

  function renderAction() {
    if (!dom.action) return;
    const authority = signingAuthority();
    dom.action.disabled = !authority.ok || signing;
    dom.action.textContent = authority.label;
  }

  async function loadMarket() {
    const response = await fetch('/data/treasury/juno-delegation.json', { cache: 'no-store' });
    if (!response.ok) throw new Error('USD price snapshot unavailable');
    const market = await response.json(),
      stamp = Date.parse(market.generated_at || '');
    if (
      market.chain_id !== 'juno-1' ||
      market.dao_id !== 'juno-delegation' ||
      !['LIVE', 'PARTIAL'].includes(market.status) ||
      !Number.isFinite(stamp) ||
      stamp > Date.now() + 60000
    )
      throw new Error('Invalid USD price snapshot');
    if (Date.now() - stamp > 36 * 60 * 60 * 1000) throw new Error('USD price snapshot is stale');
    const next = {};
    for (const symbol of ['JUNO', 'ATOM', 'USDC', 'OSMO']) {
      const asset = market.assets?.find(
        (a) =>
          a.key === 'juno:native:' + assets[symbol].info.native &&
          a.source_chain === 'juno' &&
          a.decimals === 6
      );
      if (Number.isFinite(Number(asset?.usd_price)) && Number(asset.usd_price) > 0)
        next[symbol] = Number(asset.usd_price);
    }
    if (!Object.keys(next).length) throw new Error('Invalid USD price snapshot');
    return { prices: next, timestamp: stamp };
  }

  async function validateContract(target) {
    const [info, pairInfo, livePool, ...tokens] = await Promise.all([
      client.contractInfo(target.address),
      client.smart(target.address, { pair: {} }),
      client.smart(target.address, { pool: {} }),
      ...target.assets
        .filter((s) => assets[s].info.token)
        .map((s) => client.smart(assets[s].info.token, { token_info: {} }))
    ]);
    const symbols = target.assets.filter((s) => assets[s].info.token);
    tokens.forEach((token, i) => {
      if (token.decimals !== assets[symbols[i]].decimals || token.symbol !== symbols[i])
        throw Error('Token identity or precision does not match');
    });
    verifyPool(target, info, pairInfo, livePool);
    return { pool: livePool, source: client.preferredEndpoint, at: Date.now() };
  }

  async function loadVerifiedMarket(all = false) {
    const revision = ++marketRevision,
      target = selected,
      targets = all ? POOLS : [target];
    contractValid = false;
    pool = null;
    prices = {};
    requestId++;
    poolCheckedAt = null;
    priceTimestamp = null;
    renderPoolOverview('Refreshing pool and USD prices…');
    clearQuote('Checking the pool…', 'loading');
    dom.contractState.textContent = 'Checking';
    dom.contractState.dataset.ok = 'false';
    try {
      const [marketResult, poolResults] = await Promise.all([
        Promise.allSettled([loadMarket()]),
        Promise.allSettled(targets.map(validateContract))
      ]);
      if (revision !== marketRevision || target !== selected) return false;
      poolResults.forEach((r, i) =>
        poolStates.set(
          targets[i].id,
          r.status === 'fulfilled' ? r.value : { error: r.reason.message }
        )
      );
      const price = marketResult[0];
      if (price.status === 'rejected') throw price.reason;
      prices = price.value.prices;
      priceTimestamp = price.value.timestamp;
      const verified = poolStates.get(target.id);
      if (!verified?.pool) throw Error(verified?.error || 'Pool unavailable');
      pool = verified.pool;
      poolCheckedAt = verified.at;
      if (!poolValuation(target, pool, prices)) throw Error('USD price unavailable for this pool');
      contractValid = true;
      renderPoolOverview();
      dom.contractState.textContent = 'Verified';
      dom.contractState.dataset.ok = 'true';
      dom.source.textContent = verified.source?.replace('https://', '') || 'Juno REST';
      return true;
    } catch (error) {
      if (revision !== marketRevision) return false;
      contractValid = false;
      pool = null;
      renderPoolOverview();
      dom.contractState.textContent = 'Unavailable';
      dom.contractState.dataset.ok = 'false';
      throw error;
    }
  }

  function quoteUsd(raw, symbol) {
    const price = tokenUsd(symbol);
    return price === null ? null : asNumber(raw) * price;
  }

  async function requestQuote() {
    clearTimeout(debounceTimer);
    clearTimeout(refreshTimer);
    const id = ++requestId;
    let raw;
    try {
      raw = parseAmount(dom.amount.value);
    } catch (error) {
      dom.offerUsd.textContent = '≈ $0.00';
      clearQuote(
        dom.amount.value ? error.message : 'Enter an amount to get a quote',
        dom.amount.value ? 'error' : ''
      );
      return;
    }
    if (!contractValid) {
      clearQuote('Checking the pool…', 'loading');
      return;
    }
    const usd = quoteUsd(raw, offer);
    dom.offerUsd.textContent = money(usd);
    if (usd === null) {
      clearQuote('USD LIMIT CANNOT BE VERIFIED — QUOTE BLOCKED', 'error');
      return;
    }
    if (usd > LIMIT_USD + 0.000001) {
      clearQuote(
        `$50 LIMIT EXCEEDED — CURRENT ESTIMATE ${money(usd).replace('EST. ', '')}`,
        'error'
      );
      return;
    }
    setMessage('Getting a live quote…', 'loading');
    try {
      const response = await client.smart(selected.address, {
        simulation: {
          offer_asset: { info: assets[offer].info, amount: String(raw) },
          ask_asset_info: assets[receive].info,
          referral: false,
          referral_commission: null
        }
      });
      if (id !== requestId) return;
      const { returned, fee, spread } = parseSwapQuote(response);
      if (returned <= 0n) throw new Error('CONTRACT RETURNED AN EMPTY QUOTE');
      const noImpact = returned + fee + spread;
      const impact = noImpact ? (Number(spread) * 100) / Number(noImpact) : 0;
      const min = (returned * BigInt(Math.round((100 - slippage) * 100))) / 10000n;
      quote = {
        raw,
        returned,
        fee,
        spread,
        min,
        at: Date.now(),
        offer,
        receive: other(offer),
        poolId: selected.id,
        usd
      };
      dom.receive.textContent = amountText(returned);
      dom.receiveUsd.textContent = money(quoteUsd(returned, quote.receive));
      dom.rate.textContent = `1 ${offer} ≈ ${(asNumber(returned) / asNumber(raw)).toLocaleString('en-US', { maximumFractionDigits: 8 })} ${quote.receive}`;
      dom.impact.textContent = `${impact.toFixed(2)}%`;
      dom.impact.dataset.alert = String(impact >= 2);
      dom.fee.textContent = `0.30% · ${amountText(fee)} ${quote.receive}`;
      dom.minimum.textContent = `${amountText(min)} ${quote.receive}`;
      setMessage('Quote ready to review', 'ok');
      renderAction();
      renderAge();
      refreshTimer = setTimeout(requestQuote, QUOTE_REFRESH_MS);
    } catch (error) {
      if (id === requestId)
        clearQuote(`QUOTE FAILED: ${(error.message || String(error)).toUpperCase()}`, 'error');
    }
  }

  function scheduleQuote() {
    requestId++;
    clearQuote('Refreshing quote…', 'loading');
    clearTimeout(debounceTimer);
    clearTimeout(refreshTimer);
    debounceTimer = setTimeout(requestQuote, 320);
  }
  function renderAge() {
    if (!quote) return;
    const seconds = Math.max(0, Math.floor((Date.now() - quote.at) / 1000));
    dom.age.textContent = seconds ? `Updated ${seconds}s ago` : 'Just updated';
  }

  async function updateBalance() {
    const address = window.NETA_WALLET_STATE?.address,
      token = offer,
      id = ++balanceRequest;
    balanceRaw = null;
    dom.max.disabled = true;
    renderAction();
    if (!address) {
      dom.offerBalance.textContent = 'Balance —';
      return;
    }
    dom.offerBalance.textContent = 'Loading balance…';
    try {
      const next = await assetBalance(token, address);
      if (id !== balanceRequest || address !== window.NETA_WALLET_STATE?.address || token !== offer)
        return;
      balanceRaw = next;
      dom.offerBalance.textContent = `Balance ${amountText(balanceRaw)} ${offer}`;
      dom.max.disabled = balanceRaw <= 0n;
    } catch {
      if (id === balanceRequest) dom.offerBalance.textContent = 'Balance unavailable';
    } finally {
      if (id === balanceRequest) renderAction();
    }
  }

  function buildTransaction(liveQuote, address) {
    return buildSwapTransaction(liveQuote, address, slippage);
  }

  async function assetBalance(symbol, address) {
    const info = assets[symbol].info;
    if (info.native) {
      const { data } = await client.get(
        `/cosmos/bank/v1beta1/balances/${address}/by_denom?denom=${encodeURIComponent(info.native)}`
      );
      if (data.balance?.denom !== info.native || !/^\d+$/.test(data.balance?.amount || ''))
        throw Error('Invalid asset balance');
      return BigInt(data.balance.amount);
    }
    const result = await client.smart(info.token, { balance: { address } });
    if (!/^\d+$/.test(result.balance || '')) throw Error('Invalid token balance');
    return BigInt(result.balance);
  }

  async function freshQuoteForSigning() {
    const address = window.NETA_WALLET_STATE?.address;
    if (!address || !SIGNING?.enabled || !signingConfigValid)
      throw new Error('SWAP SIGNING IS NOT AVAILABLE');
    if (!(await loadVerifiedMarket())) throw Error('Pool changed. Review again.');
    const raw = parseAmount(dom.amount.value),
      usd = quoteUsd(raw, offer),
      cap = SIGNING.publicMaxUsd;
    if (usd === null || usd > cap + 0.000001)
      throw new Error(`SWAP EXCEEDS THE $${cap} SIGNING LIMIT`);
    const available = await assetBalance(offer, address);
    if (raw > available) throw new Error(`INSUFFICIENT ${offer} BALANCE`);
    const response = await client.smart(selected.address, {
      simulation: {
        offer_asset: { info: assets[offer].info, amount: String(raw) },
        ask_asset_info: assets[receive].info,
        referral: false,
        referral_commission: null
      }
    });
    const { returned, fee, spread } = parseSwapQuote(response);
    if (returned <= 0n) throw new Error('FRESH QUOTE IS EMPTY');
    return {
      raw,
      returned,
      fee,
      spread,
      min: (returned * BigInt(Math.round((100 - slippage) * 100))) / 10000n,
      offer,
      receive: other(offer),
      poolId: selected.id,
      usd
    };
  }

  function transactionPreview(liveQuote, tx, address, gasWanted = null) {
    return {
      network: SIGNING.chainId,
      sender: address,
      direction: `${liveQuote.offer} -> ${liveQuote.receive}`,
      estimated_usd: liveQuote.usd.toFixed(4),
      per_swap_limit_usd: SIGNING.publicMaxUsd,
      max_slippage: `${slippage.toFixed(2)}%`,
      minimum_received: `${amountText(liveQuote.min)} ${liveQuote.receive}`,
      memo: SIGNING.memo,
      contract: tx.contract,
      message: tx.message,
      funds: tx.funds,
      gas_wanted: gasWanted,
      signing_enabled: true
    };
  }

  function renderPreview(liveQuote, tx, address, gas = null) {
    dom.preview.textContent = JSON.stringify(
      transactionPreview(liveQuote, tx, address, gas),
      null,
      2
    );
    document.querySelector('#review-pay').textContent =
      amountText(liveQuote.raw) + ' ' + liveQuote.offer;
    document.querySelector('#review-receive').textContent =
      amountText(liveQuote.returned) + ' ' + liveQuote.receive;
    document.querySelector('#review-minimum').textContent =
      amountText(liveQuote.min) + ' ' + liveQuote.receive;
    document.querySelector('#review-wallet').textContent = address;
    document.querySelector('#review-fee').textContent = gas
      ? amountText(
          BigInt(
            window.NetaSwapSigning.fixedFee(
              gas,
              SIGNING.gasAdjustment,
              SIGNING.gasPrice,
              SIGNING.gasCap
            ).amount[0].amount
          )
        ) + ' JUNO'
      : 'Calculated before signing';
  }
  function closePreview() {
    if (signing) return;
    dom.modal.close();
    dom.action.focus();
  }
  dom.modal.addEventListener('cancel', (event) => {
    event.preventDefault();
    closePreview();
  });

  function openPreview() {
    if (!signingAuthority().ok) return;
    closeAssetMenu();
    const address = window.NETA_WALLET_STATE.address,
      tx = buildTransaction(quote, address);
    previewIntent = {
      address,
      raw: quote.raw,
      offer: quote.offer,
      receive: quote.receive,
      poolId: quote.poolId,
      slippage,
      min: quote.min
    };
    renderPreview(quote, tx, address);
    dom.modalState.textContent = 'Review your swap';
    delete dom.modalState.dataset.state;
    dom.modalMessage.textContent =
      'Your quote, balance and $50 limit are checked again before Keplr opens. A network fee in JUNO applies.';
    dom.result.hidden = true;
    dom.confirm.hidden = false;
    dom.confirm.disabled = false;
    dom.modal.showModal();
    dom.confirm.focus();
  }

  function errorText(error) {
    const raw = error instanceof Error ? error.message : String(error || 'UNKNOWN ERROR');
    return raw.replace(/\s+/g, ' ').trim().toUpperCase() || 'UNKNOWN ERROR';
  }

  async function signSwap() {
    if (signing || !previewIntent) return;
    const reviewed = previewIntent;
    signing = true;
    const controls = [
      dom.amount,
      dom.reverse,
      dom.max,
      dom.custom,
      dom.offerSelect,
      dom.receiveSelect,
      document.querySelector('#refresh-pool'),
      ...dom.poolList.querySelectorAll('button'),
      ...dom.slippageButtons
    ];
    controls.forEach((item) => (item.disabled = true));
    renderAction();
    dom.confirm.disabled = true;
    dom.close.disabled = true;
    dom.modalState.dataset.state = 'loading';
    dom.modalState.textContent = 'Refreshing quote and checking your balance…';
    dom.result.hidden = true;
    let signingClient,
      broadcastHash = '';
    try {
      const address = window.NETA_WALLET_STATE?.address,
        liveQuote = await freshQuoteForSigning();
      if (
        address !== reviewed.address ||
        liveQuote.raw !== reviewed.raw ||
        liveQuote.offer !== reviewed.offer ||
        liveQuote.receive !== reviewed.receive ||
        liveQuote.poolId !== reviewed.poolId ||
        slippage !== reviewed.slippage
      )
        throw new Error('SWAP PARAMETERS CHANGED — REVIEW AGAIN');
      if (liveQuote.min < reviewed.min)
        throw new Error('Quote moved below your reviewed minimum. Close and review a new quote.');
      const tx = buildTransaction(liveQuote, address);
      dom.modalState.textContent = 'Preparing transaction…';
      const walletSigner = window.NETA_WALLET_STATE?.signer;
      if (!walletSigner || (await walletSigner.getAccounts())[0]?.address !== address)
        throw new Error('KEPLR ACCOUNT CHANGED — REVIEW AGAIN');
      const connection = await window.NetaSwapSigning.connect(
        SIGNING.rpcEndpoints,
        walletSigner,
        SIGNING.gasPrice
      );
      signingClient = connection.client;
      if ((await signingClient.getChainId()) !== SIGNING.chainId)
        throw new Error('Signing RPC is on the wrong network');
      const gas = await window.NetaSwapSigning.simulate(
        signingClient,
        address,
        tx.contract,
        tx.message,
        tx.funds,
        SIGNING.memo
      );
      if (!Number.isSafeInteger(gas) || gas <= 0 || gas > SIGNING.gasCap)
        throw new Error(`SIMULATED GAS ${gas} EXCEEDS SAFETY CAP ${SIGNING.gasCap}`);
      const feeRaw = BigInt(
        window.NetaSwapSigning.fixedFee(
          gas,
          SIGNING.gasAdjustment,
          SIGNING.gasPrice,
          SIGNING.gasCap
        ).amount[0].amount
      );
      if ((await assetBalance('JUNO', address)) < feeRaw + (offer === 'JUNO' ? liveQuote.raw : 0n))
        throw Error('Insufficient JUNO for the network fee');
      renderPreview(liveQuote, tx, address, gas);
      if (
        window.NETA_WALLET_STATE?.address !== address ||
        (await walletSigner.getAccounts())[0]?.address !== address
      )
        throw new Error('KEPLR ACCOUNT CHANGED — REVIEW AGAIN');
      dom.modalState.textContent = 'Confirm the transaction in Keplr';
      const result = await window.NetaSwapSigning.execute(
        signingClient,
        address,
        tx.contract,
        tx.message,
        tx.funds,
        window.NetaSwapSigning.fixedFee(
          gas,
          SIGNING.gasAdjustment,
          SIGNING.gasPrice,
          SIGNING.gasCap
        ),
        SIGNING.memo,
        {
          assertWallet: async () => {
            if (
              window.NETA_WALLET_STATE?.address !== address ||
              (await walletSigner.getAccounts())[0]?.address !== address
            )
              throw new Error('Keplr account changed. Review again.');
          }
        }
      );
      broadcastHash = String(result?.transactionHash || '').toUpperCase();
      if (!/^[0-9A-F]{64}$/.test(broadcastHash))
        throw new Error('BROADCAST RETURNED NO VALID TRANSACTION HASH');
      dom.resultLabel.textContent = 'Transaction included';
      dom.resultHash.textContent = broadcastHash;
      dom.explorer.href = `https://atomscan.com/juno/transactions/${broadcastHash}`;
      dom.result.hidden = false;
      dom.confirm.hidden = true;
      dom.modalState.textContent = 'Transaction included. Checking the received asset…';
      const received = receivedFromEvents(result.events, liveQuote.receive, address);
      if (received < liveQuote.min)
        throw new Error(
          `TRANSACTION WAS INCLUDED BUT THE RECEIVED ${liveQuote.receive} EVENT COULD NOT BE VERIFIED`
        );
      dom.modalState.dataset.state = 'ok';
      dom.modalState.textContent = `Transaction confirmed · RECEIVED ${amountText(received)} ${liveQuote.receive}`;
      dom.resultLabel.textContent = 'Transaction confirmed';
      dom.modalMessage.textContent =
        'The transaction was included on Juno and its receiving-asset event satisfies the displayed minimum.';
      await updateBalance();
      scheduleQuote();
    } catch (error) {
      dom.modalState.dataset.state = 'error';
      dom.modalState.textContent = broadcastHash
        ? 'Transaction included · verification incomplete'
        : 'Transaction not confirmed';
      dom.modalMessage.textContent = errorText(error);
      if (broadcastHash) {
        dom.resultLabel.textContent = 'Transaction included';
        dom.resultHash.textContent = broadcastHash;
        dom.explorer.href = `https://atomscan.com/juno/transactions/${broadcastHash}`;
        dom.result.hidden = false;
        dom.confirm.hidden = true;
      }
    } finally {
      try {
        signingClient?.disconnect();
      } catch {}
      signing = false;
      controls.forEach((item) => (item.disabled = false));
      dom.max.disabled = balanceRaw === null || balanceRaw <= 0n;
      dom.close.disabled = false;
      if (!dom.confirm.hidden) dom.confirm.disabled = false;
      renderPools();
      renderAction();
    }
  }

  function selectSlippage(value) {
    if (!Number.isFinite(value) || value < 0.1 || value > 10) {
      setMessage('SLIPPAGE MUST BE BETWEEN 0.1% AND 10%', 'error');
      return false;
    }
    value = Math.round(value * 100) / 100;
    if (value === slippage) return true;
    slippage = value;
    dom.slippageSummary.textContent = `${slippage.toFixed(2)}%`;
    dom.slippageButtons.forEach((button) =>
      button.classList.toggle('selected', Number(button.dataset.slippage) === value)
    );
    if (quote) scheduleQuote();
    return true;
  }

  function closeAssetMenu(restoreFocus = false) {
    dom.assetMenu.hidden = true;
    dom.offerSelect.setAttribute('aria-expanded', 'false');
    dom.receiveSelect.setAttribute('aria-expanded', 'false');
    if (restoreFocus) menuTrigger?.focus();
    menuSide = null;
  }
  function openAssetMenu(side) {
    if (signing || dom.modal.open) return;
    if (menuSide === side && !dom.assetMenu.hidden) return closeAssetMenu(true);
    closeAssetMenu();
    menuSide = side;
    menuTrigger = dom[side + 'Select'];
    menuTrigger.parentElement.append(dom.assetMenu);
    const current = side === 'offer' ? offer : receive;
    dom.assetOptions.setAttribute('aria-label', side === 'offer' ? 'Pay asset' : 'Receive asset');
    dom.assetOptions.replaceChildren(
      ...Object.values(assets).map((asset) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.role = 'option';
        button.dataset.asset = asset.symbol;
        button.setAttribute('aria-selected', String(asset.symbol === current));
        const label = document.createElement('strong'),
          detail = document.createElement('small');
        label.textContent = asset.symbol;
        detail.textContent = asset.name;
        button.append(label, detail);
        button.addEventListener('click', () => {
          const next = selectAssets(side, asset.symbol, offer, receive);
          closeAssetMenu(true);
          changePair(next.offer, next.receive);
        });
        return button;
      })
    );
    dom.assetMenu.hidden = false;
    menuTrigger.setAttribute('aria-expanded', 'true');
    dom.assetOptions.querySelector('[aria-selected="true"]')?.focus();
  }
  function changePair(nextOffer, nextReceive) {
    if (signing || dom.modal.open) return;
    const next = findPool(nextOffer, nextReceive);
    if (!next || (nextOffer === offer && nextReceive === receive)) return;
    closeAssetMenu();
    requestId++;
    balanceRequest++;
    marketRevision++;
    clearTimeout(debounceTimer);
    clearTimeout(refreshTimer);
    previewIntent = null;
    quote = null;
    contractValid = false;
    pool = null;
    offer = nextOffer;
    receive = nextReceive;
    selected = next;
    dom.amount.value = '';
    renderDirection();
    clearQuote('Checking the selected pool…', 'loading');
    loadVerifiedMarket()
      .then((loaded) => {
        if (loaded) clearQuote('Pool verified. Enter an amount to get a quote.', 'ok');
      })
      .catch((error) => clearQuote(error.message, 'error'));
  }
  dom.offerSelect.addEventListener('click', () => openAssetMenu('offer'));
  dom.receiveSelect.addEventListener('click', () => openAssetMenu('receive'));
  dom.assetMenu.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeAssetMenu(true);
      return;
    }
    const items = [...dom.assetOptions.querySelectorAll('button')],
      at = items.indexOf(document.activeElement);
    const next =
      event.key === 'ArrowDown'
        ? (at + 1) % items.length
        : event.key === 'ArrowUp'
          ? (at - 1 + items.length) % items.length
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? items.length - 1
              : -1;
    if (next >= 0) {
      event.preventDefault();
      items[next].focus();
    }
    if (event.key === 'Tab') closeAssetMenu();
  });
  document.addEventListener('pointerdown', (event) => {
    if (
      !dom.assetMenu.contains(event.target) &&
      !dom.offerSelect.contains(event.target) &&
      !dom.receiveSelect.contains(event.target)
    )
      closeAssetMenu();
  });

  function toggleSlippageSettings(forceOpen) {
    const open = forceOpen === undefined ? dom.settings.hidden : Boolean(forceOpen);
    dom.settings.hidden = !open;
    dom.settingsToggle.setAttribute('aria-expanded', String(open));
    if (open && forceOpen) dom.custom.focus();
  }

  dom.amount.addEventListener('input', scheduleQuote);
  dom.reverse.addEventListener('click', () => {
    if (signing) return;
    closeAssetMenu();
    previewIntent = null;
    const previous = quote?.returned;
    [offer, receive] = [receive, offer];
    renderDirection();
    dom.amount.value = previous ? amountText(previous) : dom.amount.value;
    clearQuote();
    scheduleQuote();
  });
  dom.max.addEventListener('click', () => {
    if (balanceRaw === null) return;
    const price = tokenUsd(offer);
    if (!price) return;
    const limitRaw = BigInt(Math.floor((LIMIT_USD / price) * 1e6));
    const spendable =
      offer === 'JUNO' ? (balanceRaw > 60000n ? balanceRaw - 60000n : 0n) : balanceRaw;
    const chosen = spendable < limitRaw ? spendable : limitRaw;
    dom.amount.value = amountText(chosen);
    scheduleQuote();
  });
  dom.settingsToggle.addEventListener('click', () => toggleSlippageSettings());
  dom.slippageSummaryButton?.addEventListener('click', () => toggleSlippageSettings(true));
  dom.slippageButtons.forEach((button) =>
    button.addEventListener('click', () => {
      dom.custom.value = '';
      selectSlippage(Number(button.dataset.slippage));
    })
  );
  dom.custom.addEventListener('input', () => {
    const value = Number(dom.custom.value.replace(',', '.'));
    if (dom.custom.value && Number.isFinite(value) && value >= 0.1 && value <= 10)
      selectSlippage(value);
  });
  dom.custom.addEventListener('change', () =>
    selectSlippage(Number(dom.custom.value.replace(',', '.')))
  );
  addEventListener('neta:wallet-connected', updateBalance);
  addEventListener('neta:wallet-disconnected', () => {
    updateBalance();
    if (!signing) closePreview();
  });
  dom.action?.addEventListener('click', openPreview);
  dom.confirm?.addEventListener('click', signSwap);
  dom.close?.addEventListener('click', () => {
    if (!signing) closePreview();
  });
  ageTimer = setInterval(renderAge, 1000);
  addEventListener('pagehide', () => {
    clearInterval(ageTimer);
    clearTimeout(refreshTimer);
    clearInterval(marketTimer);
  });

  renderDirection();
  function refreshPool() {
    return loadVerifiedMarket(true)
      .then((loaded) => {
        if (!loaded) return;
        setMessage('Pool verified. Enter an amount to get a quote.', 'ok');
        if (dom.amount.value) scheduleQuote();
      })
      .catch((error) => {
        clearQuote(
          `SAFETY CHECK FAILED: ${(error.message || String(error)).toUpperCase()}`,
          'error'
        );
      });
  }
  document.querySelector('#refresh-pool').addEventListener('click', refreshPool);
  marketTimer = setInterval(() => {
    if (!document.hidden && !signing && !dom.modal.open) refreshPool();
  }, 60000);
  const mascot = document.querySelector('#wynd-offline-ghost');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const flash = () => {
    if (document.hidden || signing || dom.modal.open || !dom.assetMenu.hidden || motion.matches)
      return;
    mascot.classList.remove('visible');
    void mascot.offsetWidth;
    mascot.classList.add('visible');
  };
  mascot.addEventListener('animationend', () => mascot.classList.remove('visible'));
  const mascotTimer = setInterval(flash, 15000);
  addEventListener('pagehide', () => clearInterval(mascotTimer));
  motion.addEventListener('change', () => mascot.classList.remove('visible'));
  flash();
  refreshPool();
})();
