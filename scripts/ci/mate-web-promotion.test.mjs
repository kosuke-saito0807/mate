import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const source=fs.readFileSync(path.resolve(import.meta.dirname,'../mate_auto_ops_v4.gs'),'utf8');
const start=source.indexOf('function mateV4PromoteFreeWebCandidates(){');
const end=source.indexOf('function mateV4ProductionHeartbeat_(',start);
assert.ok(start>0&&end>start);
const code=source.slice(start,end);
function setup({html='子どもプログラミング教室ホシゾラ 教室案内',status=200}={}){
 const writes=[],newLeads=[],requests=[];
 const queue={
   getRange:(row,col)=>({setValue:value=>writes.push({row,col,value})})
 };
 const candidate={'_row':2,'サービス':'SPARK','候補URL':'https://hoshizora.example.jp/',
  '検索タイトル':'子どもプログラミング教室ホシゾラ','検索語':'公開地図'};
 const mocks={
  PropertiesService:{getScriptProperties:()=>({getProperty:()=>''})},
  mateV4Book_:()=>({}),
  mateV4Tab_:(_b,name)=>name==='営業候補_Web検索_未確認'?queue:name,
  MATE_V4:{leads:'営業候補_自動収集'},
  mateV4Rows_:sheet=>sheet===queue?[{...candidate,'状態':'公式URL・運営者未確認'}]:[],
  mateV4CandidateHttps_:s=>String(s).startsWith('https://')?s:'',
  mateV4Host_:u=>(/^https:\/\/([^/]+)/.exec(String(u))||[])[1]||'',
  mateV4OwnerBlocked_:()=>false,
  mateV4Key_:()=> 'unique',
  mateV4Jst_:()=> '2026-11-15 12:00:00',
  mateV4Append_:(_sheet,row)=>newLeads.push(row),
  UrlFetchApp:{fetch:(u,opts)=>{requests.push({u,opts});return {
    getResponseCode:()=>status,getHeaders:()=>({'Content-Type':'text/html'}),
    getContentText:()=>'<html><body>'+html+'</body></html>'
  }}}
 };
 const fn=new Function(...Object.keys(mocks),code+'\nreturn mateV4PromoteFreeWebCandidates;')(...Object.values(mocks));
 return {fn,writes,newLeads,requests};
}
test('only verified first-party business name becomes UNVERIFIED audit lead',()=>{
 const h=setup();const result=h.fn();
 assert.equal(result.promoted,1);assert.equal(result.sendApproved,0);
 assert.equal(h.newLeads[0][9],'UNVERIFIED');
 assert.equal(h.newLeads[0][13],'窓口確認待ち');
 assert.equal(h.newLeads[0][6],'');
 assert.equal(h.requests[0].opts.followRedirects,false);
});
test('name mismatch does not create contactable lead',()=>{
 const h=setup({html:'オンラインショップへようこそ'});
 assert.equal(h.fn().promoted,0);assert.equal(h.newLeads.length,0);
});
test('remote errors do not create leads',()=>{
 const h=setup({status:503});
 assert.equal(h.fn().promoted,0);assert.equal(h.newLeads.length,0);
});
