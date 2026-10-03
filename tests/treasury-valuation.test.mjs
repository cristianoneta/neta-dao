import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
const source=readFileSync('treasury.js','utf8');
const declaration=source.slice(source.indexOf('function comparableValuation('),source.indexOf('function economicAssets('));
const comparable=vm.runInNewContext(`(${declaration.trim()})`);
const asset=(key,value)=>({key,usd_value:value,amount:'1'});
const row=assets=>({assets});
test('lost or restored price coverage cannot appear as a treasury flow',()=>{
 const priced=row([asset('osmosis:usdc','3441'),asset('juno','7')]);
 const lost=row([asset('osmosis:usdc',null),asset('juno','7')]);
 assert.equal(comparable([priced,lost]),false);
 assert.equal(comparable([lost,priced]),false);
});
test('consistently unpriced assets do not prevent comparison of priced holdings',()=>{
 assert.equal(comparable([row([asset('test',null),asset('juno','7')]),row([asset('juno','8'),asset('test',null)])]),true);
 // Actual disposal of a priced holding is still reflected in the history.
 assert.equal(comparable([row([asset('usdc','10'),asset('juno','7')]),row([asset('juno','7')])]),true);
});
test('missing history inputs and incomplete LP pricing are not a complete comparison',()=>{
 assert.equal(comparable([row([]),row([asset('juno','7')])]),false);
 const lp={...asset('lp','5'),underlyings:[asset('juno','5'),asset('other',null)]};
 assert.equal(comparable([row([asset('lp','10')]),row([lp])]),false);
});
