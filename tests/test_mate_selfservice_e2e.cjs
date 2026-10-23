/* Execute actual GAS intake/publish code against fake Gmail and Sheets. Never contacts anyone. */
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
class Sheet{
 constructor(header){this.rows=[header.slice()]}
 getLastRow(){return this.rows.length}
 getLastColumn(){return this.rows[0].length}
 getDataRange(){return this.getRange(1,1,this.getLastRow(),this.getLastColumn())}
 getRange(row,col,rows=1,cols=1){
  const sh=this;
  return {
   getDisplayValues:()=>Array.from({length:rows},(_,i)=>Array.from({length:cols},(_,j)=>String(sh.rows[row-1+i]?.[col-1+j]??''))),
   setValues(values){assert.equal(values.length,rows);for(let i=0;i<rows;i++){assert.equal(values[i].length,cols);while(sh.rows.length<row+i)sh.rows.push([]);for(let j=0;j<cols;j++)sh.rows[row+i-1][col+j-1]=String(values[i][j]??'')}},
   setValue(v){this.setValues([[v]])}
  }
 }
}
const headings=['申請ID','受信日時','サービス','教室・事業者名','公式URL','都道府県','市区町村・対応エリア','ジャンル','対象区分','紹介文','月謝（税込円）','体験料金（税込円）','対象最少年齢','対象最高年齢','曜日','最寄駅','タグ','次回体験予定日','料金メモ','対応時間','情報確認日','掲載申請の意思','取次相談の希望','GmailメッセージID','審査状態','担当者権限の確認','審査者','公開ID','保留・差戻し理由'];
const tabs={
 '掲載セルフ申請':new Sheet(headings),
 '営業管理DB':new Sheet(['ID','事業者名','エリア','MATE掲載ステータス','公式サイト','営業ステータス','掲載許可','掲載情報確認日','料金プラン','掲載紹介文','サービス区分','料金メモ','対応時間','特徴タグ','メモ']),
 'SPARK営業候補':new Sheet(['ID','企業・教室名','都県・対象','ジャンル','公式・窓口URL','掲載許諾','対象学年（カンマ区切り）','最寄駅','掲載紹介文','体験受付許諾','掲載内容確認日','教室所在地','月謝税込円']),
 '掲載契約':new Sheet(['契約ID','サービス','掲載先ID','企業・教室名','プラン','合意証拠URL・メールID','状態','同意者','同意日時','条件版'])
};
const messages=[];
function message(svc,id){
 const payload={service:svc,company:'QA架空テスト事業者（絶対に公開しない）',
  website:'https://example.org/',region:'東京都',city:'文京区',
  category:svc==='CARE'?'ベビーシッター':'音楽',ages:'小学生',
  description:'この申請は完全に架空のE2E動作検証用データです。実在の教室でも契約でもなく公開しません。',
  monthlyPrice:'8000',ageMin:'6',ageMax:'12',
  listing_content_checked_at:'2026-10-23',listing_permission:'掲載の意向（別途合意）',
  trial_referral_consent:''};
 const encoded='MATE_LISTING_V1__'+Buffer.from(JSON.stringify(payload),'utf8').toString('base64');
 return {getId:()=>id,getTo:()=> 'kosodatemate@gmail.com',
  getSubject:()=> 'MATE '+svc+' 無料掲載セルフ登録',
  getDate:()=>new Date('2026-10-23T03:00:00+09:00'),
  getPlainBody:()=> 'listing_payload_b64: '+encoded+'\nprivate-mail: qa@example.invalid',
  getBody:()=> '<pre>'+encoded+'</pre>'};
}
const context={
 Session:{getEffectiveUser:()=>({getEmail:()=> 'kosodatemate@gmail.com'})},
 LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock(){}})},
 SpreadsheetApp:{openById:()=>({getSheetByName:n=>tabs[n]||null})},
 GmailApp:{search:()=>[{getMessages:()=>messages}]},
 Utilities:{base64Decode:s=>Array.from(Buffer.from(s,'base64')),
  newBlob:x=>({getDataAsString:()=>Buffer.from(x).toString('utf8')}),
  formatDate:()=> '2026-10-23 12:00:00'},
 Date,console
};
vm.createContext(context);
vm.runInContext(fs.readFileSync('scripts/mate_self_service.gs','utf8'),context);
const call=e=>vm.runInContext(e,context);
messages.push(message('SPARK','QA-SPARK-001'));
assert.equal(call('syncMateSelfServiceApplications()'),1);
assert.equal(call('syncMateSelfServiceApplications()'),0);
let row=tabs['掲載セルフ申請'].rows[1];
assert.equal(row[2],'SPARK');assert.equal(row[24],'未審査');
assert.equal(JSON.stringify(row).includes('qa@example.invalid'),false);
assert.equal(call('publishReviewedMateApplications()'),0);
row[24]='承認';assert.equal(call('publishReviewedMateApplications()'),0);
row[25]='確認済み';assert.equal(call('publishReviewedMateApplications()'),0);
row[26]='QA reviewer';assert.equal(call('publishReviewedMateApplications()'),1);
assert.equal(tabs['SPARK営業候補'].getLastRow(),2);
assert.equal(tabs['掲載契約'].getLastRow(),2);
const contractHeader=tabs['掲載契約'].rows[0],contract=tabs['掲載契約'].rows[1];
assert.equal(contract[contractHeader.indexOf('状態')],'未契約');
assert.equal(contract[contractHeader.indexOf('同意者')],'');
assert.equal(call('publishReviewedMateApplications()'),0);
console.log('PASS SPARK: fake email → unreviewed → authorized approval → INACTIVE contract draft, no public listing');
messages.push(message('CARE','QA-CARE-002'));
assert.equal(call('syncMateSelfServiceApplications()'),1);
row=tabs['掲載セルフ申請'].rows[2];row[24]='承認';row[25]='確認済み';row[26]='QA reviewer';
assert.equal(call('publishReviewedMateApplications()'),1);
assert.equal(tabs['営業管理DB'].getLastRow(),2);
assert.equal(call('publishReviewedMateApplications()'),0);
console.log('PASS CARE: reviewer-required transfer, deduplicated');
messages.push(message('PLAY','QA-PLAY-003'));
assert.equal(call('syncMateSelfServiceApplications()'),1);
row=tabs['掲載セルフ申請'].rows[3];row[24]='承認';row[25]='確認済み';row[26]='QA reviewer';
assert.equal(call('publishReviewedMateApplications()'),0);
assert.equal(row[27]||'','');
console.log('PASS PLAY: recorded but NEVER auto-published into independent Sites CMS');
console.log('PASS simulated end-to-end of actual GAS; NO live Gmail, no FormSubmit email, no real published records');
