import { DISCUSSION_API, parseDiscussionSource } from './discussion-links.mjs';
const $ = (id) => document.getElementById(id);
const el = (tag, text = '', className = '') => {
  const e = document.createElement(tag);
  e.textContent = text;
  if (className) e.className = className;
  return e;
};
const date = (value) =>
  new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
const short = (address) =>
  address ? address.slice(0, 11) + '…' + address.slice(-6) : 'Unknown author';
const state = {
  thread: null,
  page: null,
  session: null,
  draftWallet: null,
  epoch: 0,
  navigation: 0,
  historyEpoch: 0,
  walletEpoch: 0,
  reply: null,
  quote: null,
  position: 1,
  back: null,
  observer: null,
  historyCursor: null,
  moderation: null
};
const storage = {
  get(key) {
    try {
      return JSON.parse(localStorage.getItem(key));
    } catch {
      return null;
    }
  },
  set(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  },
  remove(key) {
    localStorage.removeItem(key);
  }
};
// Keep the current tab usable even when the browser cannot persist a draft.
// Pending submission receipts still require durable storage before sending.
const draftMemory = new Map();
const readDraft = (key) => draftMemory.get(key) || storage.get(key);
function walletStorageKeys(kind) {
  const wallet = state.session?.wallet || state.draftWallet;
  if (!state.thread || !wallet) return [];
  return [state.thread.id, ...(state.thread.aliases || [])].map(
    (id) => `cosmoot-discussion-${kind}:${id}:${wallet}`
  );
}
function walletStorageKey(kind) {
  const keys = walletStorageKeys(kind);
  return (
    keys.find((key) => (kind === 'draft' ? readDraft(key) : storage.get(key)) != null) ||
    keys[0] ||
    null
  );
}
function clearMatchingDrafts(request, keys) {
  for (const key of keys) {
    const draft = readDraft(key);
    if (
      draft?.body?.trim() === request.body &&
      (draft.reply ?? null) === (request.reply ?? null) &&
      (draft.quote ?? null) === (request.quote ?? null)
    ) {
      draftMemory.delete(key);
      storage.remove(key);
    }
  }
}
const draftKey = () => walletStorageKey('draft');
const pendingKey = () => walletStorageKey('pending');
const readingKey = () => {
  const keys = [state.thread.id, ...(state.thread.aliases || [])].map(
    (id) => `cosmoot-discussion-reading:${id}`
  );
  return keys.find((key) => storage.get(key) !== null) || keys[0];
};
const pending = () => (pendingKey() ? storage.get(pendingKey()) : null);
function notice(id, text, error = false) {
  $(id).textContent = text;
  $(id).dataset.error = String(error);
}
async function api(path, { body, authenticated = false } = {}) {
  const session = state.session;
  if (authenticated && (!session || session.expires <= Date.now())) {
    expireSession();
    throw Object.assign(Error('Connect Keplr again to continue.'), { status: 401 });
  }
  const r = await fetch(DISCUSSION_API + path, {
    method: body ? 'POST' : 'GET',
    cache: 'no-store',
    credentials: 'omit',
    signal: AbortSignal.timeout(25000),
    headers: {
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(authenticated ? { authorization: 'Bearer ' + session.accessToken } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  const value = await r.json();
  if (r.status === 401 && authenticated && state.session === session) expireSession();
  if (!r.ok)
    throw Object.assign(Error(value.error || 'Discussion service unavailable.'), {
      status: r.status
    });
  return value;
}
function prose(host, text) {
  host.replaceChildren();
  const pattern = /https?:\/\/[^\s<>]+/g;
  let start = 0;
  for (const match of String(text).matchAll(pattern)) {
    host.append(document.createTextNode(text.slice(start, match.index)));
    const a = el('a', match[0]);
    a.href = match[0];
    a.target = '_blank';
    a.rel = 'noopener noreferrer nofollow ugc';
    host.append(a);
    start = match.index + match[0].length;
  }
  host.append(document.createTextNode(String(text).slice(start)));
}
function author(wallet, identity, stake = null, historical = null) {
  const box = el('div', '', 'discussion-post-author');
  if (
    identity?.status === 'verified' &&
    identity.owner === wallet &&
    identity.expires > Date.now()
  ) {
    const a = el('a', identity.name);
    a.href = '/name-profile.html?' + new URLSearchParams({ name: identity.name });
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    box.append(a);
  } else box.append(el('span', short(wallet)));
  const details = el('details'),
    summary = el('summary', short(wallet)),
    address = el('a', wallet || 'Author unavailable');
  if (wallet) {
    address.href = 'https://atomscan.com/juno/accounts/' + encodeURIComponent(wallet);
    address.target = '_blank';
    address.rel = 'noopener noreferrer';
  }
  details.append(summary, address);
  box.append(details);
  if (stake) {
    if (stake.status === 'verified' && /^\d+$/.test(stake.amountRaw)) {
      const raw = BigInt(stake.amountRaw),
        whole = (raw / 1000000n).toLocaleString('en-US'),
        fraction = (raw % 1000000n).toString().padStart(6, '0');
      const displayed =
        raw > 0n && raw < 10000n ? `0.${fraction}` : `${whole}.${fraction.slice(0, 2)}`;
      const label = el('small', `${displayed} JUNO staked at posting`);
      label.title = `${whole}.${fraction} JUNO bonded · block ${stake.height} · ${stake.time}`;
      details.append(el('p', label.title));
      box.append(label);
    } else box.append(el('small', 'JUNO stake at posting unavailable'));
  }
  if (historical?.status === 'verified' && historical.name !== identity?.name)
    box.append(el('small', `Posted as ${historical.name} · wallet unchanged`));
  return box;
}
function saveDraft() {
  if (pending()) return;
  const key = draftKey();
  if (key) {
    const draft = { body: $('discussion-reply').value, reply: state.reply, quote: state.quote };
    draftMemory.set(key, draft);
    try {
      storage.set(key, draft);
    } catch {
      notice(
        'discussion-post-status',
        'Browser storage is unavailable. Your draft is kept in this tab; keep it open.',
        true
      );
    }
  }
}
function restoreDraft() {
  const d = draftKey() ? readDraft(draftKey()) : null;
  $('discussion-reply').value = d?.body || '';
  state.reply = d?.reply || null;
  state.quote = d?.quote || null;
  renderComposer();
}
function renderComposer() {
  const locked = !!state.thread?.locked,
    saved = pending();
  if (saved) $('discussion-reply').value = saved.body;
  $('discussion-post').disabled = (!state.session && !state.draftWallet) || locked || !!saved;
  $('discussion-post').textContent =
    !state.session && state.draftWallet ? 'Reconnect Keplr to post' : 'Post reply';
  $('discussion-reply').disabled = (!state.session && !state.draftWallet) || locked || !!saved;
  $('discussion-compose-hint').textContent = locked
    ? 'This discussion is locked.'
    : !state.session
      ? state.draftWallet
        ? 'Keep writing. Reconnect Keplr before posting; your draft stays here.'
        : 'Connect Keplr to post. No transaction fee.'
      : 'Your draft is saved in this browser. Posting uses no transaction fee.';
  $('discussion-reply-context').hidden = !(state.reply || state.quote);
  $('discussion-reply-context').textContent = state.quote
    ? 'Quoting the selected post.'
    : 'Replying to the selected post.';
  $('discussion-cancel-reply').hidden = !(state.reply || state.quote);
  $('discussion-pending').hidden = !saved;
  $('discussion-send-saved').hidden = true;
  if (saved)
    notice(
      'discussion-post-status',
      'A reply may already have been received. Check its status before sending again.'
    );
  $('discussion-connect').hidden = !!state.session;
  $('discussion-disconnect').hidden = !state.session;
  $('discussion-wallet-name').hidden = !state.session;
  $('discussion-wallet-name').textContent = short(state.session?.wallet);
  $('discussion-lock').hidden = !state.session?.moderator;
  $('discussion-lock').textContent = locked ? 'Unlock discussion' : 'Lock discussion';
}
async function historyList(more = false) {
  const epoch = ++state.historyEpoch;
  const chain = 'juno-1';
  const r = await api(
    '/v1/threads?' +
      new URLSearchParams({
        chain,
        ...(more && state.historyCursor ? { before: JSON.stringify(state.historyCursor) } : {})
      })
  );

  if (epoch !== state.historyEpoch) return;
  if (!more) $('discussion-topics').replaceChildren();
  for (const t of r.threads) {
    const a = el('a');
    a.href = '/discussions.html?thread=' + t.id;
    a.append(
      el(
        'small',
        `${t.scope || 'Juno governance'} · ${t.root.startsWith('review:') ? 'Review' : 'Proposal'} #${t.root.split(':').at(-1)} · ${t.replies} ${t.replies === 1 ? 'reply' : 'replies'}`
      ),
      el('span', t.title)
    );
    if (t.id === state.thread?.id) a.setAttribute('aria-current', 'page');
    a.onclick = (e) => {
      e.preventDefault();
      saveDraft();
      window.history.pushState(null, '', a.href);
      void openLocation();
    };
    $('discussion-topics').append(a);
  }
  const last = r.threads.at(-1);
  state.historyCursor = last ? { created: last.created, id: last.id } : null;
  $('discussion-history-more').hidden = r.threads.length < 30;
  if (!$('discussion-topics').children.length)
    $('discussion-topics').append(
      el('p', 'No proposals indexed for this network yet.', 'discussion-muted')
    );
}
function trackPosition(position, time, postId = null) {
  state.position = position;
  $('discussion-position').value = String(position);
  $('discussion-position-label').textContent = `${position} / ${state.page.total + 1}`;
  $('discussion-position-date').textContent = date(time);
  const label = document.querySelector('.discussion-timeline-label'),
    rail = document.querySelector('.discussion-timeline-track');
  label.style.transform = `translateY(${state.page.total ? Math.round(((position - 1) / state.page.total) * Math.max(0, rail.clientHeight - label.offsetHeight - 16)) : 0}px)`;
  $('discussion-position').setAttribute(
    'aria-valuetext',
    `Post ${position} of ${state.page.total + 1}, ${date(time)}`
  );
  try {
    storage.set(readingKey(), { position, postId });
  } catch {
    /* Reading does not require storage. */
  }
}
function observePosts() {
  state.observer?.disconnect();
  state.observer = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((e) => e.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (visible) {
        const p = visible.target.dataset;
        trackPosition(Number(p.position), Number(p.time), p.postId ? Number(p.postId) : null);
      }
    },
    { rootMargin: '-100px 0px -55% 0px', threshold: 0 }
  );
  document.querySelectorAll('[data-position]').forEach((e) => state.observer.observe(e));
}
function button(label, action) {
  const b = el('button', label);
  b.type = 'button';
  b.onclick = action;
  return b;
}
function renderPosts(result) {
  const container = $('discussion-posts');
  container.replaceChildren();
  for (const post of result.posts) {
    const article = el('article', '', 'discussion-post');
    article.id = 'post-' + post.id;
    article.tabIndex = -1;
    article.dataset.position = post.position;
    article.dataset.time = post.created;
    article.dataset.postId = post.id;
    const header = el('header'),
      meta = el('div', '', 'discussion-post-meta'),
      link = el('a', '#' + post.position);
    link.href = `/discussions.html?thread=${result.thread.id}#post-${post.id}`;
    link.setAttribute('aria-label', `Link to post ${post.position}`);
    meta.append(el('time', date(post.created)), link);
    header.append(
      author(post.wallet, result.authors[post.wallet], post.stake, post.nameAtPosting),
      meta
    );
    article.append(header);
    if (post.imported)
      article.append(el('p', 'Imported on-chain comment · original timestamp', 'discussion-muted'));
    if (post.reply || post.quote) {
      const block = el(post.quote ? 'blockquote' : 'p'),
        target = post.quote || post.reply,
        a = el('a', post.quote ? 'View quoted post' : 'View the post being replied to');
      a.href = `/discussions.html?thread=${result.thread.id}#post-${target}`;
      a.onclick = (e) => {
        e.preventDefault();
        void jump(null, target);
      };
      block.append(a);
      const original = result.posts.find((p) => p.id === target);
      if (post.quote && original && !original.hidden)
        block.append(
          el('p', original.body.length > 300 ? original.body.slice(0, 300) + '…' : original.body)
        );
      article.append(block);
    }
    const body = el('div', '', 'discussion-post-body');
    prose(
      body,
      post.hidden ? `Post hidden by moderation${post.reason ? ': ' + post.reason : '.'}` : post.body
    );
    article.append(body);
    const actions = el('div', '', 'discussion-post-actions');
    if (!post.hidden && !result.thread.locked)
      for (const quoted of [false, true])
        actions.append(
          button(quoted ? 'Quote' : 'Reply', async () => {
            const thread = state.thread?.id;
            if (!state.session) await connect();
            if (!state.session || state.thread?.id !== thread) return;
            state.reply = post.id;
            state.quote = quoted ? post.id : null;
            saveDraft();
            renderComposer();
            $('discussion-reply').scrollIntoView({ block: 'center' });
            $('discussion-reply').focus();
          })
        );
    if (state.session?.moderator) {
      actions.append(
        button(post.hidden ? 'Restore' : 'Hide', () =>
          moderate(post.hidden ? 'restore' : 'hide', post.id)
        ),
        button('Restrict wallet', () => moderate('block', post.wallet)),
        button('Lift restriction', () => moderate('unblock', post.wallet))
      );
    }
    article.append(actions);
    container.append(article);
  }
}
async function loadThread(id, { start = 0, anchor = null, focus = false, position = null } = {}) {
  const epoch = ++state.epoch;
  const query = new URLSearchParams(anchor ? { anchor: String(anchor) } : { start: String(start) });
  const result = await api(`/v1/threads/${id}/posts?${query}`);
  if (epoch !== state.epoch) return;
  const changed = state.thread?.id !== result.thread.id;
  state.thread = result.thread;
  state.page = result;
  document.title = result.thread.title + ' · Cosmoot discussions';
  $('discussion-title').textContent = result.thread.title;
  $('discussion-phase').textContent = `${result.thread.scope || 'Juno governance'} · ${String(
    result.thread.phase
  )
    .replace(/^PROPOSAL_STATUS_/, '')
    .replaceAll('_', ' ')}`;
  $('discussion-author').replaceChildren(
    author(result.thread.author, result.authors[result.thread.author])
  );
  const native = result.thread.sources.find((s) => s.key.startsWith('native:')),
    proposal =
      native ||
      result.thread.sources.find((s) => s.key === result.thread.root) ||
      result.thread.sources[0];
  $('discussion-proposal').href = proposal.url;
  $('discussion-proposal').textContent = native ? 'View proposal & voting ↗' : 'View proposal ↗';
  const summary = result.thread.summary,
    split = summary.length > 1200 ? summary.indexOf('\n\n') : -1;
  const excerpt =
    split > 0 && split < 1200
      ? summary.slice(0, split)
      : summary.length > 1200
        ? summary.slice(0, 1200) + '…'
        : summary;
  prose($('discussion-summary'), excerpt);
  $('discussion-summary-full').hidden = excerpt === summary;
  prose($('discussion-summary-rest'), summary);
  const original = $('post-proposal');
  original.dataset.time = result.thread.created;
  original.hidden = result.start > 0;
  $('discussion-first-date').textContent = date(result.thread.created);
  const indexed = result.thread.root.startsWith('dao:');
  $('discussion-date-notice').hidden = !indexed;
  $('discussion-first').lastElementChild.textContent = indexed ? 'First indexed' : 'First post';
  $('discussion-last-date').textContent = date(result.latest || result.thread.created);
  $('discussion-position').max = String(result.total + 1);
  $('discussion-position').disabled = result.total === 0;
  $('discussion-previous').hidden = result.start === 0;
  $('discussion-next').hidden = !result.hasMore;
  $('discussion-content').hidden = false;
  $('discussion-timeline').hidden = false;
  $('discussion-retry').hidden = true;
  notice('discussion-status', '');
  if (changed) {
    $('discussion-revisions').open = false;
    $('discussion-revision-list').replaceChildren();
    $('discussion-moderation').open = false;
    $('discussion-moderation-dialog').close();
    restoreDraft();
    state.back = null;
    $('discussion-back').hidden = true;
    const saved = storage.get(readingKey());
    $('discussion-resume').hidden = !saved || saved.position < 2;
    $('discussion-resume').onclick = () => void jump(saved.position, saved.postId);
  }
  renderPosts(result);
  renderComposer();
  const focused = anchor
    ? result.posts.find((p) => p.id === anchor)
    : result.start > 0
      ? result.posts[0]
      : null;
  trackPosition(
    focused?.position || 1,
    focused?.created || result.thread.created,
    focused?.id || null
  );
  observePosts();
  if (focus) {
    const target = anchor
      ? $('post-' + anchor)
      : position === 1
        ? original
        : $('discussion-posts').firstElementChild;
    target?.scrollIntoView({ block: 'start' });
    target?.focus({ preventScroll: true });
  }
  if (changed || !$('discussion-topics').children.length) void historyList().catch(() => {});
}
async function jump(position, anchor = null, remember = true) {
  if (!state.thread) return;
  if (remember) {
    state.back = {
      position: state.position,
      postId:
        Number(document.querySelector(`[data-position="${state.position}"]`)?.dataset.postId) ||
        null
    };
    $('discussion-back').hidden = false;
  }
  try {
    await loadThread(state.thread.id, {
      start: Math.max(0, (position || 2) - 2),
      anchor,
      focus: true,
      position
    });
    if (anchor) window.history.replaceState(null, '', `?thread=${state.thread.id}#post-${anchor}`);
  } catch (e) {
    notice('discussion-status', e.message, true);
  }
}
async function openLocation() {
  const navigation = ++state.navigation;
  ++state.epoch;
  $('discussion-content').hidden = true;
  $('discussion-timeline').hidden = true;
  const params = new URLSearchParams(location.search),
    source = params.get('source');
  let id = params.get('thread');
  notice('discussion-status', 'Loading discussion…');
  $('discussion-retry').hidden = true;
  try {
    if (source) {
      const spec = parseDiscussionSource(source);
      if (spec.chainId !== 'juno-1')
        throw Error('Discussions currently support Juno mainnet governance only.');
      id = (await api('/v1/resolve?source=' + encodeURIComponent(source))).thread.id;
      if (navigation !== state.navigation) return;
    }
    if (!id) {
      $('discussion-content').hidden = true;
      $('discussion-timeline').hidden = true;
      await historyList();
      if (navigation !== state.navigation) return;
      notice('discussion-status', 'Choose a proposal to join the conversation.');
      return;
    }
    if (!/^[a-f0-9]{32}$/.test(id)) throw Error('Invalid discussion link.');
    const anchor = /^#post-([1-9]\d*)$/.exec(location.hash);
    await loadThread(id, { anchor: anchor ? Number(anchor[1]) : null, focus: !!anchor });
  } catch (e) {
    if (navigation !== state.navigation) return;
    $('discussion-content').hidden = true;
    $('discussion-timeline').hidden = true;
    notice('discussion-status', e.message, true);
    $('discussion-retry').hidden = false;
    void historyList().catch(() => {});
  }
}
async function connect() {
  saveDraft();
  const epoch = ++state.walletEpoch;
  $('discussion-connect').disabled = true;
  notice('discussion-status', 'Confirm the discussion sign-in in Keplr. No funds move.');
  try {
    if (!window.keplr?.signArbitrary)
      throw Error('Open this page in a browser with Keplr to sign in.');
    await window.keplr.enable('juno-1');
    const account = await window.keplr.getKey('juno-1'),
      wallet = account.bech32Address;
    const c = await api('/v1/challenge', { body: { wallet } }),
      message = JSON.parse(c.message);
    if (
      message.purpose !== 'COSMOOT proposal discussion sign-in v1' ||
      message.domain !== new URL(DISCUSSION_API).origin ||
      message.origin !== location.origin ||
      message.chainId !== 'juno-1' ||
      message.wallet !== wallet ||
      message.nonce !== c.nonce ||
      message.expires !== c.expires ||
      c.expires <= Date.now() ||
      c.expires > Date.now() + 130000
    )
      throw Error('Unexpected discussion sign-in request.');
    const signature = await window.keplr.signArbitrary('juno-1', wallet, c.message);
    if (
      epoch !== state.walletEpoch ||
      (await window.keplr.getKey('juno-1')).bech32Address !== wallet
    )
      throw Error('Wallet changed. Connect again.');
    const session = await api('/v1/auth', { body: { nonce: c.nonce, signature } });
    if (epoch !== state.walletEpoch || session.wallet !== wallet)
      throw Error('Wallet changed during sign-in.');
    state.session = session;
    state.draftWallet = session.wallet;
    restoreDraft();
    notice(
      'discussion-status',
      pending()
        ? 'Check your saved reply before posting again.'
        : 'Connected. You can now join the discussion.'
    );
    if (state.page) renderPosts(state.page);
  } catch (e) {
    notice('discussion-status', e.message, true);
  } finally {
    $('discussion-connect').disabled = false;
    renderComposer();
  }
}
function expireSession() {
  saveDraft();
  state.draftWallet = state.session?.wallet || state.draftWallet;
  state.session = null;
  state.walletEpoch++;
  renderComposer();
  if (state.page) renderPosts(state.page);
  notice(
    'discussion-status',
    'Your sign-in expired. Connect Keplr again; your draft is saved.',
    true
  );
}
function disconnect() {
  saveDraft();
  if (state.session) void api('/v1/logout', { body: {}, authenticated: true }).catch(() => {});
  state.walletEpoch++;
  state.session = null;
  state.draftWallet = null;
  state.reply = null;
  state.quote = null;
  $('discussion-reply').value = '';
  renderComposer();
  if (state.page) renderPosts(state.page);
  notice('discussion-post-status', 'Disconnected. Your saved draft stays in this browser.');
}
async function send(saved = false) {
  if (!state.thread) return;
  if (!state.session || state.session.expires <= Date.now()) {
    if (state.session) expireSession();
    await connect();
    // A renewed sign-in never silently posts the draft.
    if (state.session)
      notice('discussion-post-status', 'Sign-in renewed. Review your reply, then post.');
    return;
  }
  const thread = state.thread.id,
    wallet = state.session.wallet,
    epoch = state.walletEpoch,
    key = pendingKey(),
    drafts = walletStorageKeys('draft');
  let request,
    accepted = false;
  try {
    if (saved) {
      request = pending();
      if (!request) throw Error('No saved reply.');
    } else {
      if (pending()) throw Error('Check the saved reply first.');
      request = {
        body: $('discussion-reply').value.trim(),
        reply: state.reply,
        quote: state.quote,
        requestId: crypto.randomUUID()
      };
      if (!request.body) throw Error('Write a reply first.');
      saveDraft();
      storage.set(key, request);
    }
    renderComposer();
    notice('discussion-post-status', 'Posting reply…');
    const result = await api(`/v1/threads/${thread}/posts`, { body: request, authenticated: true });
    accepted = true;
    storage.remove(key);
    clearMatchingDrafts(request, drafts);
    if (
      epoch !== state.walletEpoch ||
      state.session?.wallet !== wallet ||
      state.thread?.id !== thread
    )
      return;
    restoreDraft();
    notice('discussion-post-status', 'Reply posted.');
    await loadThread(result.thread, { anchor: result.id, focus: true });
  } catch (e) {
    if (e.status === 401 && !accepted) {
      // An explicit authentication rejection means this request was not written.
      storage.remove(key);
      renderComposer();
    }
    if (epoch === state.walletEpoch) {
      if (!saved && !accepted && e.status && e.status !== 408 && e.status < 500)
        storage.remove(key);
      renderComposer();
      notice(
        'discussion-post-status',
        accepted
          ? 'Your reply was posted; refreshing the conversation failed. Use Refresh.'
          : e.message +
              (pending() ? ' Your saved reply is retained. Check its status before retrying.' : ''),
        true
      );
      if (e.status === 401) {
        disconnect();
        notice(
          'discussion-status',
          'Your sign-in expired. Connect Keplr again; your reply is saved.',
          true
        );
      }
    }
  }
}
async function checkReply() {
  const saved = pending();
  if (!saved) return;
  const key = pendingKey(),
    drafts = walletStorageKeys('draft'),
    epoch = state.walletEpoch;
  try {
    const r = await api('/v1/requests/' + saved.requestId, { authenticated: true });
    if (epoch !== state.walletEpoch) return;
    if (r.post) {
      storage.remove(key);
      clearMatchingDrafts(saved, drafts);
      restoreDraft();
      notice('discussion-post-status', 'Reply was received.');
      await loadThread(r.post.thread, { anchor: r.post.id, focus: true });
    } else {
      notice(
        'discussion-post-status',
        'This reply has not been recorded. You can send the same saved reply.'
      );
      $('discussion-send-saved').hidden = false;
    }
  } catch (e) {
    notice('discussion-post-status', e.message, true);
  }
}
function moderate(action, target) {
  state.moderation = { action, target };
  $('discussion-moderation-title').textContent =
    action[0].toUpperCase() + action.slice(1) + ' · moderation';
  $('discussion-moderation-reason').value = '';
  $('discussion-moderation-status').textContent = '';
  $('discussion-moderation-dialog').showModal();
  $('discussion-moderation-reason').focus();
}
$('discussion-connect').onclick = connect;
$('discussion-disconnect').onclick = disconnect;
window.addEventListener('keplr_keystorechange', disconnect);
window.addEventListener('popstate', () => {
  saveDraft();
  void openLocation();
});
window.addEventListener('pagehide', saveDraft);
$('discussion-reply').oninput = saveDraft;
$('discussion-composer').onsubmit = (e) => {
  e.preventDefault();
  void send();
};
$('discussion-check').onclick = checkReply;
$('discussion-send-saved').onclick = () => void send(true);
$('discussion-cancel-reply').onclick = () => {
  state.reply = null;
  state.quote = null;
  saveDraft();
  renderComposer();
};
$('discussion-retry').onclick = openLocation;
$('discussion-refresh').onclick = () =>
  void loadThread(state.thread.id, { start: state.page.start }).catch((e) =>
    notice('discussion-status', e.message, true)
  );
$('discussion-history-more').onclick = () =>
  void historyList(true).catch((e) => notice('discussion-status', e.message, true));
$('discussion-previous').onclick = () => void jump(Math.max(1, state.page.start - 28));
$('discussion-next').onclick = () => void jump(state.page.start + state.page.posts.length + 2);
$('discussion-position').oninput = () => {
  $('discussion-position-label').textContent =
    `${$('discussion-position').value} / ${state.page.total + 1}`;
  $('discussion-position-date').textContent = 'Go to post';
};
$('discussion-position').onchange = () => void jump(Number($('discussion-position').value));
$('discussion-first').onclick = () => void jump(1);
$('discussion-last').onclick = () => void jump(state.page.total + 1);
$('discussion-back').onclick = () => {
  const b = state.back;
  state.back = null;
  $('discussion-back').hidden = true;
  if (b) void jump(b.position, b.postId, false);
};
$('discussion-revisions').ontoggle = async () => {
  if (!$('discussion-revisions').open || !state.thread) return;
  const thread = state.thread;
  try {
    const result = await api(`/v1/threads/${thread.id}/revisions`);
    if (state.thread?.id !== thread.id || !$('discussion-revisions').open) return;
    $('discussion-revision-list').replaceChildren(
      ...result.revisions.map((r) =>
        el(
          'p',
          `Revision ${r.version} · ${r.payload.change_log || 'Published proposal'}\n${r.payload.summary}`
        )
      )
    );
    for (const s of thread.sources) {
      const a = el(
        'a',
        s.key.startsWith('review:') ? 'Original review ↗' : 'On-chain proposal ↗'
      );
      a.href = s.url;
      const row = el('p');
      row.append(a);
      $('discussion-revision-list').append(row);
    }
  } catch (e) {
    if (state.thread?.id === thread.id) $('discussion-revision-list').textContent = e.message;
  }
};
$('discussion-moderation').ontoggle = async () => {
  if (!$('discussion-moderation').open) return;
  try {
    const r = await api('/v1/moderation');
    $('discussion-moderation-list').replaceChildren(
      ...r.actions.map((a) =>
        el('p', `${date(a.created)} · ${a.action} ${a.target} · ${a.reason} · ${a.actor}`)
      )
    );
    if (!r.actions.length)
      $('discussion-moderation-list').textContent = 'No moderation actions recorded.';
  } catch (e) {
    $('discussion-moderation-list').textContent = e.message;
  }
};
$('discussion-lock').onclick = () =>
  moderate(state.thread.locked ? 'unlock' : 'lock', state.thread.id);
$('discussion-moderation-cancel').onclick = () => $('discussion-moderation-dialog').close();
$('discussion-moderation-confirm').onclick = async () => {
  if (!$('discussion-moderation-reason').reportValidity()) return;
  try {
    await api('/v1/moderation', {
      body: { ...state.moderation, reason: $('discussion-moderation-reason').value },
      authenticated: true
    });
    $('discussion-moderation-dialog').close();
    await loadThread(state.thread.id, { start: state.page.start });
  } catch (e) {
    $('discussion-moderation-status').textContent = e.message;
  }
};
if (matchMedia('(max-width:820px)').matches) $('discussion-history-panel').open = false;
renderComposer();
void openLocation();
