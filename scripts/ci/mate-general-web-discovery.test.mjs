import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const source=fs.readFileSync(path.resolve(import.meta.dirname,'../mate_auto_ops_v4.gs'),'utf8');
const start=source.indexOf('function mateV4DiscoverGeneralWebProspects(){');
const end=source.indexOf('function mateV4CollectLeads(){',start);
assert.ok(start>0&&end>start);
const body=source.slice(start,end);
function harness({apiKey='',results=[],existing=[],leads=[]}={}){
  const added=[],requests=[],props={};
  if(apiKey)props.MATE_BRAVE_SEARCH_API_KEY=apiKey;
  const d={
    PropertiesService:{getScriptProperties:()=>({getProperty:k=>props[k]||'',setProperty:(k,v)=>props[k]=v})},
    mateV4Jst_:()=> '2026-11-15 10:00:00',
    mateV4Book_:()=>({}),
    mateV4Tab_:(_b,name)=>name,
    MATE_V4:{leads:'営業候補_自動収集'},
    mateV4Rows_:tab=>tab==='営業候補_Web検索_未確認'?existing:leads,
    mateV4Append_:(_tab,values)=>added.push(values),
    mateV4CandidateHttps_:url=>/^https:\/\/[a-z0-9.-]+(?:\/[^\\s]*)?$/i.test(url)?url:'',
    mateV4Host_:url=>(/^https:\/\/([^/]+)/i.exec(url)||[])[1]||'',
    mateV4OwnerBlocked_:()=>false,
    mateV4Key_:(service,url,title)=>service+'-'+url.length+'-'+title.length,
    UrlFetchApp:{fetch:(url,options)=>{requests.push({url,options});
      return {getResponseCode:()=>200,
        getContentText:()=>JSON.stringify({web:{results}})};
    }},
    console:{log:()=>{}}
  };
  const fn=new Function(...Object.keys(d),body+'\nreturn mateV4DiscoverGeneralWebProspects;')(...Object.values(d));
  return {run:fn,added,requests,props};
}
test('missing API key is a no-op: no search, no send, no charges',()=>{
  const x=harness();assert.equal(x.run(),'WEB_SEARCH_KEY_NOT_CONFIGURED_NO_REQUESTS');
  assert.equal(x.requests.length,0);
  assert.equal(x.added.length,0);
});
test('search results are staged only and deduped by domain and service',()=>{
  const x=harness({apiKey:'test-key',results:[
    {url:'https://example-school.jp/',title:'子どもプログラミング教室 サンプル株式会社'},
    {url:'https://example-school.jp/info',title:'子どもプログラミング教室 サンプル株式会社'},
    {url:'https://instagram.com/example',title:'子どもプログラミング教室 Instagram'},
    {url:'https://news.example.net/',title:'ニュース一覧'},
    {url:'http://127.0.0.1/',title:'サンプル教室'}
  ]});
  const out=x.run();
  assert.equal(out.queries,6);
  assert.equal(out.sendable,0);
  assert.equal(x.requests.length,6);
  assert.ok(x.added.length>=1);
  assert.ok(x.added.every(row=>row[6]==='公式サイト・運営者未確認'));
  assert.ok(x.added.every(row=>row[7].includes('営業送信禁止')));
  assert.equal(x.run(),'ALREADY_SEARCHED');
  assert.equal(x.requests.length,6);
});
test('already known domain is excluded from this service',()=>{
  const x=harness({apiKey:'test-key',
    leads:[{'サービス':'SPARK','公式URL':'https://example-school.jp/'}],
    results:[{url:'https://example-school.jp/course',title:'株式会社サンプルのプログラミング教室'}]});
  x.run();
  assert.ok(x.added.every(row=>row[2]!=='SPARK'));
});
