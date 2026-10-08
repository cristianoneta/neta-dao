import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, glob, stat } from 'node:fs/promises';
import { resolve, dirname, posix } from 'node:path';
import { fileURLToPath } from 'node:url';

test('Docker COPY instructions include the complete relative backend import graph', async () => {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const dockerfile = await readFile(resolve(root, 'faucet/Dockerfile'), 'utf8');
  const staged = new Map();
  for (const match of dockerfile.matchAll(/^COPY (.+) (\S+)$/gm)) {
    const [, pattern, destination] = match;
    for await (const source of glob(pattern, { cwd: root })) {
      const sourcePath = resolve(root, source);
      if ((await stat(sourcePath)).isDirectory()) {
        for await (const file of glob('**/*.mjs', { cwd: sourcePath })) {
          staged.set(posix.normalize(posix.join(destination, file)), resolve(sourcePath, file));
        }
      } else if (source.endsWith('.mjs')) {
        staged.set(posix.normalize(destination.endsWith('/') ? posix.join(destination, posix.basename(source)) : destination), sourcePath);
      }
    }
  }
  assert.ok(staged.has('faucet/service/server.mjs'));
  for (const [target, source] of staged) {
    const text = await readFile(source, 'utf8');
    for (const match of text.matchAll(/(?:from\s*|import\s*\()\s*['"](\.[^'"]+)['"]/g)) {
      const imported = posix.normalize(posix.join(dirname(target), match[1]));
      assert.ok(staged.has(imported), `${target} imports ${imported}, missing from Docker image`);
    }
  }
});
