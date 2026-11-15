import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const src=fs.readFileSync(path.resolve(import.meta.dirname,'../mate_auto_ops_v4.gs'),'utf8');
const start=src.indexOf('function mateV4SourceDue_(src,today){'),end=src.indexOf('function mateV4BalancedSourceQueue_(',start);
assert.ok(start>0&&end>start);
const fnText=src.slice(start,end);
const feed='https://raw.githubusercontent.com/kosuke-saito0807/mate/main/data/mate_overture_discovery.csv';
const city='https://data.example.jp/tourism.csv';
function due(last,link,time='2026-11-15 16:00:00'){
 const fn=new Function('mateV4Jst_',fnText+'\nreturn mateV4SourceDue_;')(()=>time);
 return fn({'最終取込日時':last,'取得元CSV HTTPS URL':link},time.slice(0,10));
}
test('overture updates after 3h slot and not in same slot',()=>{
 assert.equal(due('2026-11-15 12:00:00',feed),true);
 assert.equal(due('2026-11-15 15:05:00',feed),false);
});
test('municipality data remains once daily',()=>{
 assert.equal(due('2026-11-15 02:00:00',city),false);
 assert.equal(due('2026-11-14 22:00:00',city),true);
});
test('new Overture source with no import is due',()=>{
 assert.equal(due('',feed),true);
});
