import {
  STORAGE_KEY,
  OWN_ID,
  examplePeople,
  initialState,
  loadState,
  quoteName,
  availableName,
  budgetFor,
  payProposal,
  connectSocial
} from './model.mjs';

const $ = (selector, root = document) => root.querySelector(selector);
const esc = (value) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );
const num = (n, digits = 0) =>
  Number(n).toLocaleString('en-US', {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits
  });
const money = (n) => num(n, 3).replace(/0+$/, '').replace(/\.$/, '');
const date = (value) =>
  new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
let storage;
try {
  storage = window.localStorage;
} catch {
  storage = {
    getItem: () => null,
    setItem: () => {
      throw Error('Storage unavailable');
    }
  };
}
let state = loadState(storage);
let storageFailed = false;
let selectedTab = 'Details';
let proposalFilter = 'All';
let proposalQuery = '';
let peopleQuery = '';
let peopleFilter = 'All people';
let toastTimer;
let returnFocus;
let modalContext = {};
const app = $('#app');
const dialog = $('#dialog');

function save() {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    storageFailed = true;
    toast('Browser storage is unavailable. Changes will last for this visit only.');
    return false;
  }
}
function toast(message) {
  $('#toast').textContent = message;
  $('#toast').classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('#toast').classList.remove('show'), 4500);
}
function people() {
  const list = [
    ...examplePeople,
    {
      id: OWN_ID,
      name: state.profile.name,
      role: 'You · demo member',
      bio:
        state.profile.bio ||
        'Your place in the Gno community. Add a name, a short introduction and your community accounts.',
      initials: state.profile.name ? state.profile.name.slice(0, 2).toUpperCase() : 'YOU',
      telegram: state.profile.telegram,
      discord: state.profile.discord,
      proposals: state.proposals.filter((p) => p.author === OWN_ID).length,
      comments: state.proposals.flatMap((p) => p.comments).filter((c) => c.author === OWN_ID).length
    }
  ];
  return list.map((p) => ({
    ...p,
    proposals: state.proposals.filter((item) => item.author === p.id).length,
    comments: state.proposals.flatMap((item) => item.comments).filter((c) => c.author === p.id)
      .length
  }));
}
function person(id) {
  return people().find((p) => p.id === id) || { id, name: '', initials: 'GN' };
}
function displayName(id) {
  const p = person(id);
  return p.name ? `${p.name}.gno` : 'g1demo…7j9k';
}
function avatar(id, size = '') {
  return `<span class="avatar ${size}" aria-hidden="true">${esc(person(id).initials)}</span>`;
}
function profileLink(id, text = displayName(id)) {
  return `<a class="inline-link" href="#/people/${esc(id)}">${esc(text)}</a>`;
}
function getRoute() {
  const parts = location.hash.replace(/^#\/?/, '').split('/');
  const page = ['proposals', 'treasury', 'people'].includes(parts[0]) ? parts[0] : 'proposals';
  return { page, id: parts[1] || '' };
}
function currentProposal() {
  return state.proposals.find((p) => p.id === Number(getRoute().id)) || state.proposals[0];
}
function navigate(route) {
  if (location.hash === `#${route}`) render();
  else location.hash = route;
}
function shell(page) {
  return `<header class="header"><div class="wrap header-inner"><a href="#/proposals" class="brand" aria-label="Cosmoot Gno demo"><img src="./mark.svg" alt="" width="30" height="30">COSMOOT <span>GNO</span></a><nav class="nav" aria-label="Main navigation">${['Proposals', 'Treasury', 'People'].map((item) => `<a href="#/${item.toLowerCase()}" class="${page === item.toLowerCase() ? 'active' : ''}" ${page === item.toLowerCase() ? 'aria-current="page"' : ''}>${item}</a>`).join('')}<span class="nav-mode">DEMO</span></nav><div class="header-right"><span class="network"><span class="dot"></span> GNO CONCEPT</span><button class="btn account-btn" data-action="${state.connected ? 'account' : 'connect'}">${state.connected ? `${avatar(OWN_ID, 'small')}<span>${esc(displayName(OWN_ID))}</span><span class="chevron">⌄</span>` : 'Connect demo wallet'}</button></div></div></header><main id="main" class="wrap"></main><div class="wrap"><footer class="footer"><span class="demo-label"><span class="circle-dash"></span>INTERACTIVE DEMO · Sample data. No blockchain transactions.${storageFailed ? ' Browser storage unavailable.' : ' Changes stay in this browser.'}</span><div><button class="btn text" data-action="about">About this demo</button><span class="dot-divider"> &nbsp; / &nbsp; </span><button class="btn text" data-action="reset">Reset demo</button></div></footer></div>`;
}
function titleBlock(eyebrow, title, subtitle, actions = '') {
  return `<div class="title-row"><div><div class="eyebrow">${eyebrow}</div><h1>${title}</h1><p>${subtitle}</p></div><div class="intro-right">${actions}</div></div>`;
}
function stats(items) {
  return `<div class="stats">${items.map(([label, value, unit]) => `<div class="stat"><div class="stat-label">${label}</div><div class="stat-value num">${value}${unit ? `<span>${unit}</span>` : ''}</div></div>`).join('')}</div>`;
}
function proposalRows() {
  const selected = currentProposal().id;
  const list = state.proposals.filter(
    (p) =>
      (proposalFilter === 'All' ||
        (proposalFilter === 'Open'
          ? ['Draft', 'Discussion', 'Ready', 'Voting'].includes(p.status)
          : ['Approved', 'Completed'].includes(p.status))) &&
      `${p.title} ${p.id} ${p.topic}`.toLowerCase().includes(proposalQuery.toLowerCase())
  );
  return list.length
    ? list
        .map(
          (p) =>
            `<a class="proposal-item ${p.id === selected ? 'selected' : ''}" href="#/proposals/${p.id}" ${p.id === selected ? 'aria-current="true"' : ''}><div class="item-top"><span class="mono">#${String(p.id).padStart(3, '0')}</span><span>${esc(p.status === 'Discussion' ? 'In discussion' : p.status)}</span></div><h3>${esc(p.title)}</h3><div class="item-bottom"><span>${num(p.amount)} GNOT</span><span><span class="tiny-symbol">↳</span> ${p.comments.length} comments</span></div></a>`
        )
        .join('')
    : '<div class="empty"><strong>No proposals found</strong>Try a different search or filter.</div>';
}
function budgetPanel(p) {
  const b = budgetFor(state, p);
  return `<section class="panel"><div class="panel-top"><h2>Budget impact</h2><span class="badge">Example</span></div><div class="side-content"><dl class="ledger"><div><dt>Treasury balance</dt><dd>${num(b.balance)} GNOT</dd></div><div><dt>Approved commitments</dt><dd>−${num(b.committed)}</dd></div><div><dt>${b.proposed ? 'This proposal' : 'Additional proposed spend'}</dt><dd>−${num(b.proposed)}</dd></div><div><dt>Operating reserve</dt><dd>−${num(b.reserve)}</dd></div><div class="total"><dt>${b.proposed ? 'Remaining if approved' : 'Available to allocate'}</dt><dd>${num(b.remaining)}</dd></div></dl><progress class="budget-progress" value="${Math.max(0, b.remaining)}" max="${Math.max(1, b.balance)}" aria-label="Remaining GNOT relative to treasury balance"></progress><p class="legend">${b.remaining < 0 ? 'This request exceeds the available example budget.' : 'GNOT · After commitments and reserve.'} ${p.status === 'Approved' ? 'This proposal is already included in commitments.' : 'Proposed spending is not a payment.'}</p><a class="btn text" href="#/treasury">Open treasury <span>↗</span></a></div></section>`;
}
function steps(p) {
  const index = { Draft: 0, Discussion: 0, Ready: 1, Voting: 2, Approved: 3, Completed: 3 }[
    p.status
  ];
  return `<div class="steps" aria-label="Proposal stage: ${esc(p.status)}">${['Discussion', 'Ready', 'Voting', 'Execution'].map((name, i) => `${i ? '<span class="step-line" aria-hidden="true"></span>' : ''}<span class="step ${index === i ? 'active' : ''}"><span>${i < index ? '✓' : i + 1}</span>${name}</span>`).join('')}</div>`;
}
function proposalContent(p) {
  if (selectedTab === 'Discussion') return discussion(p);
  if (selectedTab === 'Activity')
    return `<h3>Proposal activity</h3>${[...state.activities.filter((a) => a.proposal === p.id).map((a) => [a.title, date(a.date)]), ['Current stage: ' + p.status, 'Illustrative workflow'], ['Revision ' + p.revision + ' published for review', 'Sample proposal history'], ['Proposal created by ' + displayName(p.author), 'Sample proposal history']].map(([title, subtitle]) => `<div class="activity-row"><span class="activity-mark">○</span><div><strong>${esc(title)}</strong><small>${esc(subtitle)}</small></div></div>`).join('')}`;
  if (selectedTab === 'Revisions')
    return `<h3>Revision ${p.revision} · current</h3><p>${esc(p.summary)}</p><div class="notice">${p.id === 12 ? 'Revision 3 clarifies the first milestone: a usable end-to-end onboarding flow is included in the public demo. The requested amount remains 12,000 GNOT.' : 'This is the current example version. Creating and signing immutable on-chain revisions is outside this prototype.'}</div><h3>Review before voting</h3><p>The amount, recipient and delivery milestones belong to the reviewed version. A later edit must be visible as a new revision.</p><button class="btn" data-action="tab" data-tab="Details">Read current proposal</button>`;
  return `<h3>Summary</h3><p>${esc(p.summary)}</p><h3>What we’re proposing</h3><p>${esc(p.body)}</p><h3>Milestones & delivery</h3>${p.milestones.map((m, i) => `<div class="milestone"><span class="index">${i + 1}</span><div><strong>${esc(m)}</strong><small>${i === 0 ? 'First delivery' : 'Final delivery'} · evidence reviewed before payment</small></div><b class="num">${num(p.amount / 2)} GNOT</b></div>`).join('')}${p.status === 'Voting' ? voteBlock(p) : ''}<div class="detail-action"><span class="small">${p.status === 'Completed' ? 'Delivery and payment shown as an example.' : 'Discussion, approval and payment remain separate steps.'}</span>${p.status === 'Approved' ? `<button class="btn primary" data-action="pay" data-id="${p.id}">Review demo payment</button>` : p.author === OWN_ID && ['Discussion', 'Ready'].includes(p.status) ? `<button class="btn primary" data-action="advance" data-id="${p.id}">${p.status === 'Discussion' ? 'Mark ready for voting' : 'Start demo vote'}</button>` : `<button class="btn primary" data-action="tab" data-tab="Discussion">Join the discussion <span>↗</span></button>`}</div>`;
}
function voteBlock(p) {
  const chosen = state.votes[p.id];
  const tallies =
    p.author === OWN_ID ? { Yes: 0, No: 0, Abstain: 0 } : { Yes: 12, No: 2, Abstain: 1 };
  if (chosen) tallies[chosen]++;
  const total = Math.max(
    1,
    Object.values(tallies).reduce((a, b) => a + b, 0)
  );
  return `<h3>Community vote <span class="badge">Simulation</span></h3><p>One example member, one vote. No on-chain ballot is submitted.</p>${Object.entries(
    tallies
  )
    .map(
      ([choice, count]) =>
        `<div class="vote-bar vote-${choice.toLowerCase()}"><div class="vote-label"><span>${choice}</span><span>${count} · ${num((count / total) * 100)}%</span></div><progress class="vote-progress" value="${count}" max="${total}" aria-label="${choice}: ${count} example votes"></progress></div>`
    )
    .join(
      ''
    )}<div class="vote-options">${['Yes', 'No', 'Abstain'].map((c) => `<button class="btn" data-action="vote" data-id="${p.id}" data-vote="${c}" aria-pressed="${chosen === c}">${c}</button>`).join('')}</div><p class="small">${chosen ? `Your demo vote: ${esc(chosen)}. You can change it.` : 'Choose a vote to review it.'}</p>`;
}
function discussion(p) {
  return `${p.comments.length ? p.comments.map((c) => `<article class="comment">${avatar(c.author)}<div class="comment-body"><div class="comment-meta">${profileLink(c.author)}<time datetime="${esc(c.date)}">${date(c.date)}</time></div><p>${esc(c.body)}</p></div></article>`).join('') : '<div class="empty"><strong>Start the conversation</strong>Ask a question or share a useful suggestion.</div>'}<form id="comment-form" class="comment-form" data-id="${p.id}"><label for="comment">${state.connected ? `Comment as ${esc(displayName(OWN_ID))}` : 'Your comment'}</label><textarea id="comment" name="comment" maxlength="3000" required placeholder="What would make this proposal better?">${esc(state.drafts[`comment-${p.id}`] || '')}</textarea>${state.connected && !state.profile.name ? '<div class="identity-prompt"><span>You can post with your wallet, or choose a name.</span><button type="button" class="btn text" data-action="register">Get a Gno name ↗</button></div>' : ''}<div class="form-actions"><span class="muted">Local demo comment · saved in this browser</span><button class="btn primary" type="submit">${state.connected ? 'Post comment' : 'Connect to comment'}</button></div></form>`;
}
function proposalsView() {
  const p = currentProposal();
  const open = state.proposals.filter((p) =>
    ['Draft', 'Discussion', 'Ready', 'Voting'].includes(p.status)
  ).length;
  return (
    titleBlock(
      'COSMOOT COMMUNITY · GNO',
      'Community decisions',
      'From a good idea to a shared decision.',
      '<span class="badge">Interactive prototype</span><button class="btn primary" data-action="new-proposal"><span>＋</span> New proposal</button>'
    ) +
    stats([
      ['Open proposals', open, ''],
      ['Treasury balance · sample', num(budgetFor(state).balance), 'GNOT'],
      ['Community profiles · sample', people().length, '']
    ]) +
    `<div class="workspace"><aside class="panel inbox" aria-label="Proposal inbox"><div class="panel-top"><h2>Proposals</h2><span class="count">${state.proposals.length}</span></div><div class="inbox-tools"><div class="search-wrap"><span class="search-icon" aria-hidden="true">⌕</span><input id="proposal-search" aria-label="Search proposals" placeholder="Search proposals…" value="${esc(proposalQuery)}"></div><div class="filter-row" aria-label="Filter proposals">${['All', 'Open', 'Closed'].map((f) => `<button class="filter ${proposalFilter === f ? 'active' : ''}" data-action="proposal-filter" data-filter="${f}" aria-pressed="${proposalFilter === f}">${f}</button>`).join('')}</div></div><div class="proposal-list">${proposalRows()}</div></aside><section class="panel detail" aria-label="Selected proposal"><div class="detail-head"><div class="detail-meta"><span class="mono">#${String(p.id).padStart(3, '0')}</span><span class="badge light"><span class="dot"></span>${esc(p.status === 'Discussion' ? 'In discussion' : p.status)}</span><span>${esc(p.topic)}</span></div><h2 tabindex="-1" id="proposal-heading">${esc(p.title)}</h2><div class="byline">${avatar(p.author, 'small')}<span>Proposed by ${profileLink(p.author)}</span><span class="dot-divider">·</span><span>Revision ${p.revision}</span></div><div class="proposal-facts"><div class="fact"><p>Requested funding</p><strong class="num">${num(p.amount)} <span>GNOT</span></strong></div><div class="fact"><p>Delivery window</p><strong>${esc(p.duration)}</strong></div><div class="fact wide"><p>Recipient</p><strong class="small">${esc(p.recipient)}</strong></div></div>${steps(p)}</div><div class="tabs" role="tablist" aria-label="Proposal sections">${['Details', 'Discussion', 'Revisions', 'Activity'].map((tab) => `<button id="tab-${tab.toLowerCase()}" role="tab" aria-controls="proposal-panel" aria-selected="${selectedTab === tab}" tabindex="${selectedTab === tab ? 0 : -1}" class="tab ${selectedTab === tab ? 'active' : ''}" data-action="tab" data-tab="${tab}">${tab}${tab === 'Discussion' ? ` <span class="count">${p.comments.length}</span>` : ''}</button>`).join('')}</div><div class="detail-body" id="proposal-panel" role="tabpanel" aria-labelledby="tab-${selectedTab.toLowerCase()}">${proposalContent(p)}</div></section><aside class="side-stack">${budgetPanel(p)}<section class="panel"><div class="panel-top"><h2>People behind the proposal</h2></div><div class="side-content"><div class="side-row">${avatar(p.author)}<div><strong>${profileLink(p.author)}</strong><small>Proposal author</small></div></div><div class="side-row">${avatar('wallet-demo-jules')}<div><strong>${profileLink('wallet-demo-jules')}</strong><small>Community steward</small></div></div><p class="small-note">One recognizable name across proposals, comments and your community profile.</p><a class="btn text" href="#/people">Meet the community ↗</a></div></section></aside></div>`
  );
}
function personCard(p) {
  return `<a href="#/people/${esc(p.id)}" class="person-card"><div class="card-head">${avatar(p.id)}<div><h3>${esc(displayName(p.id))}</h3><div class="role">${esc(p.role)}</div></div></div><p class="bio">${esc(p.bio)}</p><div class="social-mini">${p.telegram ? '<span>↗ Telegram</span>' : ''}${p.telegram && p.discord ? '<span class="dot-divider">·</span>' : ''}${p.discord ? '<span>◈ Discord</span>' : ''}${!p.telegram && !p.discord ? '<span>No linked accounts yet</span>' : ''}</div><div class="card-foot"><span>${p.proposals} proposals &nbsp; · &nbsp; ${p.comments} comments</span><span class="arrow">↗</span></div></a>`;
}
function peopleCards() {
  const list = people().filter(
    (p) =>
      `${displayName(p.id)} ${p.role} ${p.bio}`.toLowerCase().includes(peopleQuery.toLowerCase()) &&
      (peopleFilter === 'All people' ||
        (peopleFilter === 'With a name' ? Boolean(p.name) : Boolean(p.telegram || p.discord)))
  );
  return list.length
    ? list.map(personCard).join('')
    : '<div class="empty"><strong>No matching people</strong>Try another name or remove a filter.</div>';
}
function peopleView() {
  return (
    titleBlock(
      'THE COMMUNITY',
      'People',
      'Know the people behind the proposals.',
      '<button class="btn" data-action="my-profile">My profile ↗</button>'
    ) +
    `<section class="people-intro"><div><div class="eyebrow">A NAME. A PROFILE. YOUR CONTRIBUTIONS.</div><h2>Be recognizable.<br>Wherever you contribute.</h2><p>Bring your Gno name, proposals and community accounts together. Your contributions stay connected to your wallet.</p></div><div class="name-promo"><h3>${state.profile.name ? `${esc(state.profile.name)}.gno is yours in this demo` : 'Your place starts with a name'}</h3><p>${state.profile.name ? 'Manage your name and add the accounts your community knows you by.' : 'Try choosing a Gno name. It becomes your name across Cosmoot.'}</p><button class="btn primary" data-action="${state.profile.name ? 'my-profile' : 'register'}">${state.profile.name ? 'Open my profile' : 'Find your Gno name'} <span>↗</span></button></div></section><div class="people-tools"><div class="filter-row">${['All people', 'With a name', 'Social accounts'].map((f) => `<button class="filter ${peopleFilter === f ? 'active' : ''}" data-action="people-filter" data-filter="${f}" aria-pressed="${peopleFilter === f}">${f}</button>`).join('')}</div><div class="search-wrap"><span class="search-icon" aria-hidden="true">⌕</span><input id="people-search" aria-label="Search people" placeholder="Search names, roles, interests…" value="${esc(peopleQuery)}"></div></div><div class="people-grid">${peopleCards()}</div><p class="legend">All community members shown here are illustrative profiles. Account badges below are demo states, not real identity checks.</p>`
  );
}
function connectionRow(platform, p, own) {
  const handle = p[platform];
  const proof = own ? state.profile[`${platform}Proof`] : Boolean(handle);
  const title = platform === 'telegram' ? 'Telegram' : 'Discord';
  return `<div class="connection"><span class="social-icon" aria-hidden="true">${platform === 'telegram' ? '↗' : '◈'}</span><div class="connection-info"><strong>${title}</strong><p>${handle ? `@${esc(handle)}` : 'No account linked'}</p>${handle ? `<span class="badge">${proof ? 'Demo connection · simulated' : 'Self-entered · unverified'}</span>` : ''}</div>${own ? `<div class="connection-actions">${handle ? `<button class="btn text" data-action="social-remove" data-platform="${platform}">Remove</button>` : ''}<button class="btn" data-action="social" data-platform="${platform}">${handle ? 'Manage' : 'Link account'}</button></div>` : ''}</div>`;
}
function profileView(id) {
  const p = people().find((item) => item.id === id);
  if (!p)
    return `<div class="empty"><strong>Profile not found</strong><a href="#/people">Back to people</a></div>`;
  const own = p.id === OWN_ID;
  const contributions = state.proposals.filter(
    (item) => item.author === p.id || item.comments.some((c) => c.author === p.id)
  );
  return `<div class="profile-top"><a class="back-link" href="#/people">← All people</a>${own ? '<button class="btn" data-action="edit-profile">Edit profile</button>' : ''}</div><div class="profile-layout"><aside class="panel profile-summary">${avatar(p.id, 'large')}<h1>${esc(displayName(p.id))}</h1><span class="badge">${esc(p.role)}</span><p class="bio">${esc(p.bio)}</p><dl class="ledger"><div><dt>Proposals</dt><dd>${p.proposals}</dd></div><div><dt>Comments</dt><dd>${p.comments}</dd></div></dl><details class="small-note"><summary>Identity details</summary><p class="small">Display name: ${p.name ? 'GNS concept' : 'wallet fallback'}<br>The .gno suffix is a display convention in this prototype.</p><p class="mono">${esc(p.id)}</p><p>Illustrative wallet identifier. Contributions and social records are associated with this wallet, not with a transferable name.</p></details></aside><div class="panel"><section class="profile-section"><h2>Community accounts</h2><p>Help your community recognize you across platforms.</p>${connectionRow('telegram', p, own)}${connectionRow('discord', p, own)}<p class="small-note">Entered handles are not proof of ownership. This demo can simulate an account confirmation; real Telegram login and Discord authorization are not connected.</p></section>${own ? `<section class="profile-section"><h2>Your Gno name</h2><p>${p.name ? `<strong>${esc(p.name)}.gno</strong> · Demo registration${state.profile.expires ? ` · expires ${date(state.profile.expires)}` : ''}` : 'Use one name across your profile, proposals and comments. A name is optional.'}</p><div class="form-actions"><span class="muted">Registration is simulated.</span><button class="btn primary" data-action="${p.name ? 'renew' : 'register'}">${p.name ? 'Renew name' : state.registration ? 'Resume name registration' : 'Find a name'}</button></div></section>` : ''}<section class="profile-section"><h2>Contributions</h2><p>Conversations and proposals connected to this wallet.</p>${contributions.length ? contributions.map((item) => `<div class="activity-row"><span class="activity-mark">↳</span><div><strong><a class="inline-link" href="#/proposals/${item.id}">${esc(item.title)}</a></strong><small>#${String(item.id).padStart(3, '0')} · ${item.author === p.id ? 'Proposal author' : 'Joined the discussion'} · ${esc(item.status)}</small></div></div>`).join('') : '<div class="empty">Your first proposal or comment will appear here.</div>'}</section></div></div>`;
}
function treasuryView() {
  const b = budgetFor(state);
  const commitments = state.proposals.filter((p) => p.status === 'Approved');
  const paid = state.proposals.filter((p) => state.paid.includes(p.id));
  return (
    titleBlock(
      'COSMOOT COMMUNITY · GNO',
      'Community treasury',
      'A clear view of funds, commitments and payments.',
      '<span class="badge">Illustrative balances</span>'
    ) +
    stats([
      ['Treasury balance', num(b.balance), 'GNOT'],
      ['Approved commitments', num(b.committed), 'GNOT'],
      ['Available after reserve', num(b.available), 'GNOT']
    ]) +
    `<div class="treasury-grid"><div><section class="panel"><div class="panel-top"><h2>Assets</h2><span class="small muted">Example wallet</span></div><div class="table-scroll" role="region" aria-label="Treasury assets" tabindex="0"><table><thead><tr><th>Asset</th><th class="align-right">Balance</th><th class="align-right">Illustrative value</th></tr></thead><tbody><tr><td><div class="asset-name"><span class="asset-icon">g</span><div>GNOT<small>Gno native token</small></div></div></td><td class="align-right num">${num(b.balance, 2)} GNOT</td><td class="align-right num">$${num(b.balance * 0.05, 2)}<small>Assumed $0.05 / GNOT</small></td></tr></tbody></table></div></section><div class="spacer"></div><section class="panel"><div class="panel-top"><h2>Approved commitments</h2><span class="count">${commitments.length}</span></div>${commitments.length ? `<div class="table-scroll" role="region" aria-label="Approved commitments" tabindex="0"><table><thead><tr><th>Proposal</th><th class="align-right">Outstanding</th><th>Payment</th></tr></thead><tbody>${commitments.map((p) => `<tr><td><a class="inline-link" href="#/proposals/${p.id}">${esc(p.title)}</a><small>#${String(p.id).padStart(3, '0')} · Approved, not paid</small></td><td class="align-right num">${num(p.amount)} GNOT</td><td><button class="btn" data-action="pay" data-id="${p.id}">Review</button></td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">No outstanding example commitments.</div>'}</section><div class="spacer"></div><section class="panel"><div class="panel-top"><h2>Payment history</h2><span class="badge">Sample + local demo</span></div><div class="table-scroll" role="region" aria-label="Payment history" tabindex="0"><table><thead><tr><th>Payment</th><th class="align-right">Amount</th><th>Status</th></tr></thead><tbody>${paid.map((p) => `<tr><td>${esc(p.title)}<small>Simulated in this browser</small></td><td class="align-right num">−${num(p.amount)} GNOT</td><td><span class="badge">Demo paid</span></td></tr>`).join('')}<tr><td>Contributor handbook<small>Example opening history · already included in balance</small></td><td class="align-right num">−1,500 GNOT</td><td><span class="badge">Example paid</span></td></tr></tbody></table></div></section></div><aside class="side-stack"><section class="panel"><div class="panel-top"><h2>Available to allocate</h2></div><div class="side-content"><dl class="ledger"><div><dt>Current balance</dt><dd>${num(b.balance)}</dd></div><div><dt>Approved commitments</dt><dd>−${num(b.committed)}</dd></div><div><dt>Operating reserve</dt><dd>−1,000</dd></div><div class="total"><dt>Available GNOT</dt><dd>${num(b.available)}</dd></div></dl><p class="legend">Open proposals are shown when reviewing each decision. They are not counted as approved commitments.</p></div></section><section class="panel"><div class="side-content"><div class="eyebrow">FROM DECISION TO DELIVERY</div><h3 class="side-heading">Approval is a commitment.</h3><p class="legend">A payment is a separate action. Review its recipient and amount, then confirm the simulation. The treasury changes only when that payment is recorded.</p><a class="btn text" href="#/proposals">Review proposals ↗</a></div></section></aside></div>`
  );
}
function render() {
  const route = getRoute();
  app.innerHTML = shell(route.page);
  $('#main').innerHTML =
    route.page === 'proposals'
      ? proposalsView()
      : route.page === 'treasury'
        ? treasuryView()
        : route.id
          ? profileView(route.id)
          : peopleView();
  document.title = `Cosmoot · ${route.page[0].toUpperCase() + route.page.slice(1)} · Gno demo`;
}
function modal(title, body, context = {}) {
  returnFocus = document.activeElement;
  modalContext = context;
  dialog.innerHTML = `<div class="dialog-head"><div><div class="eyebrow">COSMOOT · INTERACTIVE DEMO</div><h2 id="dialog-title">${title}</h2></div><button class="btn icon" data-action="close" aria-label="Close dialog">×</button></div><div class="dialog-body">${body}</div>`;
  if (!dialog.open) dialog.showModal();
  const focus =
    dialog.querySelector('[autofocus], input, textarea, select') || dialog.querySelector('button');
  if (focus) focus.focus();
}
function closeModal() {
  dialog.close();
  if (returnFocus?.isConnected) returnFocus.focus();
  else $('.header-right button')?.focus();
}
function requireConnection(next) {
  if (state.connected) {
    next();
    return;
  }
  modal(
    'Explore with a demo wallet',
    '<p>Try names, comments and profiles with an example wallet. No extension, real account or funds are needed.</p><div class="notice">All actions are simulations. Your entries stay in this browser and are not shared with other visitors.</div><div class="form-actions"><button class="btn" data-action="close">Cancel</button><button class="btn primary" data-action="confirm-connect">Use demo wallet</button></div>',
    { afterConnect: next }
  );
}
function nameModal(renew = false) {
  requireConnection(() => {
    if (state.registration && !renew) {
      registrationReview();
      return;
    }
    if (state.profile.name && !renew) {
      navigate(`/people/${OWN_ID}`);
      return;
    }
    modal(
      renew ? 'Renew your Gno name' : 'Find your Gno name',
      `<p>${renew ? 'Extend your example registration. No renewal is sent to Gno.' : 'One name for your profile, proposals and comments. Try the registration journey.'}</p><form id="name-form"><div class="field"><label for="name-input">Gno name</label><input id="name-input" name="name" autocomplete="off" maxlength="67" placeholder="yourname" value="${esc(renew ? state.profile.name : state.drafts.name || '')}" ${renew ? 'readonly' : ''} required><small>Letters and numbers · .gno is the display suffix</small></div><div class="field"><label for="name-years">Registration period</label><select id="name-years" name="years"><option value="1">1 year</option><option value="2">2 years</option><option value="3">3 years</option></select></div><div id="name-quote"></div><div class="form-error" id="name-error" role="alert"></div><div class="form-actions"><button type="button" class="btn" data-action="close">Cancel</button><button class="btn primary" type="submit">${renew ? 'Review renewal' : 'Review registration'}</button></div></form>`,
      { renew }
    );
    updateQuote();
  });
}
function updateQuote() {
  if (!$('#name-input')) return;
  const q = quoteName($('#name-input').value, Number($('#name-years').value));
  const free = q.valid && availableName(q.name, modalContext.renew ? state.profile.name : '');
  $('#name-quote').innerHTML = q.valid
    ? `<div class="quote-box"><div class="quote-name">${esc(q.name)}.gno</div><span class="available-label">${free ? (modalContext.renew ? 'Your demo name' : 'Available in this demo') : 'Taken in the example directory'}</span><div class="quote-row"><span>${q.years} year${q.years > 1 ? 's' : ''}</span><strong>${money(q.amount)} GNOT</strong></div><div class="quote-row muted"><span>At assumed $0.05 / GNOT</span><span>≈ $${num(q.usd, 2)}</span></div><p class="small-note">Illustrative quote using GNS code defaults, not a live fee or availability check. Network and storage costs are excluded.</p></div>`
    : '<p class="legend">Enter a name to see an illustrative registration quote.</p>';
}
function registrationReview() {
  const reg = state.registration;
  if (!reg) return nameModal();
  const q = reg.quote;
  modal(
    reg.renew
      ? 'Review demo renewal'
      : reg.committed
        ? 'Finish your registration'
        : 'Review your name',
    `<div class="quote-box"><div class="quote-name">${esc(q.name)}.gno</div><div class="quote-row"><span>${reg.renew ? 'Extend by' : 'Registration period'}</span><strong>${q.years} year${q.years > 1 ? 's' : ''}</strong></div><div class="quote-row"><span>Illustrative name fee</span><strong>${money(q.amount)} GNOT</strong></div><div class="quote-row muted"><span>Assumed $0.05 / GNOT</span><span>≈ $${num(q.usd, 2)}</span></div></div><div class="notice">${reg.renew ? 'This extends the local demo expiry only.' : reg.committed ? 'Your demo commitment is saved. Real GNS uses a waiting period between commit and registration; this prototype skips that wait.' : 'A real registration uses a commitment before registering the name. This demo saves that step locally, so you can close and resume it.'} No funds will be spent.</div><p class="legend">This is not a live GNS quote. Network and storage costs are not included.</p><div class="form-actions"><button class="btn" data-action="cancel-registration">Discard</button><button class="btn primary" data-action="${reg.renew || reg.committed ? 'finish-registration' : 'commit-registration'}">${reg.renew ? 'Simulate renewal' : reg.committed ? 'Simulate registration' : 'Save demo commitment'}</button></div>`
  );
}
function socialModal(platform) {
  requireConnection(() => {
    const title = platform === 'telegram' ? 'Telegram' : 'Discord';
    modal(
      `Link ${title}`,
      `<p>Add the handle people know you by. Entering a handle does not verify ownership.</p><form id="social-form" data-platform="${platform}"><div class="field"><label for="social-handle">${title} username</label><input id="social-handle" name="handle" required maxlength="32" autocomplete="off" value="${esc(state.profile[platform])}" placeholder="${platform === 'telegram' ? 'your_username' : 'your.username'}"><small>${platform === 'telegram' ? '5–32 letters, numbers or underscores; start with a letter.' : '2–32 letters, numbers, underscores or periods.'}</small></div><div class="notice">Save it as unverified, or simulate the account-confirmation step. No ${title} login or authorization occurs in this prototype.</div><div class="form-error" id="social-error" role="alert"></div><div class="form-actions"><button class="btn" type="submit" name="mode" value="save">Save as unverified</button><button class="btn primary" type="submit" name="mode" value="simulate">Simulate connection</button></div></form>`
    );
  });
}
function createModal() {
  requireConnection(() => {
    const d = state.drafts.proposal || {};
    modal(
      'Start a proposal',
      `<p>A clear idea, an explicit request and a place for the community to discuss it.</p><form id="proposal-form"><div class="field"><label for="new-title">Proposal title</label><input name="title" id="new-title" required maxlength="90" value="${esc(d.title)}" placeholder="What should we work on?"></div><div class="field"><label for="new-body">What do you propose?</label><textarea name="body" id="new-body" required maxlength="6000" rows="4" placeholder="Explain the idea, the benefit and what you will deliver.">${esc(d.body)}</textarea></div><div class="form-row"><div class="field"><label for="new-amount">Requested GNOT</label><input id="new-amount" name="amount" type="number" min="0" max="1000000" step="1" required value="${esc(d.amount ?? '')}" placeholder="12000"></div><div class="field"><label for="new-duration">Delivery window</label><select id="new-duration" name="duration">${['2 weeks', '4 weeks', '6 weeks', '3 months'].map((v) => `<option ${d.duration === v ? 'selected' : ''}>${v}</option>`).join('')}</select></div></div><div class="form-error" id="proposal-error" role="alert"></div><div class="form-actions"><span class="muted">Local draft · no on-chain publication</span><button type="button" class="btn" data-action="close">Save & close</button><button class="btn primary" type="submit">Open for demo discussion</button></div></form>`
    );
  });
}
function record(title, proposal) {
  state.activities.unshift({ title, proposal, date: new Date().toISOString() });
}
const actions = {
  close: closeModal,
  connect: () =>
    requireConnection(() => {
      render();
      toast('Demo wallet connected. No real wallet is connected.');
    }),
  'confirm-connect': () => {
    const next = modalContext.afterConnect;
    state.connected = true;
    save();
    closeModal();
    render();
    next?.();
  },
  account: () =>
    modal(
      'Your demo account',
      `<div class="side-row">${avatar(OWN_ID)}<div><strong>${esc(displayName(OWN_ID))}</strong><p class="small muted">Example wallet · local profile</p></div></div><div class="spacer"></div><div class="account-menu"><button class="btn" data-action="my-profile">My profile ↗</button><button class="btn" data-action="${state.profile.name ? 'renew' : 'register'}">${state.profile.name ? 'Manage my name' : 'Get a Gno name'}</button><button class="btn" data-action="disconnect">Disconnect demo wallet</button></div>`
    ),
  disconnect: () => {
    state.connected = false;
    save();
    closeModal();
    render();
    toast('Disconnected. Your demo drafts and profile are preserved.');
  },
  'my-profile': () =>
    requireConnection(() => {
      closeModal();
      navigate(`/people/${OWN_ID}`);
    }),
  register: () => nameModal(),
  renew: () => nameModal(true),
  'cancel-registration': () => {
    state.registration = null;
    save();
    nameModal();
  },
  'commit-registration': () => {
    if (state.registration) {
      state.registration.committed = true;
      save();
      registrationReview();
    }
  },
  'finish-registration': () => {
    const reg = state.registration;
    if (!reg || (!reg.renew && !reg.committed)) return;
    if (!availableName(reg.quote.name, reg.renew ? state.profile.name : '')) {
      toast('This example name is unavailable. Choose another.');
      return;
    }
    const base = reg.renew
      ? Math.max(Date.now(), new Date(state.profile.expires || 0).getTime())
      : Date.now();
    state.profile.name = reg.quote.name;
    state.profile.expires = new Date(base + reg.quote.years * 365 * 86400000).toISOString();
    state.registration = null;
    save();
    closeModal();
    render();
    modal(
      reg.renew ? 'Demo name renewed' : 'Your name is ready',
      `<div class="receipt"><div class="check">✓</div><h2>${esc(state.profile.name)}.gno</h2><p>${reg.renew ? 'The expiry was extended' : 'Your name now appears on your profile, proposals and comments'} in this browser.</p><p>No name was registered on-chain and no funds were spent.</p></div><div class="form-actions"><button class="btn" data-action="close">Continue browsing</button><button class="btn primary" data-action="my-profile">Open my profile ↗</button></div>`
    );
  },
  'edit-profile': () =>
    requireConnection(() =>
      modal(
        'Edit your profile',
        `<form id="profile-form"><div class="field"><label for="profile-bio">About you</label><textarea id="profile-bio" name="bio" maxlength="600" rows="5" placeholder="What are you working on? How can the community find you?">${esc(state.profile.bio)}</textarea><small>Up to 600 characters. Saved only in this browser.</small></div><div class="form-actions"><button class="btn" type="button" data-action="close">Cancel</button><button class="btn primary" type="submit">Save profile</button></div></form>`
      )
    ),
  social: (el) => socialModal(el.dataset.platform),
  'social-remove': (el) => {
    const key = el.dataset.platform;
    if (!['telegram', 'discord'].includes(key)) return;
    state.profile[key] = '';
    state.profile[`${key}Proof`] = false;
    save();
    render();
    toast('Account removed from your demo profile.');
  },
  'proposal-filter': (el) => {
    proposalFilter = el.dataset.filter;
    render();
  },
  'people-filter': (el) => {
    peopleFilter = el.dataset.filter;
    render();
  },
  tab: (el) => {
    selectedTab = el.dataset.tab;
    render();
    $(`#tab-${selectedTab.toLowerCase()}`)?.focus({ preventScroll: true });
  },
  'new-proposal': createModal,
  advance: (el) =>
    requireConnection(() => {
      const p = state.proposals.find((p) => p.id === Number(el.dataset.id));
      if (!p || p.author !== OWN_ID) return;
      if (p.status === 'Discussion') p.status = 'Ready';
      else if (p.status === 'Ready') p.status = 'Voting';
      else return;
      record(`Moved to ${p.status} · demo`, p.id);
      save();
      render();
      toast(`Proposal moved to ${p.status.toLowerCase()} in this demo.`);
    }),
  vote: (el) =>
    requireConnection(() =>
      modal(
        'Review your demo vote',
        `<p>${esc(currentProposal().title)}</p><div class="quote-box"><div class="quote-row"><span>Your choice</span><strong>${esc(el.dataset.vote)}</strong></div><div class="quote-row"><span>Voting as</span><strong>${esc(displayName(OWN_ID))}</strong></div></div><p class="legend">This changes the illustrative tally only. No transaction or real vote is submitted.</p><div class="form-actions"><button class="btn" data-action="close">Cancel</button><button class="btn primary" data-action="confirm-vote" data-id="${el.dataset.id}" data-vote="${esc(el.dataset.vote)}">Confirm demo vote</button></div>`
      )
    ),
  'confirm-vote': (el) => {
    const p = state.proposals.find((p) => p.id === Number(el.dataset.id));
    if (
      !p ||
      p.status !== 'Voting' ||
      !['Yes', 'No', 'Abstain'].includes(el.dataset.vote) ||
      !state.connected
    )
      return;
    state.votes[p.id] = el.dataset.vote;
    record(`Demo vote: ${el.dataset.vote}`, p.id);
    save();
    closeModal();
    render();
    toast('Demo vote saved. No on-chain ballot was submitted.');
  },
  pay: (el) =>
    requireConnection(() => {
      const p = state.proposals.find((p) => p.id === Number(el.dataset.id));
      if (!p || p.status !== 'Approved') return;
      modal(
        'Review demo payment',
        `<p>${esc(p.title)}</p><div class="quote-box"><div class="quote-row"><span>Recipient</span><strong>${esc(p.recipient)}</strong></div><div class="quote-row"><span>Amount</span><strong>${num(p.amount)} GNOT</strong></div></div><div class="notice">This simulates the payment after delivery review. It reduces the example treasury balance and releases this commitment. No GNOT is transferred.</div><div class="form-actions"><button class="btn" data-action="close">Cancel</button><button class="btn primary" data-action="confirm-pay" data-id="${p.id}">Simulate payment</button></div>`
      );
    }),
  'confirm-pay': (el) => {
    if (!state.connected || !payProposal(state, Number(el.dataset.id))) return;
    record('Payment simulated after delivery review', Number(el.dataset.id));
    save();
    closeModal();
    render();
    toast('Demo payment recorded. No funds were transferred.');
  },
  about: () =>
    modal(
      'A workspace for Gno communities',
      '<p>Explore proposals, treasury decisions and people in a single Cosmoot workspace.</p><div class="notice">This is an interactive design concept. All people, proposals, balances, votes, wallet connections and registrations are illustrative. There is no blockchain, GNS, Telegram or Discord connection.</div><p>Profile edits, comments and actions are saved in this browser only. Another device starts with a fresh demo. GNS price examples use code defaults and an assumed GNOT price of $0.05.</p><p>The demo is accessible to anyone with its URL. It is not linked from the main site and asks search engines not to index it; it is not a private access-controlled area.</p><div class="form-actions"><button class="btn primary" data-action="close">Back to the demo</button></div>'
    ),
  reset: () =>
    modal(
      'Reset this demo?',
      '<p>This clears only the demo profile, comments, proposals and simulated actions saved in this browser. Start again with the original examples.</p><div class="form-actions"><button class="btn" data-action="close">Keep my changes</button><button class="btn primary" data-action="confirm-reset">Reset demo</button></div>'
    ),
  'confirm-reset': () => {
    state = initialState();
    save();
    selectedTab = 'Details';
    proposalFilter = 'All';
    proposalQuery = '';
    peopleQuery = '';
    peopleFilter = 'All people';
    closeModal();
    navigate('/proposals/12');
    render();
    toast('Demo reset to the original examples.');
  }
};
document.addEventListener('click', (event) => {
  if (event.target.closest('.skip-link')) {
    event.preventDefault();
    $('#main').setAttribute('tabindex', '-1');
    $('#main').focus();
    return;
  }
  const el = event.target.closest('[data-action]');
  if (el && actions[el.dataset.action]) {
    event.preventDefault();
    actions[el.dataset.action](el);
  }
});
document.addEventListener('input', (event) => {
  const el = event.target;
  if (el.id === 'proposal-search') {
    proposalQuery = el.value;
    $('.proposal-list').innerHTML = proposalRows();
  }
  if (el.id === 'people-search') {
    peopleQuery = el.value;
    $('.people-grid').innerHTML = peopleCards();
  }
  if (el.id === 'comment') {
    state.drafts[`comment-${currentProposal().id}`] = el.value;
    save();
  }
  if (['name-input', 'name-years'].includes(el.id)) {
    state.drafts.name = $('#name-input').value;
    save();
    updateQuote();
  }
  if (el.closest('#proposal-form')) {
    state.drafts.proposal = Object.fromEntries(new FormData($('#proposal-form')));
    save();
  }
});
document.addEventListener('submit', (event) => {
  const form = event.target;
  event.preventDefault();
  const data = Object.fromEntries(new FormData(form));
  if (form.id === 'comment-form') {
    if (!state.connected) {
      requireConnection(() => {
        render();
        toast('Connected. Your comment is preserved; post it when ready.');
      });
      return;
    }
    const p = state.proposals.find((p) => p.id === Number(form.dataset.id));
    if (!p || !data.comment.trim()) return;
    p.comments.push({
      id: crypto.randomUUID(),
      author: OWN_ID,
      body: data.comment.trim().slice(0, 3000),
      date: new Date().toISOString()
    });
    delete state.drafts[`comment-${p.id}`];
    record('Comment added by ' + displayName(OWN_ID), p.id);
    save();
    render();
    toast('Comment saved in this browser.');
  }
  if (form.id === 'name-form') {
    const q = quoteName(data.name, Number(data.years));
    if (!q.valid || !availableName(q.name, modalContext.renew ? state.profile.name : '')) {
      $('#name-error').textContent =
        q.reason || 'This name is taken in the example directory. Try another.';
      return;
    }
    state.registration = { quote: q, renew: modalContext.renew, committed: false };
    save();
    registrationReview();
  }
  if (form.id === 'profile-form') {
    state.profile.bio = data.bio.trim().slice(0, 600);
    save();
    closeModal();
    render();
    toast('Profile saved in this browser.');
  }
  if (form.id === 'social-form') {
    const platform = form.dataset.platform;
    if (!connectSocial(state.profile, platform, data.handle)) {
      $('#social-error').textContent = 'Check the username format shown above.';
      return;
    }
    const simulated = event.submitter?.value === 'simulate';
    state.profile[`${platform}Proof`] = simulated;
    save();
    closeModal();
    render();
    toast(
      simulated
        ? 'Simulated connection saved. This is not a real account verification.'
        : 'Username saved as unverified.'
    );
  }
  if (form.id === 'proposal-form') {
    const amount = Number(data.amount);
    if (
      !data.title.trim() ||
      !data.body.trim() ||
      !Number.isSafeInteger(amount) ||
      amount < 0 ||
      amount > 1000000
    ) {
      $('#proposal-error').textContent =
        'Add a title and description, and enter a whole amount from 0 to 1,000,000 GNOT.';
      return;
    }
    const id = Math.max(...state.proposals.map((p) => p.id)) + 1;
    state.proposals.unshift({
      id,
      title: data.title.trim(),
      status: 'Discussion',
      topic: 'Community',
      amount,
      author: OWN_ID,
      duration: data.duration,
      revision: 1,
      summary: data.body.trim().slice(0, 220),
      body: data.body.trim(),
      milestones: ['First delivery & community review', 'Final delivery & documentation'],
      recipient: 'Your contributor team · demo wallet',
      comments: []
    });
    delete state.drafts.proposal;
    record('Local proposal opened for discussion', id);
    save();
    closeModal();
    selectedTab = 'Details';
    navigate(`/proposals/${id}`);
    toast('Proposal created locally. Other visitors cannot see it.');
  }
});
dialog.addEventListener('click', (event) => {
  if (event.target === dialog) {
    const r = dialog.getBoundingClientRect();
    if (
      event.clientX < r.left ||
      event.clientX > r.right ||
      event.clientY < r.top ||
      event.clientY > r.bottom
    )
      closeModal();
  }
});
document.addEventListener('keydown', (event) => {
  if (
    event.target.getAttribute('role') !== 'tab' ||
    !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)
  )
    return;
  event.preventDefault();
  const names = ['Details', 'Discussion', 'Revisions', 'Activity'];
  const index = names.indexOf(selectedTab);
  selectedTab =
    event.key === 'Home'
      ? names[0]
      : event.key === 'End'
        ? names.at(-1)
        : names[(index + (event.key === 'ArrowRight' ? 1 : 3)) % 4];
  render();
  $(`#tab-${selectedTab.toLowerCase()}`).focus({ preventScroll: true });
});
window.addEventListener('hashchange', () => {
  selectedTab = 'Details';
  render();
  if (
    getRoute().page === 'proposals' &&
    getRoute().id &&
    window.matchMedia('(max-width:680px)').matches
  )
    $('#proposal-heading')?.scrollIntoView({ block: 'start' });
  else window.scrollTo(0, 0);
});
render();
