import { build } from '../faucet/node_modules/esbuild/lib/main.js';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const targets = {
  governance: {
    entry: 'faucet/src/juno-governance-signing.mjs',
    globalName: 'JunoGovernanceSigning',
    outfile: 'assets/juno-governance-signing.js'
  },
  swap: {
    entry: 'faucet/src/wynd-swap-signing.mjs',
    globalName: 'NetaSwapSigning',
    outfile: 'assets/wynd-swap-signing.js'
  },
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
if (!target) throw Error('Choose faucet, names or swap');
await build({
  absWorkingDir: root,
  entryPoints: [target.entry],
  bundle: true,
  minify: true,
  format: 'iife',
  globalName: target.globalName,
  outfile: target.outfile
});
