// Build once in the package job. Deploy the checked Worker bytes with --no-bundle.
import { execFileSync } from 'node:child_process';
import { cp, lstat, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root = fileURLToPath(new URL('../', import.meta.url));
const run = (command, args) => execFileSync(command, args, {
  cwd: root, stdio: 'inherit', env: { ...process.env, WRANGLER_SEND_METRICS: 'false' }
});
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const inputs = [
  'functions/data/[[path]].js', 'service/snapshot-proxy.mjs',
  'deploy/cosmoot/snapshot-paths.json', 'deploy/cosmoot/pages-routes.json',
  'wrangler.json', 'scripts/build-pages.mjs'
];
const sourceFiles = {};
for (const path of inputs) {
  const info = await lstat(resolve(root, path));
  if (!info.isFile() || info.isSymbolicLink()) throw Error(`Invalid Pages input: ${path}`);
  sourceFiles[path] = hash(await readFile(resolve(root, path)));
}
run(process.execPath, ['scripts/build-static.mjs']);
await rm(resolve(root, 'dist/pages-worker'), { recursive: true, force: true });
run('npx', ['--yes', 'wrangler@4.148.0', 'pages', 'functions', 'build', 'functions',
  '--outdir', 'dist/pages-worker']);
// This function has no external modules or assets. Fail if that ever changes.
const bundleFiles = await readdir(resolve(root, 'dist/pages-worker'));
if (bundleFiles.length !== 1 || bundleFiles[0] !== 'index.js')
  throw Error(`Unexpected Worker output: ${bundleFiles.join(', ')}`);
await cp(resolve(root, 'dist/pages-worker/index.js'), resolve(root, 'dist/static/_worker.js'));
await cp(resolve(root, 'deploy/cosmoot/pages-routes.json'), resolve(root, 'dist/static/_routes.json'));
const manifestPath = resolve(root, 'dist/static-manifest.json');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
for (const path of ['_worker.js', '_routes.json'])
  manifest.files[path] = hash(await readFile(resolve(root, 'dist/static', path)));
manifest.pagesFunction = { wrangler: '4.148.0', inputs: sourceFiles };
await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
console.log('Pages artifact includes the compiled snapshot Worker and scoped routing.');
