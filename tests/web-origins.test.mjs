import test from 'node:test';
import assert from 'node:assert/strict';
import { webOrigins } from '../service/web-origins.mjs';

test('origin allowlist accepts exact HTTPS domains and preserves legacy single-origin configuration', () => {
  assert.deepEqual([...webOrigins('https://dao.netareborn.com')], ['https://dao.netareborn.com']);
  assert.deepEqual([...webOrigins('https://dao.netareborn.com, https://cosmoot.com')],
    ['https://dao.netareborn.com', 'https://cosmoot.com']);
  for (const value of [undefined, '', '*', 'null', 'http://cosmoot.com', 'https://cosmoot.com/',
    'https://cosmoot.com/path', 'https://user@cosmoot.com', 'https://cosmoot.com?x=1',
    'https://cosmoot.com,', [], Array(6).fill('https://cosmoot.com')]) {
    assert.throws(() => webOrigins(value), /HTTPS origins/);
  }
});
