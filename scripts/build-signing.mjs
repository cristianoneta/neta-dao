import { build } from '../faucet/node_modules/esbuild/lib/main.js';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const targets = {
  faucet: {
    entry: 'faucet/src/signing.js',
    globalName: 'NetaFaucetSigning',
    outfile: 'assets/faucet-signing.js'
  },
  names: {
    entry: 'faucet/src/names-signing.mjs',
    globalName: 'NetaNamesSigning',
    outfile: 'assets/names-signing.js'
  }
};
const target = targets[process.argv[2]];
if (!target) throw Error('Choose faucet or names');
await build({
  absWorkingDir: root,
  entryPoints: [target.entry],
  bundle: true,
  minify: true,
  format: 'iife',
  globalName: target.globalName,
  outfile: target.outfile
});
