import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import { mountCosmootHome } from '../cosmoot-home.mjs';

class Element extends EventTarget {
  dataset = {};
  attributes = new Map();
  hidden = false;
  style = {};
  children = [];
  classList = { toggle() {} };
  querySelectorAll() {
    return [];
  }
  setAttribute(key, value) {
    this.attributes.set(key, value);
  }
  getAttribute(key) {
    return this.attributes.get(key);
  }
  focus(options) {
    this.focused = true;
    this.focusOptions = options;
  }
  scrollIntoView(options) {
    this.scrollOptions = options;
  }
  click() {
    this.dispatchEvent(new Event('click'));
  }
}

function presentation() {
  const nodes = new Map();
  const select = (id) => {
    if (!nodes.has(id)) nodes.set(id, new Element());
    return nodes.get(id);
  };
  const tabs = ['governance', 'treasury', 'delegation'].map((name) => {
    const tab = select(`#home-tab-${name}`);
    tab.dataset.preview = name;
    tab.setAttribute('aria-controls', `home-preview-${name}`);
    return tab;
  });
  const scroll = select('#scroll');
  scroll.dataset.homeScroll = 'home-workspace';
  return {
    tabs,
    scroll,
    select,
    root: {
      querySelector: select,
      querySelectorAll: (s) => (s === '[data-preview]' ? tabs : [scroll])
    }
  };
}

test('homepage preview changes destination without changing workspace or editing a rule', () => {
  const f = presentation();
  mountCosmootHome(f.root);
  f.tabs[2].click();
  assert.equal(f.select('#home-panel-open').getAttribute('href'), '/community-tools/delegation/');
  assert.equal(f.select('#home-preview-delegation').hidden, false);
  assert.equal(f.select('#home-preview-governance').hidden, true);
  assert.equal(f.select('#home-preview-location').textContent, 'Delegation');
  assert.deepEqual(
    f.tabs.map((t) => t.tabIndex),
    [-1, -1, 0]
  );
  f.tabs[1].click();
  assert.equal(f.select('#home-panel-open').getAttribute('href'), '#treasury');
});

test('keyboard preview tabs wrap and section navigation respects reduced motion', () => {
  const f = presentation();
  mountCosmootHome(f.root, { reducedMotion: () => true });
  const key = new Event('keydown', { cancelable: true });
  Object.defineProperty(key, 'key', { value: 'ArrowLeft' });
  f.tabs[0].dispatchEvent(key);
  assert.equal(key.defaultPrevented, true);
  assert.equal(f.tabs[2].focused, true);
  assert.equal(f.tabs[2].getAttribute('aria-selected'), 'true');
  f.scroll.click();
  assert.deepEqual(f.select('#home-workspace').focusOptions, { preventScroll: true });
  assert.deepEqual(f.select('#home-workspace').scrollOptions, {
    behavior: 'instant',
    block: 'start'
  });
});

async function route({ hash = '', search = '', saved = 'governance' } = {}) {
  const nodes = new Map();
  function select(selector) {
    if (!nodes.has(selector)) {
      const element = new Element();
      element.querySelector = (child) => select(`${selector} ${child}`);
      nodes.set(selector, element);
    }
    return nodes.get(selector);
  }
  const window = new EventTarget();
  Object.assign(window, {
    location: { hash, search },
    NetaDaoDirectory: [{ id: 'neta-operations', name: 'Operations' }],
    scrollTo() {},
    matchMedia: () => ({ matches: true })
  });
  const document = { body: { dataset: {} }, querySelector: select, querySelectorAll: () => [] };
  const stored = new Map([
    ['neta-workspace-active-view', saved],
    ['pending-transaction', 'preserved']
  ]);
  runInNewContext(await readFile(new URL('../ux-draft.js', import.meta.url), 'utf8'), {
    window,
    document,
    URLSearchParams,
    CustomEvent: class extends Event {
      constructor(type, init) {
        super(type);
        this.detail = init.detail;
      }
    },
    localStorage: {
      getItem: (key) => stored.get(key),
      setItem: (key, value) => stored.set(key, value)
    },
    history: {
      replaceState: (_state, _title, value) => {
        window.location.hash = value;
      },
      pushState: (_state, _title, value) => {
        window.location.hash = value;
      }
    }
  });
  return { window, document, select, stored };
}

test('bare root opens the homepage despite a saved workspace; journals are preserved', async () => {
  const f = await route();
  assert.equal(f.document.body.dataset.workspaceView, 'home');
  assert.equal(f.select('#home-view').hidden, false);
  assert.equal(f.select('#governance-view').hidden, true);
  assert.equal(f.stored.get('pending-transaction'), 'preserved');
});

test('explicit routes and query-only governance handoffs still open the workspace', async () => {
  for (const view of ['governance', 'treasury', 'relay/profile']) {
    const f = await route({ hash: `#${view}`, saved: 'home' });
    assert.equal(f.document.body.dataset.workspaceView, view.split('/')[0]);
  }
  for (const key of ['review', 'proposal', 'plannerDraft', 'proposalTemplate']) {
    const search = `?chain=juno&dao=juno&${key}=4`;
    const f = await route({ search, saved: 'home' });
    assert.equal(f.document.body.dataset.workspaceView, 'governance');
    assert.equal(f.window.location.search, search);
    assert.equal(f.select('#home-view').hidden, true);
  }
});
