import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const src=fs.readFileSync(path.resolve(import.meta.dirname,'../mate_auto_ops_v4.gs'),'utf8');
const a=src.indexOf('function mateV4BatchAppend_(s,rows){');
const b=src.indexOf('function mateV4Jst_(){',a);
assert.ok(a>0&&b>a);
test('large lead imports write one sanitized batch and not separate sheet appends',()=>{
 const calls=[];
 const sheet={getLastRow:()=>25,getRange:(...args)=>{calls.push(args);
  return {setValues:data=>calls.push(data)};}};
 const safe=(v,n)=>String(v).startsWith('=')?"'"+v:String(v);
 const fn=new Function('mateV4San_',src.slice(a,b)+'\nreturn mateV4BatchAppend_;')(safe);
 const count=fn(sheet,[['legitimate','https://school.jp'],['=DANGEROUS','https://other.jp']]);
 assert.equal(count,2);
 assert.deepEqual(calls[0],[26,1,2,2]);
 assert.equal(calls[1][1][0],"'=DANGEROUS");
 assert.equal(calls.length,2);
});
test('malformed batch width raises before spreadsheet mutation',()=>{
 const sheet={getLastRow:()=>{throw Error('must not mutate')}};
 const fn=new Function('mateV4San_',src.slice(a,b)+'\nreturn mateV4BatchAppend_;')(String);
 assert.throws(()=>fn(sheet,[['one'],['one','two']]),/batch width mismatch/);
});
test('CSV source metadata is marked imported only after batch succeeds',()=>{
 const start=src.indexOf('function mateV4CollectLeads(){');
 const end=src.indexOf('function mateV4OptoutInbox(){',start);
 const body=src.slice(start,end);
 assert.ok(body.indexOf('if(x.service&&x.service!==service)')<body.indexOf('mateV4StageNameOnly_'));
 assert.ok(body.indexOf('if(writeRows.length)mateV4BatchAppend_(dest,writeRows);')>body.indexOf('writeRows.push(['));
 assert.ok(body.indexOf('if(writeRows.length)mateV4BatchAppend_(dest,writeRows);')<body.indexOf('src.getRange(source._row,6,1,2).setValues([[mateV4Jst_(),summary'));
 assert.ok(body.includes("const state=deny?'配信禁止':'窓口確認待ち'"));
});
