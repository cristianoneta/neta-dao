import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { constants, runInNewContext } from 'node:vm';
import test from 'node:test';
import { createWorkspacePoller } from '../workspace-polling.mjs';

const flush = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
function clock() {
  let now = 0,
    next = 0;
  const tasks = new Map();
  return {
    setTimeout(fn, delay) {
      const id = ++next;
      tasks.set(id, { fn, at: now + delay });
      return id;
    },
    clearTimeout(id) {
      tasks.delete(id);
    },
    async advance(ms) {
      const end = now + ms;
      while (true) {
        const entry = [...tasks].sort((a, b) => a[1].at - b[1].at)[0];
        if (!entry || entry[1].at > end) break;
        now = entry[1].at;
        tasks.delete(entry[0]);
        entry[1].fn();
        await flush();
      }
      now = end;
      await flush();
    },
    get size() {
      return tasks.size;
    }
  };
}
function environment(view = 'home', hidden = false) {
  const timers = clock(),
    scope = new EventTarget(),
    document = new EventTarget();
  Object.assign(scope, { setTimeout: timers.setTimeout, clearTimeout: timers.clearTimeout });
  Object.assign(document, { hidden, body: { dataset: { workspaceView: view } } });
  return {
    timers,
    scope,
    document,
    view(value) {
      document.body.dataset.workspaceView = value;
      scope.dispatchEvent(new CustomEvent('neta:workspace-view', { detail: { view: value } }));
    },
    visibility(value) {
      document.hidden = value;
      document.dispatchEvent(new Event('visibilitychange'));
    }
  };
}

test('workspace polling waits for its visible view, refreshes on return and stops when disposed', async () => {
  const f = environment();
  let calls = 0;
  const poller = createWorkspacePoller({
    view: 'treasury',
    window: f.scope,
    document: f.document,
    load: async () => {
      calls++;
    },
    invalidate() {}
  });
  await f.timers.advance(300000);
  poller.changed();
  await flush();
  assert.equal(calls, 0);
  assert.equal(f.timers.size, 0);
  f.visibility(true);
  f.view('treasury');
  await f.timers.advance(300000);
  assert.equal(calls, 0);
  f.visibility(false);
  await flush();
  assert.equal(calls, 1);
  await f.timers.advance(60000);
  assert.equal(calls, 2);
  f.view('home');
  await f.timers.advance(300000);
  assert.equal(calls, 2);
  f.view('treasury');
  await flush();
  assert.equal(calls, 3);
  f.scope.dispatchEvent(new Event('pagehide'));
  await f.timers.advance(300000);
  assert.equal(calls, 3);
  f.scope.dispatchEvent(new Event('pageshow'));
  await flush();
  assert.equal(calls, 4);
  poller.dispose();
  f.visibility(true);
  f.visibility(false);
  await f.timers.advance(300000);
  assert.equal(calls, 4);
  assert.equal(f.timers.size, 0);
});

test('slow refreshes share one request; an obsolete completion cannot schedule over its replacement', async () => {
  const f = environment('treasury'),
    requests = [];
  let invalidations = 0;
  const poller = createWorkspacePoller({
    view: 'treasury',
    window: f.scope,
    document: f.document,
    load() {
      const request = deferred();
      requests.push(request);
      return request.promise;
    },
    invalidate() {
      invalidations++;
    }
  });
  const first = poller.refresh();
  assert.equal(first, poller.refresh());
  await f.timers.advance(180000);
  assert.equal(requests.length, 1);
  poller.changed();
  await flush();
  assert.equal(invalidations, 1);
  assert.equal(requests.length, 2);
  requests[0].resolve();
  await flush();
  await f.timers.advance(180000);
  assert.equal(requests.length, 2);
  assert.equal(f.timers.size, 0);
  requests[1].resolve();
  await flush();
  await f.timers.advance(60000);
  assert.equal(requests.length, 3);
  f.visibility(true);
  assert.equal(invalidations, 2);
  requests[2].resolve();
  await f.timers.advance(180000);
  assert.equal(f.timers.size, 0);
  poller.dispose();
});

test('failed refreshes report the error and permit the next refresh', async () => {
  const f = environment('treasury'),
    errors = [];
  let calls = 0;
  const poller = createWorkspacePoller({
    view: 'treasury',
    window: f.scope,
    document: f.document,
    load() {
      if (++calls === 1) throw Error('offline');
    },
    invalidate() {},
    onError: (error) => errors.push(error.message)
  });
  await flush();
  assert.deepEqual(errors, ['offline']);
  await f.timers.advance(60000);
  assert.equal(calls, 2);
  poller.dispose();
});

class Element extends EventTarget {
  constructor() {
    super();
    this.children = [];
    this.dataset = {};
    this.style = {};
    this.classList = { add() {}, remove() {}, toggle() {} };
    this.textContent = '';
  }
  append(...children) {
    this.children.push(...children);
  }
  prepend(...children) {
    this.children.unshift(...children);
  }
  replaceChildren(...children) {
    this.children = children;
  }
  setAttribute() {}
  querySelectorAll() {
    return [];
  }
  click() {
    this.dispatchEvent(new Event('click'));
  }
}
function dom(f) {
  const elements = new Map();
  const select = (selector) => {
    if (!elements.has(selector)) elements.set(selector, new Element());
    return elements.get(selector);
  };
  Object.assign(f.document, {
    querySelector: select,
    querySelectorAll: () => [],
    createElement: () => new Element(),
    createElementNS: () => new Element()
  });
  return select;
}
const treasurySource = await readFile(new URL('../treasury.js', import.meta.url), 'utf8');
async function treasury(view = 'home') {
  const f = environment(view),
    select = dom(f),
    requests = [],
    accounting = [];
  f.scope.NETA_SELECTED_DAO = 'juno';
  f.scope.NetaDaoDirectory = ['juno', 'other'].map((id) => ({
    id,
    name: id,
    network: `${id}-1`,
    mode: 'native-gov',
    snapshot: `${id}.json`,
    history: `${id}-history.json`
  }));
  f.scope.addEventListener('neta:treasury-accounting', (event) => accounting.push(event.detail));
  await runInNewContext(
    treasurySource,
    {
      window: f.scope,
      document: f.document,
      AbortController,
      CustomEvent,
      setTimeout: f.timers.setTimeout,
      clearTimeout: f.timers.clearTimeout,
      fetch(url, { signal }) {
        const response = deferred();
        // Deliberately ignore abort, as a response can already be buffered.
        requests.push({ url, signal, resolve: response.resolve });
        return response.promise;
      }
    },
    {
      filename: fileURLToPath(new URL('../treasury.js', import.meta.url)),
      importModuleDynamically: constants.USE_MAIN_CONTEXT_DEFAULT_LOADER
    }
  );
  await flush();
  return {
    ...f,
    select,
    requests,
    accounting,
    change(id) {
      f.scope.dispatchEvent(new CustomEvent('neta:dao-change', { detail: { id } }));
    },
    respond(batch, id, total) {
      for (const request of batch)
        request.resolve({
          ok: true,
          json: async () =>
            request.url.includes('-history.json')
              ? { snapshots: [] }
              : {
                  chain_id: `${id}-1`,
                  treasury_type: 'community-pool',
                  treasury_address: null,
                  generated_at: '2026-11-03T12:00:00Z',
                  status: 'LIVE',
                  assets: [],
                  total_usd: total,
                  height: 100,
                  price_source: 'fixture'
                }
        });
    }
  };
}

test('Treasury itself performs no home reads and ignores stale DAO responses and hidden replies', async () => {
  const f = await treasury();
  await f.timers.advance(180000);
  assert.equal(f.requests.length, 0);
  f.view('treasury');
  await flush();
  assert.equal(f.requests.length, 2);
  f.select('#treasury-refresh').click();
  await flush();
  assert.equal(f.requests.length, 2);
  const old = f.requests.slice();
  f.change('other');
  await flush();
  assert.equal(
    old.every((request) => request.signal.aborted),
    true
  );
  assert.equal(f.requests.length, 4);
  f.respond(f.requests.slice(2), 'other', 200);
  await flush();
  assert.equal(f.select('#treasury-total').textContent, '$200.00');
  const currentAccounting = f.accounting.at(-1);
  assert.equal(currentAccounting.dao.id, 'other');
  f.respond(old, 'juno', 100);
  await flush();
  assert.equal(f.select('#treasury-total').textContent, '$200.00');
  assert.equal(f.accounting.at(-1), currentAccounting);
  f.select('#treasury-refresh').click();
  await flush();
  const hidden = f.requests.slice(4);
  f.visibility(true);
  f.change('juno');
  const hiddenState = f.accounting.at(-1);
  f.respond(hidden, 'other', 300);
  await f.timers.advance(180000);
  assert.equal(f.requests.length, 6);
  assert.equal(
    hidden.every((request) => request.signal.aborted),
    true
  );
  assert.equal(f.accounting.at(-1), hiddenState);
  f.visibility(false);
  await flush();
  assert.equal(f.requests.length, 8);
  f.respond(f.requests.slice(6), 'juno', 400);
  await flush();
  assert.equal(f.select('#treasury-total').textContent, '$400.00');
  f.scope.dispatchEvent(new Event('pagehide'));
});

test('router clicks publish the selected workspace after updating the visible view', async () => {
  const f = environment(),
    select = dom(f);
  const buttons = ['home', 'treasury'].map((view) => {
    const button = new Element();
    button.dataset.workspaceView = view;
    return button;
  });
  f.document.querySelectorAll = (selector) => (selector === '[data-workspace-view]' ? buttons : []);
  for (const view of ['home', 'governance', 'delivery', 'people', 'treasury', 'relay'])
    select(`#${view}-view`).querySelector = (selector) => select(`#${view}-view ${selector}`);
  Object.assign(f.scope, {
    NetaDaoDirectory: [{ id: 'neta-operations', name: 'Operations' }],
    location: { hash: '#home' },
    scrollTo() {},
    matchMedia: () => ({ matches: true })
  });
  const events = [],
    relay = [];
  f.scope.addEventListener('neta:workspace-view', (event) => {
    events.push(event.detail.view);
    assert.equal(f.document.body.dataset.workspaceView, event.detail.view);
    assert.equal(select(`#${event.detail.view}-view`).hidden, false);
  });
  f.scope.addEventListener('neta:relay-panel', (event) => relay.push(event.detail));
  runInNewContext(await readFile(new URL('../ux-draft.js', import.meta.url), 'utf8'), {
    window: f.scope,
    document: f.document,
    CustomEvent,
    localStorage: { setItem() {}, getItem() {} },
    history: {
      pushState(_state, _title, hash) {
        f.scope.location.hash = hash;
      },
      replaceState(_state, _title, hash) {
        f.scope.location.hash = hash;
      }
    }
  });
  buttons[1].click();
  assert.deepEqual(events, ['home', 'treasury']);
  assert.equal(f.scope.location.hash, '#treasury');
  assert.equal(relay.length, 2, 'existing Relay consumers continue receiving their event');
});
