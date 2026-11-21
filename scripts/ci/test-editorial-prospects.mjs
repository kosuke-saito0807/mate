import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync('scripts/mate_auto_ops_v4.gs','utf8');
const HEADERS=['候補ID','取得日時','サービス','事業者名','公式URL','都道府県・地域',
  '業務用メール','窓口URL','確認元URL','メール用途・営業可の根拠','根拠確認日時',
  '重複キー','営業拒否','状態','最終確認結果','備考'];
const care=[
  {id:'editorial-a',name:'Aベビーシッター',url:'https://a-sitter.co.jp/',
    region:'東京都',editorial:true,approved:false},
  {id:'editorial-b',name:'Bシッター',url:'https://b-sitter.co.jp/',
    region:'東京都・神奈川県',editorial:true,approved:false},
  {id:'editorial-dup',name:'既存事業者',url:'https://existing.co.jp/new',
    region:'千葉県',editorial:true,approved:false},
  {id:'editorial-approved',name:'承認済み',url:'https://owner-approval.co.jp',
    region:'埼玉県',editorial:true,approved:true},
  {id:'editorial-blocked',name:'CodeCampKIDS',url:'https://kids-coding.co.jp',
    region:'東京都',editorial:true,approved:false},
  {id:'editorial-bad',name:'架空',url:'http://not-secure.co.jp',
    region:'東京都',editorial:true,approved:false}
];
const spark=[
  {id:'editorial-school-a',name:'A音楽スクール',url:'https://a-music.co.jp',
    region:'東京都',editorial:true,approved:false},
  {id:'editorial-school-clone',name:'A音楽スクール',url:'https://other-music.co.jp',
    region:'千葉県',editorial:true,approved:false},
  {id:'editorial-unauth',name:'未確認の外部掲載',url:'https://other-lesson.co.jp',
    region:'全国',editorial:false,approved:false}
];
function environment() {
  const rows=[HEADERS,
    ['CRM-abc','2026-11-20','CARE','既存事業者','https://existing.co.jp/','','','','','','','abc','FALSE','営業可能候補','','']
  ];
  const fetched=[];
  const sheet={
    getDataRange(){return {getDisplayValues(){return rows.map(r=>[...r])}}},
    getLastRow(){return rows.length},
    getRange(start,col,count,width){return {setValues(values){
      assert.equal(col,1);
      assert.equal(count,values.length);
      assert.equal(width,16);
      for(let i=0;i<count;i++)rows[start-1+i]=[...values[i]];
    }}}
  };
  const context=vm.createContext({
    Session:{getEffectiveUser(){return {getEmail(){return 'kosodatemate@gmail.com'}}}},
    SpreadsheetApp:{openById(){return {getSheetByName(){return sheet}}}},
    PropertiesService:{getScriptProperties(){return {getProperty(){return null}}}},
    Utilities:{
      DigestAlgorithm:{SHA_256:'SHA_256'},
      computeDigest(_algorithm,plain){return [...crypto.createHash('sha256').update(plain).digest()]
        .map(x=>x>127?x-256:x)},
      formatDate(){return '2026-11-21 14:10:00'}
    },
    UrlFetchApp:{fetch(url,opts){
      fetched.push({url,opts});
      const content=url==='https://care.kosodatemate.jp/editorial-care.json'?
        JSON.stringify(care):url==='https://spark.kosodatemate.jp/editorial-schools.json'?
        JSON.stringify(spark):null;
      assert.ok(content,'no untrusted remote fetch');
      return{getResponseCode(){return 200},getContentText(){return content}};
    }},
    console:{log(){}},
  });
  vm.runInContext(source,context,{timeout:2000});
  return {context,rows,fetched};
}
test('Editorial public references seed only unverified, deduplicated research leads',()=>{
  const e=environment();
  const result=e.context.mateV4SeedEditorialProspects();
  assert.equal(result.appended,3);
  assert.equal(result.byService.CARE,2);
  assert.equal(result.byService.SPARK,1);
  assert.equal(result.sendApproved,0);
  assert.equal(result.duplicateHost,1);
  assert.equal(result.duplicateName,1);
  const added=e.rows.slice(2);
  for(const r of added){
    assert.equal(r.length,16);
    assert.equal(r[6],'','email intentionally empty');
    assert.equal(r[9],'UNVERIFIED');
    assert.equal(r[12],'未確認');
    assert.equal(r[13],'窓口確認待ち');
    assert.match(r[14],/送信不可/);
    assert.match(r[15],/^REFERENCE_ID=editorial-/);
  }
  assert.ok(added.some(r=>r[3]==='Bシッター' && r[5]==='東京都・神奈川県'));
  assert.ok(!added.some(r=>r[3]==='CodeCampKIDS'));
  assert.ok(!added.some(r=>r[3]==='承認済み'));
  assert.equal(e.fetched.length,2);
  for(const x of e.fetched){
    assert.match(x.url,/^https:\/\/(?:care|spark)\.kosodatemate\.jp\/editorial-(?:care|schools)\.json$/);
    assert.equal(x.opts.followRedirects,false);
  }
});
test('Repeat import is idempotent; duplicate emails are never synthesized',()=>{
  const e=environment();
  const first=e.context.mateV4SeedEditorialProspects();
  const count=e.rows.length;
  const second=e.context.mateV4SeedEditorialProspects();
  assert.equal(first.appended,3);
  assert.equal(second.appended,0);
  assert.equal(e.rows.length,count);
});
test('No Gmail, approval, publish or billing calls are made in editorial import',()=>{
  const fn=source.split('function mateV4SeedEditorialProspects(){',2)[1]
    .split('/** Business fit is a rank hint',2)[0];
  for(const unsafe of ['GmailApp.', 'MailApp.', 'sendEmail(', 'doPost(', 'grantApproval',
    'publishMate', 'authorizeListing','chargeCard','getRange(2,14)'])
    assert.ok(!fn.includes(unsafe),unsafe);
  assert.ok(fn.includes("source:'MATE_UNAPPROVED_EDITORIAL'"));
});
