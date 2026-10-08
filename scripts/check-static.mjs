// Check the actual publication artifact: local imports/links, hashes and exclusions.
import { readFile, readdir, stat } from 'node:fs/promises';
import { dirname, extname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
const root = fileURLToPath(new URL('../', import.meta.url));
const output = resolve(root, 'dist/static');
const manifest = JSON.parse(await readFile(resolve(root, 'dist/static-manifest.json'), 'utf8'));
if (process.argv.includes('--require-worker') && !manifest.pagesFunction)
  throw Error('Deployment requires a compiled Pages function');
if (manifest.pagesFunction) {
  if (manifest.pagesFunction.wrangler !== '4.148.0') throw Error('Unexpected Wrangler version');
  for (const [path, expected] of Object.entries(manifest.pagesFunction.inputs)) {
    if (createHash('sha256').update(await readFile(resolve(root, path))).digest('hex') !== expected)
      throw Error(`Pages function source changed after build: ${path}`);
  }
  if (!manifest.files['_worker.js'] || !manifest.files['_routes.json'])
    throw Error('Pages function/routing missing from artifact');
  const routes = JSON.parse(await readFile(resolve(output, '_routes.json'), 'utf8'));
  if (JSON.stringify(routes) !== JSON.stringify({ version: 1, include: ['/data/*'], exclude: [] }))
    throw Error('Pages invocation must be scoped to /data/*');
}
async function list(dir) {
  const paths = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = resolve(dir, entry.name);
    if (entry.isSymbolicLink()) throw Error(`Export contains a symlink: ${path}`);
    if (entry.isDirectory()) paths.push(...await list(path));
    else paths.push(relative(output, path));
  }
  return paths;
}
const files = await list(output);
if (JSON.stringify(files.sort()) !== JSON.stringify(Object.keys(manifest.files).sort()))
  throw Error('Export files do not match manifest');
for (const file of files) {
  if (file.split('/').some(part => part.startsWith('.') ||
    ['node_modules', 'faucet', 'relay-backup', 'contracts', 'tests', 'scripts'].includes(part)) ||
    /\.(?:sqlite|env|pem)(?:$|[.-])/.test(file)) throw Error(`Private file in export: ${file}`);
  const bytes = await readFile(resolve(output, file));
  if (createHash('sha256').update(bytes).digest('hex') !== manifest.files[file])
    throw Error(`Export hash mismatch: ${file}`);
  const source = file === '_headers' ? 'deploy/cosmoot/pages-headers'
    : file === '_routes.json' ? 'deploy/cosmoot/pages-routes.json' : file;
  if (file === '_worker.js' && !manifest.pagesFunction) throw Error('Unrecorded Pages worker');
  if (file !== '_worker.js' && !bytes.equals(await readFile(resolve(root, source))))
    throw Error(`Export changed reviewed source bytes: ${file}`);
  const text = bytes.toString('utf8');
  let refs = [];
  if (['.mjs', '.js'].includes(extname(file)))
    refs = [...text.matchAll(/(?:from\s*|import\s*\(\s*)['"](\.[^'"]+)['"]/g)].map(m => m[1]);
  if (extname(file) === '.html')
    refs = [...text.matchAll(/(?:src|href)=['"]([^'"]+)['"]/g)].map(m => m[1]);
  if (extname(file) === '.css')
    refs = [...text.matchAll(/url\(['"]?([^'"\)]+)/g)].map(m => m[1]);
  for (let ref of refs) {
    ref = ref.split('#')[0].split('?')[0];
    if (!ref || /^(?:[a-zA-Z]+:|\/\/)/.test(ref)) continue;
    let target = ref.startsWith('/') ? resolve(output, `.${ref}`) : resolve(output, dirname(file), ref);
    if (relative(output, target).startsWith('..')) throw Error(`Escaping public path: ${file} -> ${ref}`);
    try {
      if ((await stat(target)).isDirectory()) target = resolve(target, 'index.html');
      if (!(await stat(target)).isFile()) throw Error('Not a file');
    } catch { throw Error(`Missing static reference: ${file} -> ${ref}`); }
  }
}
const headers = await readFile(resolve(output, '_headers'), 'utf8');
if (!headers.includes("frame-ancestors 'self'") || !headers.includes('X-Frame-Options: SAMEORIGIN'))
  throw Error('Foreign framing protection / same-origin crypto frame policy missing');
console.log(`Verified ${files.length} artifact files: source/build hashes, local references and exclusions.`);
