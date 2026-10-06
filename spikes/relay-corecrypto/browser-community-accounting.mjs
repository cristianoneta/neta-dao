import assert from 'node:assert/strict';
import http from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
const root=new URL('../../',import.meta.url);
const source=JSON.parse(await readFile(new URL('data/treasury/juno-community-accounting.json',root)));
assert.equal(source.schema_version,3);assert.ok(source.entries.some(r=>r.category==='community_tax'&&Number(r.usd_value)>0));
const server=http.createServer(async(req,res)=>{try{const path=new URL(req.url,'http://localhost').pathname;res.writeHead(200,{'content-type':/\.m?js$/.test(path)?'text/javascript':path.endsWith('.css')?'text/css':path.endsWith('.json')?'application/json':'text/html'}).end(await readFile(new URL('.'+path,root)));}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://**/*',r=>r.abort());
 await page.goto(`http://127.0.0.1:${server.address().port}/index.html?dao=juno&subdao=main#treasury`);
 await page.locator('#pnl-year').selectOption('2026');await page.locator('#pnl-month').selectOption('10');
 await page.waitForFunction(()=>document.querySelector('#pnl-account-community_tax').textContent.includes('$'));
 await page.getByRole('button',{name:'+ Income',exact:true}).click();
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
