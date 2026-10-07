import {build} from '../faucet/node_modules/esbuild/lib/main.js';
import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const result=await build({absWorkingDir:root,entryPoints:['relay-personal-pilot-entry.mjs'],bundle:true,
  format:'esm',platform:'browser',target:'es2022',minify:true,write:false,legalComments:'inline'});
const files=[['relay-personal-pilot.js',result.outputFiles[0].contents],
  ['assets/relay-personal-pilot-signing.js',await readFile(new URL('../assets/names-signing.js',import.meta.url))]];
for(const [path,bytes] of files){
  const url=new URL('../'+path,import.meta.url);
  if(process.argv.includes('--check')){
    if(!Buffer.from(bytes).equals(await readFile(url)))throw Error('Pilot artifact does not match reviewed source: '+path);
  }else await writeFile(url,bytes);
}
console.log(process.argv.includes('--check')?'Pilot artifacts match source.':'Pilot artifacts built.');
