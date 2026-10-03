import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
const source=readFileSync('neta-governance.js','utf8');
const declaration=source.split('\n').find(line=>line.includes('function normalizedComment('));
const normalize=vm.runInNewContext(`(${declaration.trim()})`);
test('malformed public thread markers remain literal and cannot abort rendering',()=>{
 for(const body of ['[[NETA_THREAD:%]]\nhello','[[NETA_THREAD:%E0%A4%A]]\nhello']){
  const result=normalize({id:1,body},0);
  assert.equal(result.body,body); assert.equal(result.title,null);
 }
 const valid=normalize({id:2,body:'[[NETA_THREAD:Valid%20topic]]\nhello'},0);
 assert.equal(valid.title,'Valid topic');assert.equal(valid.body,'hello');
});
