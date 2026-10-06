import assert from 'node:assert/strict';
import http from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
const root=new URL('../../',import.meta.url);
// Preview the collector's real archived evidence without overwriting bot-owned
// production exports in a PR. Historical quotes are frozen; no network is used.
const preview=JSON.parse(execFileSync('python',['-c',`
import sys,json
sys.path.insert(0,'scripts')
import community_statement as s
from pathlib import Path
root=Path('data/treasury')
s.prices_for=lambda ranges: json.loads((root/'juno-community-prices.json').read_text())['quotes']
feed=json.loads((root/'juno-community-events.json').read_text())
base=json.loads((root/'juno-community-accounting.json').read_text())
feed['events']=[e for e in feed['events'] if e.get('evidence',{}).get('kind')!='block-distribution']
base['entries']=[e for e in base['entries'] if e.get('evidence',{}).get('kind')!='block-distribution']
feed,ledger=s.build({},feed,base)
print(json.dumps({'feed':feed,'ledger':ledger}))
`],{cwd:fileURLToPath(root),encoding:'utf8',maxBuffer:16*1024*1024}));
const source=preview.ledger;
assert.equal(source.schema_version,3);assert.ok(source.entries.some(r=>r.category==='community_tax'&&Number(r.usd_value)>0));
const server=http.createServer(async(req,res)=>{try{const path=new URL(req.url,'http://localhost').pathname;const projected=path==='/data/treasury/juno-community-accounting.json'?preview.ledger:path==='/data/treasury/juno-community-events.json'?preview.feed:null;res.writeHead(200,{'content-type':/\.m?js$/.test(path)?'text/javascript':path.endsWith('.css')?'text/css':path.endsWith('.json')?'application/json':'text/html'}).end(projected?JSON.stringify(projected):await readFile(new URL('.'+path,root)));}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://**/*',r=>r.abort());
 await page.goto(`http://127.0.0.1:${server.address().port}/index.html?dao=juno&subdao=main#treasury`);
 await page.locator('#pnl-year').selectOption('2026');await page.locator('#pnl-month').selectOption('10');
 await page.waitForFunction(()=>document.querySelector('#pnl-account-community_tax').textContent.includes('$'));
 assert.match(await page.locator('#pnl-basis').innerText(),/Historical daily USD references/);
 assert.doesNotMatch(await page.locator('#pnl-basis').innerText(),/USD at payment time/);
 await page.getByRole('button',{name:'+ Income',exact:true}).click();
 await page.locator('#treasury-pnl details').filter({has:page.locator('#pnl-source')}).locator('summary').click();
 assert.match(await page.locator('#pnl-source').innerText(),/historical daily opening|Historical daily opening/);
 assert.match(await page.locator('#treasury-events').innerText(),/Income · Community Tax/);
 assert.match(await page.locator('#treasury-events').innerText(),/JUNO/);
 assert.equal(await page.locator('#treasury-events a').filter({hasText:'TX ↗'}).count(),0);
 assert.doesNotMatch(await page.locator('.pnl-result').innerText(),/\$/);
 await page.locator('#treasury-events-toggle').click();assert.ok(await page.locator('#treasury-events .event-row').count()>0);
 const screenshots=process.env.NNS_SCREENSHOT_DIR;
 if(screenshots)await mkdir(screenshots,{recursive:true});
 for(const width of [1440,768,390,320]){
  await page.setViewportSize({width,height:1400});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,`overflow ${width}`);
  if(screenshots){await page.locator('#treasury-pnl').screenshot({path:`${screenshots}/community-pnl-${width}.png`});await page.locator('#treasury-events .event-row').first().screenshot({path:`${screenshots}/community-event-${width}.png`});}
 }
 await page.locator('#pnl-year').selectOption('2027');assert.doesNotMatch(await page.locator('#pnl-rows').innerText(),/\$/);
 await page.locator('#pnl-year').selectOption('2026');await page.locator('#pnl-month').selectOption('all');
 assert.match(await page.locator('#pnl-account-community_tax').innerText(),/\$/);
 assert.deepEqual(errors,[]);console.log('Community Pool historical accounting: block references, period filters, partial totals and 4 viewports passed');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
