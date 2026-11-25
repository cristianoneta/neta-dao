import { SCOPES } from './governance-query.mjs';
import {
  escapeHTML as esc,
  fetchGovernance,
  fetchGnoDetail,
  isOpen,
  isClosed,
  markdown,
  formatWeight,
  votePercent
} from './governance-data.mjs';
const date = (value) =>
  Number.isFinite(Date.parse(value))
    ? new Date(value).toLocaleString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    : 'Not supplied';
const number = (value) => Number(value).toLocaleString('en-US');
const logo = (scope, size = '') =>
  `<img class="gov-logo ${size}" src="./logos/${SCOPES[scope].logo}.svg" width="48" height="48" alt="">`;
const external = (url, label, cls = '') =>
  `<a class="${cls}" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>`;
const empty = (title, message) =>
  `<div class="empty"><strong>${esc(title)}</strong>${esc(message)}</div>`;

export function createGovernanceWorkspace(app) {
  let route = { mode: 'prototype' },
    directoryQuery = '',
    directoryFilter = 'All';
  const feeds = Object.fromEntries(
    Object.keys(SCOPES).map((scope) => [
      scope,
      {
        data: null,
        error: '',
        loading: false,
        query: '',
        filter: 'All',
        details: new Map(),
        detailErrors: new Map(),
        pendingDetails: new Set()
      }
    ])
  );

  function shell() {
    const scope = route.scope;
    return `<header class="header"><div class="wrap header-inner"><a href="#/" class="brand" aria-label="Cosmoot governance directory"><img src="./mark.svg" width="30" height="30" alt="">COSMOOT <span>GOVERNANCE</span></a><nav class="nav" aria-label="Main navigation"><a href="#/" class="${!scope ? 'active' : ''}" ${!scope ? 'aria-current="page"' : ''}>Directory</a>${scope ? `<a href="#/${scope}/proposals" class="active" aria-current="page">Proposals</a>` : '<a href="#/proposals">Try the prototype</a>'}<span class="nav-mode">DEMO</span></nav><div class="header-right">${
      scope
        ? `<label class="sr-only" for="gov-scope">Governance community</label><select id="gov-scope" class="gov-scope">${Object.entries(
            SCOPES
          )
            .map(
              ([key, item]) =>
                `<option value="${key}" ${scope === key ? 'selected' : ''}>${item.name}</option>`
            )
            .join('')}</select>`
        : '<span class="network">READ-ONLY GOVERNANCE</span>'
    }</div></div></header><main id="main" class="wrap gov-main"></main><div class="wrap"><footer class="footer"><span class="demo-label">COSMOOT GOVERNANCE · Public chain data. No transactions.</span><span>People & treasury: <a href="#/people">explore the Gno prototype</a></span></footer></div>`;
  }
  function count(scope, kind) {
    const data = feeds[scope].data;
    return data
      ? number(kind === 'all' ? data.proposals.length : data.proposals.filter(isOpen).length) +
          (!data.complete ? '+' : '')
      : '—';
  }
  function card(scope) {
    const item = SCOPES[scope],
      feed = feeds[scope],
      data = feed.data;
    const latest = data?.proposals[0];
    return `<a class="gov-card" href="#/${scope}/proposals" aria-label="Open ${item.name} governance"><div class="gov-card-head">${logo(scope)}<div><h3>${item.name}</h3><span class="muted">${item.asset} · ${scope === 'atomone' ? 'AtomOne' : 'Gno.land'}</span></div><span class="badge">${item.kind}</span></div><p class="gov-card-description">${item.description}</p><dl class="gov-card-stats"><div><dt>Open proposals</dt><dd>${count(scope, 'open')}</dd></div><div><dt>On-chain history</dt><dd>${count(scope, 'all')}</dd></div></dl><div class="gov-card-latest"><span class="eyebrow">LATEST PROPOSAL</span><strong>${latest ? `#${esc(latest.id)} · ${esc(latest.title)}` : feed.error ? 'Source temporarily unavailable' : data ? 'No proposals recorded yet' : 'Loading proposal history…'}</strong><span class="small">${latest ? esc(latest.status) : 'Open the workspace to inspect the source.'}</span></div><div class="gov-card-bottom"><span>${feed.error ? 'Refresh needed' : data ? 'Mainnet · source connected' : 'Connecting to mainnet'}</span><strong>Open governance</strong></div></a>`;
  }
  function directory() {
    const list = Object.keys(SCOPES).filter(
      (key) =>
        (directoryFilter === 'All' || SCOPES[key].kind === directoryFilter) &&
        `${SCOPES[key].name} ${SCOPES[key].asset} ${SCOPES[key].kind}`
          .toLowerCase()
          .includes(directoryQuery.toLowerCase())
    );
    const ready = Object.values(feeds).filter((f) => f.data),
      total = ready.reduce((sum, f) => sum + f.data.proposals.length, 0);
    return `<section class="gov-directory-intro"><div><div class="eyebrow">COMMUNITIES. DECISIONS. IN VIEW.</div><h1>Governance</h1><p>Find your community.<br>Follow the decisions that shape it.</p></div><dl class="gov-overview"><div><dt>Communities</dt><dd>3</dd><span>Two chains · one protocol</span></div><div><dt>Proposals loaded</dt><dd>${ready.length ? number(total) + (ready.length < 3 || ready.some((f) => !f.data.complete) ? '+' : '') : '—'}</dd><span>${ready.filter((f) => !f.error).length} of 3 sources connected</span></div><div><dt>Stay up to date</dt><dd>60<span>s</span></dd><span>Refreshes while this page is open</span></div></dl></section><section aria-labelledby="communities-heading"><div class="gov-directory-tools"><h2 id="communities-heading">Explore governance <span class="count">${list.length}</span></h2><div class="search-wrap"><span class="search-icon" aria-hidden="true">⌕</span><input id="gov-directory-search" aria-label="Search communities" placeholder="Search community or token…" value="${esc(directoryQuery)}"></div><div class="filter-row" aria-label="Governance type">${['All', 'Chain governance', 'Protocol governance'].map((type) => `<button class="filter ${directoryFilter === type ? 'active' : ''}" data-gov="directory-filter" data-value="${type}" aria-pressed="${directoryFilter === type}">${type === 'All' ? 'All communities' : type}</button>`).join('')}</div></div><div class="gov-directory-grid">${list.length ? list.map(card).join('') : empty('No matching community', 'Try another name or governance type.')}</div></section><div class="gov-directory-note"><div><h2>One workspace. Different governance models.</h2><p>AtomOne votes with staked ATONE. Gno.land uses its GovDAO member tiers. GnoSwap uses delegated xGNS. Each workspace keeps its own proposals, voting model and source.</p></div><div><span class="eyebrow">EXPLORE THE CONCEPT</span><h3>Names, people & community work</h3><p>Try the original Gno experience with sample proposals, a treasury and community profiles.</p><a class="btn" href="#/proposals">Open interactive prototype</a></div></div>`;
  }
  function selected(feed) {
    return route.id ? feed.data?.proposals.find((p) => p.id === route.id) : feed.data?.proposals[0];
  }
  function listRows(feed) {
    const chosen = selected(feed);
    const list =
      feed.data?.proposals.filter(
        (p) =>
          (feed.filter === 'All' || (feed.filter === 'Open' ? isOpen(p) : isClosed(p))) &&
          `${p.id} ${p.title} ${p.author || ''}`.toLowerCase().includes(feed.query.toLowerCase())
      ) || [];
    return list.length
      ? list
          .map(
            (p) =>
              `<a class="proposal-item ${p.id === chosen?.id ? 'selected' : ''}" href="#/${route.scope}/proposals/${p.id}" ${p.id === chosen?.id ? 'aria-current="true"' : ''}><div class="item-top"><span class="mono">#${esc(p.id)}</span><span class="gov-status ${isOpen(p) ? 'is-open' : ''}">${esc(p.status)}</span></div><h3>${esc(p.title)}</h3><div class="item-bottom"><span>${p.submitted ? esc(date(p.submitted).split(',')[0]) : SCOPES[route.scope].kind}</span><span>${esc(p.tiers ? p.tiers : SCOPES[route.scope].asset)}</span></div></a>`
          )
          .join('')
      : empty(
          feed.loading && !feed.data
            ? 'Loading proposals…'
            : feed.error && !feed.data
              ? 'Source unavailable'
              : 'No matching proposals',
          feed.error && !feed.data ? 'Use Refresh to try again.' : 'Try another search or filter.'
        );
  }
  function tally(p) {
    if (!p.tallies)
      return '<p class="small-note">Vote totals are not available in this response. Open the source to inspect the latest vote.</p>';
    const total = Object.values(p.tallies)
      .reduce((a, v) => a + BigInt(v), 0n)
      .toString();
    return `<h3>${esc(p.tallyLabel)}</h3>${Object.entries(p.tallies)
      .map(
        ([label, value]) =>
          `<div class="gov-tally-row"><span>${label}</span><strong>${formatWeight(value, p.decimals)}</strong><span>${votePercent(value, total) === null ? '—' : votePercent(value, total).toFixed(2) + '%'}</span></div>`
      )
      .join(
        ''
      )}<p class="small-note">Percentages are shares of the recorded vote weight.${p.quorum ? ` Proposal quorum: ${formatWeight(p.quorum)} xGNS.` : ''} Approval and execution are separate states.</p>`;
  }
  function proposalDetail(feed) {
    const base = selected(feed);
    if (!base)
      return `<section class="panel detail">${empty(route.id && feed.data ? 'Proposal not found' : 'Your governance workspace', route.id ? 'This ID is not in the loaded on-chain history.' : 'Select a proposal to read its details and source.')}</section>`;
    const p = feed.details.get(base.id) || base;
    const hasDescription = Object.hasOwn(p, 'description');
    return `<section class="panel detail" aria-label="Selected on-chain proposal"><div class="detail-head"><div class="detail-meta"><span class="mono">#${p.id}</span><span class="badge light">${esc(p.status)}</span><span>${SCOPES[route.scope].name}</span></div><h2 id="proposal-heading" tabindex="-1">${esc(p.title)}</h2><div class="byline"><span>Proposed by <strong class="gov-address">${esc(p.author || 'not supplied')}</strong></span></div><div class="proposal-facts"><div class="fact"><p>${p.submitted ? 'Submitted' : 'Voting eligibility'}</p><strong class="small">${esc(p.submitted ? date(p.submitted) : p.tiers || SCOPES[route.scope].voting)}</strong></div><div class="fact"><p>${p.voteEnd ? 'Voting ends' : 'Governance model'}</p><strong class="small">${esc(p.voteEnd ? date(p.voteEnd) : SCOPES[route.scope].voting)}</strong></div></div></div><div class="detail-body gov-proposal-body">${hasDescription ? markdown(p.description || 'No proposal text was supplied by the source.') : feed.detailErrors.has(p.id) ? `<div class="notice">${esc(feed.detailErrors.get(p.id))} <button class="btn text" data-gov="retry-detail">Retry details</button></div>` : '<p role="status">Loading proposal details…</p>'}${p.governanceStats ? `<section class="gov-tally">${markdown(p.governanceStats)}</section>` : hasDescription ? `<section class="gov-tally">${tally(p)}</section>` : ''}${p.messages ? `<details class="gov-technical"><summary>On-chain messages (${p.messages.length})</summary><pre>${esc(JSON.stringify(p.messages, null, 2))}</pre></details>` : ''}<div class="detail-action"><span class="small">Read-only · voting is handled by the source application.</span>${external(p.source, 'Open source', 'btn')}${p.voteSource ? external(p.voteSource, 'Voting list', 'btn') : ''}</div></div></section>`;
  }
  function workspace() {
    const scope = route.scope,
      item = SCOPES[scope],
      feed = feeds[scope],
      data = feed.data;
    return `<div class="gov-context"><a href="#/">All communities</a><span>/</span><span>${item.kind}</span></div><div class="title-row"><div class="gov-title">${logo(scope)}<div><div class="eyebrow">${item.kind.toUpperCase()} · MAINNET</div><h1>${item.name} proposals</h1><p>${item.description}</p></div></div><button class="btn" data-gov="refresh" ${feed.loading ? 'disabled' : ''}>${feed.loading ? 'Refreshing…' : 'Refresh'}</button></div><div class="gov-feed-summary"><span><strong>${count(scope, 'all')}</strong> on-chain proposals</span><span><strong>${count(scope, 'open')}</strong> open</span><span>${item.voting}</span><span class="gov-freshness" role="status">${feed.error ? `Refresh failed${data ? ' · showing last successful read' : ''}` : data ? `Checked ${date(data.checkedAt)}` : 'Connecting to the chain…'}</span></div>${feed.error ? `<div class="notice" role="status">${esc(feed.error)}${data ? ` Last successful read: ${date(data.checkedAt)}.` : ''}</div>` : ''}${data && !data.complete ? '<div class="notice">Partial history: the query limit was reached. Open the source for older proposals.</div>' : ''}<div class="workspace gov-workspace"><aside class="panel inbox" aria-label="On-chain proposal inbox"><div class="panel-top"><h2>Proposals</h2><span class="count">${data ? data.proposals.length : '—'}</span></div><div class="inbox-tools"><div class="search-wrap"><span class="search-icon" aria-hidden="true">⌕</span><input id="gov-proposal-search" aria-label="Search on-chain proposals" placeholder="Search proposals…" value="${esc(feed.query)}"></div><div class="filter-row" aria-label="Filter on-chain proposals">${['All', 'Open', 'Closed'].map((f) => `<button class="filter ${feed.filter === f ? 'active' : ''}" data-gov="proposal-filter" data-value="${f}" aria-pressed="${feed.filter === f}">${f}</button>`).join('')}</div></div><div class="proposal-list" id="gov-proposal-list">${listRows(feed)}</div></aside>${proposalDetail(feed)}</div><details class="gov-source-note"><summary>Source & update coverage</summary><p>Reads the retained on-chain history from ${scope === 'atomone' ? (data?.source === '1' ? 'Allnodes / PublicNode' : 'All in Bits') : 'the official Gno.land RPC'}. Refreshes every 60 seconds while this page is visible and when you return to it. This is a live reader, not a permanent Cosmoot archive.</p><p>${data ? `Network: ${esc(data.node.network)}. Source node tip: ${number(data.node.height)} at ${date(data.node.time)}. The tip identifies the source; the queries are not a single block-pinned snapshot.` : 'Network and source time appear after a successful read.'} ${scope === 'gno' ? 'GovDAO history covers the proposals exposed by its current implementation. Member-tier percentages follow the source and are not token-weight percentages.' : ''}</p>${external(item.source, 'View governance source')}</details>`;
  }
  function paint() {
    if (route.mode === 'prototype') return;
    const focused = document.activeElement;
    const focus = focused?.id;
    const actionFocus = focused?.dataset?.gov;
    const valueFocus = focused?.dataset?.value;
    const selection =
      focused instanceof HTMLInputElement ? [focused.selectionStart, focused.selectionEnd] : null;
    const listScroll = document.getElementById('gov-proposal-list')?.scrollTop;
    app.innerHTML = shell();
    document.getElementById('main').innerHTML =
      route.mode === 'directory' ? directory() : workspace();
    document.title = route.scope
      ? `${SCOPES[route.scope].name} proposals · Cosmoot`
      : 'Governance · Cosmoot';
    const input = focus && document.getElementById(focus);
    if (input && (input instanceof HTMLInputElement || input instanceof HTMLSelectElement)) {
      input.focus({ preventScroll: true });
      if (selection && input instanceof HTMLInputElement) input.setSelectionRange(...selection);
    }
    if (actionFocus) {
      [...app.querySelectorAll('[data-gov]')]
        .find((el) => el.dataset.gov === actionFocus && el.dataset.value === valueFocus)
        ?.focus({ preventScroll: true });
    }
    const list = document.getElementById('gov-proposal-list');
    if (list && listScroll) list.scrollTop = listScroll;
  }
  async function details(scope) {
    if (scope !== 'gno' || route.scope !== scope) return;
    const feed = feeds[scope],
      p = selected(feed);
    if (
      !p ||
      feed.details.has(p.id) ||
      feed.pendingDetails.has(p.id) ||
      feed.detailErrors.has(p.id)
    )
      return;
    const generation = feed.data;
    feed.pendingDetails.add(p.id);
    try {
      const detail = await fetchGnoDetail(p, { signal: AbortSignal.timeout(20000) });
      if (feed.data === generation) feed.details.set(p.id, detail);
    } catch {
      if (feed.data === generation)
        feed.detailErrors.set(p.id, 'The source could not load this proposal.');
    } finally {
      feed.pendingDetails.delete(p.id);
      if (route.scope === scope) {
        paint();
        // A refresh superseded this request while the selected ID was pending.
        if (feed.data !== generation) void details(scope);
      }
    }
  }
  async function refresh(scope) {
    const feed = feeds[scope];
    if (feed.loading) return;
    feed.loading = true;
    paint();
    try {
      feed.data = await fetchGovernance(scope, { signal: AbortSignal.timeout(90000) });
      feed.error = '';
      feed.details.clear();
      feed.detailErrors.clear();
    } catch (error) {
      feed.error =
        error.name === 'TimeoutError'
          ? 'The source took too long. Please try again.'
          : error.message;
    } finally {
      feed.loading = false;
      paint();
      void details(scope);
    }
  }
  function refreshVisible() {
    if (document.hidden || route.mode === 'prototype') return;
    for (const scope of route.mode === 'directory' ? Object.keys(SCOPES) : [route.scope])
      void refresh(scope);
  }
  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-gov]');
    if (!button || route.mode === 'prototype') return;
    const action = button.dataset.gov;
    if (action === 'directory-filter') {
      directoryFilter = button.dataset.value;
      paint();
    }
    if (action === 'proposal-filter') {
      feeds[route.scope].filter = button.dataset.value;
      paint();
    }
    if (action === 'refresh') void refresh(route.scope);
    if (action === 'retry-detail') {
      const p = selected(feeds[route.scope]);
      if (p) feeds[route.scope].detailErrors.delete(p.id);
      void details(route.scope);
    }
  });
  document.addEventListener('input', (event) => {
    if (event.target.id === 'gov-directory-search') {
      directoryQuery = event.target.value;
      paint();
    }
    if (event.target.id === 'gov-proposal-search') {
      feeds[route.scope].query = event.target.value;
      document.getElementById('gov-proposal-list').innerHTML = listRows(feeds[route.scope]);
    }
  });
  document.addEventListener('change', (event) => {
    if (event.target.id === 'gov-scope' && Object.hasOwn(SCOPES, event.target.value))
      location.hash = `#/${event.target.value}/proposals`;
  });
  document.addEventListener('visibilitychange', refreshVisible);
  setInterval(refreshVisible, 60000);
  return {
    leave() {
      route = { mode: 'prototype' };
    },
    render(next) {
      route = next;
      paint();
      for (const scope of route.mode === 'directory' ? Object.keys(SCOPES) : [route.scope]) {
        const feed = feeds[scope];
        if (!feed.data || Date.now() - Date.parse(feed.data.checkedAt) > 60000) void refresh(scope);
      }
      if (route.scope) void details(route.scope);
    }
  };
}
