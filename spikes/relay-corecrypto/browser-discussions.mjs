// Synthetic wallets and local discussion storage only. No chain transaction is signed.
import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { once } from 'node:events';
import { chromium } from 'playwright';
import { DiscussionStore } from '../../discussions/store.mjs';
import { discussionServer } from '../../discussions/server.mjs';
import { discussionSource } from '../../discussion-links.mjs';
import { Secp256k1, sha256 } from '../../relay-backup/node_modules/@cosmjs/crypto/build/index.js';
import {
  encodeSecp256k1Pubkey,
  pubkeyToAddress,
  serializeSignDoc
} from '../../relay-backup/node_modules/@cosmjs/amino/build/index.js';
const root = resolve(import.meta.dirname, '../..'),
  now = Date.now();
const secret = new Uint8Array(32);
secret[31] = 42;
const pub = encodeSecp256k1Pubkey(
  Secp256k1.compressPubkey((await Secp256k1.makeKeypair(secret)).pubkey)
);
const wallet = pubkeyToAddress(pub, 'juno');
const other = 'juno1z3xcalwan92yqxu9d406tlft9yy94jy8s5et57';
const store = new DiscussionStore(':memory:');
const source = discussionSource({ kind: 'native', chainId: 'juno-1', contract: 'gov', id: 999 });
const thread = store.syncThread({
  source,
  title: 'Juno Delegation Programme — allocation rules',
  summary:
    'This proposal sets the rules for the Juno Delegation Programme. It does not move funds. Rebalancing requires a separate proposal.\n\nThe community is invited to discuss governance participation and fixed allocations.',
  author: wallet,
  created: now - 86400000,
  phase: 'PROPOSAL_STATUS_VOTING_PERIOD',
  payload: { status: 'PROPOSAL_STATUS_VOTING_PERIOD' },
  url: 'https://cosmoot.com/?dao=juno&proposal=999#governance'
});
store.syncStatus(source);
store.syncStatus('native:juno-1:gov');
for (let id = 1; id <= 65; id++)
  store.importComment(source, {
    id,
    author: wallet,
    created_time: Math.floor((now - 86400000) / 1000) + id * 500,
    body:
      id === 1
        ? 'A useful starting point. <script>window.injected=true</script>'
        : `Community perspective ${id}: make the participation window clear, and explain which actions require a separate vote.`,
    moderation: null
  });
let currentName = true;
const chain = {
  identity: async () => ({
    name: currentName
      ? {
          status: 'verified',
          name: 'cosmoot-test.neta',
          owner: wallet,
          height: 123,
          time: new Date(now).toISOString(),
          expires: now + 86400000
        }
      : { status: 'none' },
    stake: {
      status: 'verified',
      denom: 'ujuno',
      amountRaw: '123456789',
      height: 123,
      time: new Date(now).toISOString()
    }
  })
};
const server = discussionServer({
  store,
  chain,
  origins: ['https://cosmoot.com'],
  moderators: [wallet]
});
server.listen(0, '127.0.0.1');
await once(server, 'listening');
const backend = `http://127.0.0.1:${server.address().port}`;
let browser,
  dropReply = false;
try {
  browser = await chromium.launch({
    headless: true,
    ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {})
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.exposeFunction('discussionTestSignature', async (message) => {
    const doc = {
      chain_id: '',
      account_number: '0',
      sequence: '0',
      fee: { gas: '0', amount: [] },
      msgs: [
        {
          type: 'sign/MsgSignData',
          value: { signer: wallet, data: Buffer.from(message).toString('base64') }
        }
      ],
      memo: ''
    };
    const signed = await Secp256k1.createSignature(sha256(serializeSignDoc(doc)), secret);
    return {
      pub_key: pub,
      signature: Buffer.from(new Uint8Array([...signed.r(32), ...signed.s(32)])).toString('base64')
    };
  });
  await context.addInitScript(
    ({ wallet }) => {
      window.testWallet = wallet;
      window.keplr = {
        enable: async () => {},
        getKey: async () => ({ bech32Address: window.testWallet }),
        signArbitrary: async (chain, address, message) => {
          if (chain !== 'juno-1' || address !== window.testWallet)
            throw Error('Wrong sign-in identity');
          return window.discussionTestSignature(message);
        }
      };
    },
    { wallet }
  );
  await context.route('https://**/*', async (route) => {
    const req = route.request(),
      url = new URL(req.url());
    if (url.origin === 'https://api.cosmoot.com') {
      const response = await fetch(backend + url.pathname + url.search, {
        method: req.method(),
        headers: {
          origin: 'https://cosmoot.com',
          ...(req.method() === 'POST' ? { 'content-type': 'application/json' } : {}),
          ...(req.headers().authorization ? { authorization: req.headers().authorization } : {})
        },
        ...(req.postData() ? { body: req.postData() } : {})
      });
      if (dropReply && req.method() === 'POST' && url.pathname.endsWith('/posts')) {
        dropReply = false;
        await response.text();
        return route.abort('failed');
      }
      return route.fulfill({
        status: response.status,
        headers: Object.fromEntries(response.headers),
        body: await response.text()
      });
    }
    if (url.origin !== 'https://cosmoot.com') return route.abort();
    const file = resolve(root, '.' + decodeURIComponent(url.pathname));
    if (!file.startsWith(root + '/')) return route.abort();
    try {
      return route.fulfill({
        body: await readFile(file),
        contentType:
          {
            '.mjs': 'text/javascript',
            '.js': 'text/javascript',
            '.html': 'text/html',
            '.css': 'text/css',
            '.svg': 'image/svg+xml'
          }[extname(file)] || 'application/octet-stream'
      });
    } catch {
      return route.fulfill({ status: 404, body: 'Not found' });
    }
  });
  const page = await context.newPage(),
    errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('https://cosmoot.com/discussions.html?source=' + encodeURIComponent(source));
  await page.locator('#discussion-content:not([hidden])').waitFor();
  assert.equal(await page.locator('#discussion-title').textContent(), thread.title);
  assert.equal(await page.locator('#discussion-posts article').count(), 30);
  assert.equal(
    await page.locator('#discussion-reply').isDisabled(),
    true,
    'Do not accept anonymous text that sign-in would discard'
  );
  assert.match(await page.locator('#post-1').innerText(), /<script>/);
  assert.equal(await page.evaluate(() => window.injected), undefined);
  assert.match(
    await page.locator('#post-1 a').first().getAttribute('href'),
    /name-profile.html\?name=cosmoot-test.neta/
  );
  assert.match(await page.locator('#post-1').innerText(), /JUNO stake at posting unavailable/);
  assert.equal(await page.locator('#discussion-position').getAttribute('max'), '66');
  const screenshots = process.env.NNS_SCREENSHOT_DIR;
  if (screenshots) {
    await mkdir(screenshots, { recursive: true });
    await page.screenshot({
      path: resolve(screenshots, 'discussions-desktop.png'),
      fullPage: false
    });
  }
  await page.locator('#discussion-last').click();
  await page.locator('#post-65').waitFor();
  assert.equal(await page.locator('#discussion-position').getAttribute('max'), '66');
  await page.locator('#discussion-back').click();
  await page.locator('#post-proposal:not([hidden])').waitFor();
  await page.locator('#discussion-position').focus();
  await page.keyboard.press('End');
  await page.keyboard.press('Tab');
  await page.locator('#post-65').waitFor();
  await page.locator('#discussion-first').click();
  await page.locator('#post-1').waitFor();
  await page.locator('#discussion-connect').click();
  await page.locator('#discussion-disconnect:not([hidden])').waitFor();
  await page.locator('#post-1').getByRole('button', { name: 'Quote', exact: true }).click();
  await page
    .locator('#discussion-reply')
    .fill('Can we show exactly which proposals count towards participation?');
  dropReply = true;
  await page.locator('#discussion-post').click();
  await page.waitForFunction(() =>
    document.getElementById('discussion-post-status').textContent.includes('retained')
  );
  assert.equal(store.posts(thread.id).total, 66);
  // Joining review/native threads must retain the old URL, local pending reply and draft.
  const reviewSource = discussionSource({
    kind: 'review',
    chainId: 'juno-1',
    contract: 'juno15wwr9dezyfp86p4px5p664gguargukml3wa9pctw9nutfn2rzk9qwf45gq',
    id: 77
  });
  const joined = store.syncThread({
    source: reviewSource,
    title: thread.title,
    summary: thread.summary,
    author: wallet,
    created: thread.created,
    phase: 'finalized',
    payload: {},
    url: 'https://cosmoot.com/?dao=juno&review=77#governance'
  });
  store.link(reviewSource, source);
  store.syncStatus(reviewSource);
  await page.evaluate(
    ({ id, wallet }) =>
      localStorage.setItem(
        `cosmoot-discussion-draft:${id}:${wallet}`,
        JSON.stringify({
          body: 'Keep this separate draft after the threads join.',
          reply: null,
          quote: null
        })
      ),
    { id: joined.id, wallet }
  );
  await page.reload();
  await page.locator('#discussion-content:not([hidden])').waitFor();
  await page.locator('#discussion-connect').click();
  await page.locator('#discussion-pending:not([hidden])').waitFor();
  assert.equal(
    await page.locator('#discussion-reply').inputValue(),
    'Can we show exactly which proposals count towards participation?'
  );
  await page.locator('#discussion-check').click();
  await page.locator('#post-66').waitFor();
  assert.equal(store.posts(thread.id).total, 66, 'uncertain outcome recovery never reposts');
  assert.match(await page.locator('#post-66').innerText(), /123.45 JUNO staked at posting/);
  assert.match(await page.locator('#post-66').innerText(), /View quoted post/);
  assert.equal(
    await page.locator('#discussion-reply').inputValue(),
    'Keep this separate draft after the threads join.'
  );
  await page.locator('#post-66').getByRole('button', { name: 'Hide', exact: true }).click();
  await page.locator('#discussion-moderation-reason').fill('Synthetic moderation acceptance check');
  await page.locator('#discussion-moderation-confirm').click();
  await page.waitForFunction(() =>
    document.getElementById('post-66')?.textContent.includes('Post hidden by moderation')
  );
  await page.locator('#post-66').getByRole('button', { name: 'Restore', exact: true }).click();
  await page.locator('#discussion-moderation-reason').fill('Restore the reviewed comment');
  await page.locator('#discussion-moderation-confirm').click();
  await page.waitForFunction(() =>
    document.getElementById('post-66')?.textContent.includes('Can we show exactly')
  );
  await page.locator('#discussion-reply').fill('This draft belongs only to the connected wallet.');
  await page.evaluate((other) => {
    window.testWallet = other;
    window.dispatchEvent(new Event('keplr_keystorechange'));
  }, other);
  assert.equal(await page.locator('#discussion-reply').inputValue(), '');
  assert.equal(await page.locator('#discussion-post').isDisabled(), true);
  await page.evaluate((wallet) => {
    window.testWallet = wallet;
  }, wallet);
  await page.locator('#discussion-connect').click();
  await page.locator('#discussion-disconnect:not([hidden])').waitFor();
  assert.equal(
    await page.locator('#discussion-reply').inputValue(),
    'This draft belongs only to the connected wallet.'
  );
  await page.locator('#discussion-disconnect').click();
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.reload();
    await page.locator('#discussion-content:not([hidden])').waitFor();
    assert.match(
      await page.locator('#discussion-position-label').textContent(),
      / \/ 67$/,
      `Correct total before scrolling at ${width}`
    );
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      true,
      `No horizontal overflow at ${width}`
    );
    if (screenshots)
      await page.screenshot({
        path: resolve(screenshots, `discussions-${width}.png`),
        fullPage: false
      });
  }
  assert.deepEqual(errors, []);
  console.log(
    'Discussion browser acceptance passed: public reading, wallet proof, quote, lost-response recovery, moderation, wallet switch, timeline, 4 widths.'
  );
} finally {
  await browser?.close();
  server.closeAllConnections();
  await new Promise((r) => server.close(r));
  store.close();
}
