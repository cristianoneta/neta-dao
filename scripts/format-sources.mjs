import { spawnSync } from 'node:child_process';
import { sourceFiles } from './source-files.mjs';

const files = [
  ...sourceFiles(),
  'package.json',
  'jsconfig.json',
  '.prettierrc.json',
  'scripts/contract-audit-policy.json'
];
const result = spawnSync(
  process.execPath,
  [
    'node_modules/prettier/bin/prettier.cjs',
    process.argv.includes('--write') ? '--write' : '--check',
    ...files
  ],
  { stdio: 'inherit' }
);
if (result.error) throw result.error;
process.exit(result.status ?? 1);
