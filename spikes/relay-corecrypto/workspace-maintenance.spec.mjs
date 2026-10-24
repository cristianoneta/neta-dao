import { test, expect } from 'playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route(/^https?:\/\/(?!127\.0\.0\.1[:/])/, (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: '{"error":"Read provider unavailable in this fixture"}'
    })
  );
  await page.addInitScript(() => {
    window.__walletCalls = 0;
    window.keplr = new Proxy(
      {},
      {
        get: () => () => {
          window.__walletCalls++;
          throw Error('Unexpected wallet access');
        }
      }
    );
  });
});

for (const width of [1440, 390]) {
  test(`read-only workspace does not fetch signing bundles at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const requested = [];
    page.on('request', (request) => requested.push(new URL(request.url()).pathname));
    await page.goto('/index.html?chain=juno&dao=juno#governance');
    await page.waitForFunction(() => typeof window.NetaWorkspaceWallet?.getSession === 'function');
    await expect(page.locator('#gov-status')).not.toBeEmpty();
    expect(
      requested.filter((path) =>
        /\/assets\/(?:socials-testnet-client|juno-governance-signing)\.js$/.test(path)
      )
    ).toEqual([]);
    expect(await page.evaluate(() => window.__walletCalls)).toBe(0);
    await expect(page.locator('#primary-action')).toBeDisabled();
  });
}

test('real native signing bundle loads once on demand and retries a failed download without wallet access', async ({
  page
}) => {
  let requests = 0;
  await page.route('**/assets/juno-governance-signing.js?*', (route) => {
    requests++;
    return requests === 1 ? route.abort() : route.continue();
  });
  await page.goto('/index.html');
  const failed = await page.evaluate(async () => {
    const { loadGovernanceSigning } = await import('/browser-signing.mjs');
    try {
      await loadGovernanceSigning();
      return false;
    } catch {
      return true;
    }
  });
  expect(failed).toBe(true);
  const result = await page.evaluate(async () => {
    const { loadGovernanceSigning } = await import('/browser-signing.mjs');
    const [first, second] = await Promise.all([loadGovernanceSigning(), loadGovernanceSigning()]);
    return {
      same: first === second,
      submit: typeof first.submit,
      vote: typeof first.vote,
      calls: window.__walletCalls
    };
  });
  expect(result).toEqual({ same: true, submit: 'function', vote: 'function', calls: 0 });
  expect(requests).toBe(2);
});
