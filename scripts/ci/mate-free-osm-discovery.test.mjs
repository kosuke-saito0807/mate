import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const source=fs.readFileSync(path.resolve(import.meta.dirname,'../mate_auto_ops_v4.gs'),'utf8');
const start=source.indexOf('function mateV4DiscoverFreeOsmCandidates(){');
const end=source.indexOf('function mateV4DiscoverGeneralWebProspects(){',start);
assert.ok(start>0&&end>start);
const body=source.slice(start,end);
function mock(items=[],error=false,day='2026-11-15'){
 const props={},calls=[],added=[];
 const deps={
  PropertiesService:{getScriptProperties:()=>({getProperty:k=>props[k]||'',setProperty:(k,v)=>props[k]=v})},
  mateV4Jst_:()=> day+' 11:00:00',
  mateV4Book_:()=>({}),mateV4Tab_:(_b,n)=>n,
  MATE_V4:{leads:'営業候補_自動収集'},
  mateV4Rows_:()=>[],
  mateV4Host_:url=>(/^https:\/\/([a-z0-9.-]+)(?:\/|$)/i.exec(String(url))||[])[1]||'',
  mateV4CandidateHttps_:url=>/^https:\/\/[a-z0-9.-]+(?:\/[^\s]*)?$/i.test(String(url))?url:'',
  mateV4OwnerBlocked_:()=>false,
  mateV4Append_:(_s,values)=>added.push(values),
  UrlFetchApp:{fetch:(url,opts)=>{calls.push({url,opts});return {
    getResponseCode:()=>error?503:200,
    getContentText:()=>JSON.stringify({elements:items})
  }}},
  console:{log:()=>{}}
 };
 const fn=new Function(...Object.keys(deps),body+'\nreturn mateV4DiscoverFreeOsmCandidates;')(...Object.values(deps));
 return {fn,calls,added};
}
test('one bounded query, no emails, attribution, and no-send staging',()=>{
 const x=mock([{type:'node',id:123,tags:{name:'親子クラフト体験工房',website:'https://example-kobo.jp',shop:'craft',email:'secret@example.com'}},
 {type:'node',id:124,tags:{name:'親子クラフト体験工房2',website:'https://example-kobo.jp',shop:'craft'}}]);
 const result=x.fn();
 assert.equal(result.added,1);assert.equal(result.sendable,0);
 assert.equal(x.calls.length,1);assert.equal(x.fn(),'ALREADY_CHECKED');
 assert.equal(x.added.length,1);
 assert.equal(x.added[0][2],'PLAY');
 assert.ok(x.added[0][7].includes('OpenStreetMap'));
 assert.ok(x.added[0][7].includes('送信不可'));
 assert.ok(!x.added[0].join('|').includes('secret@example.com'));
 assert.equal(x.calls[0].opts.followRedirects,false);
});
test('API failures do not create retry storms',()=>{
 const x=mock([],true);
 assert.equal(x.fn().status,'HTTP_503');
 assert.equal(x.fn(),'ALREADY_CHECKED');
 assert.equal(x.calls.length,1);
});

test('two consecutive days query distinct bounded city tiles',()=>{
 const a=mock([],false,'2026-11-15'),b=mock([],false,'2026-11-16');
 a.fn();b.fn();
 assert.equal(a.calls.length,1);
 assert.equal(b.calls.length,1);
 assert.notEqual(a.calls[0].opts.payload,b.calls[0].opts.payload);
 assert.equal(a.calls[0].opts.method,'post');
 assert.equal(b.calls[0].opts.method,'post');
});
