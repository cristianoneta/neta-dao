import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const files=JSON.parse(readFileSync(new URL('./format-sources.json',import.meta.url)));
const result=spawnSync(process.execPath,['faucet/node_modules/prettier/bin/prettier.cjs',process.argv.includes('--write')?'--write':'--check',...files],{stdio:'inherit'});
if(result.error)throw result.error;
process.exit(result.status||0);
