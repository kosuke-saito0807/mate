const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('scripts/mate_auto_ops_v4.gs','utf8');
let mails=0;
const settings={};
const tabs={};
function sheet(name,header,rows=[]){
 const values=[header,...rows.map(row=>[...row])];
 tabs[name]={
  getDataRange(){return {getDisplayValues:()=>values.map(r=>[...r])}},
  appendRow(row){values.push(row)},
  getLastRow(){return values.length},
  getRange(row,col){return {setValue(v){values[row-1][col-1]=v},setValues(data){for(let i=0;i<data.length;i++)for(let j=0;j<data[i].length;j++)values[row-1+i][col-1+j]=data[i][j]}}}
 };
 return values;
}
const log=sheet('営業送信ログV4',['候補キー','送信処理日時','サービス','宛先メール','件名','状態','根拠URL','送信根拠','送信結果の備考']);
const stops=sheet('配信停止V1',['メール','登録日時','理由','証跡メールID']);
const leads=sheet('営業候補_自動収集',['候補ID','取得日時','サービス','事業者名','公式URL','都道府県・地域','業務用メール','窓口URL','確認元URL','メール用途・営業可の根拠','根拠確認日時','重複キー','営業拒否','状態','最終確認結果','備考']);
const referrals=sheet('送客実績V1',['イベントID','発生日時','サービス','掲載先ID','事業者名','イベント種別','受付ID','集計対象','情報提供同意証跡','取次日時','結果','結果確認日時','契約上の成果単価（税込円）','確定売上（税込円）','証跡ID','備考']);
const inquiries=sheet('問い合わせ管理',['受付ID','受付日時','サービス','問い合わせ種別','事業者・教室ID','対象教室・事業者名','GmailメッセージID/証跡','希望教室ID（複数はカンマ区切り）','進捗','掲載許諾確認','体験取次許諾確認','保護者の情報提供同意','次回対応日','教室への取次日時','結果確認日','結果','担当者','メモ（氏名・健康情報は記入しない）'],[
 ['MATE-CONSULT-test-no-consent','2026-10-31','CARE','','provider-001','テスト','mail-id','','教室へ取次','未確認','確認済み','確認済み','','2026-10-31'],
 ['MATE-CONSULT-test-valid','2026-10-31','PLAY','','provider-002','事業者A','mail-ok','','教室へ取次','確認済み','確認済み','確認済み','','2026-10-31']
]);
const crm=sheet('3サービス営業リスト',['ID','サービス','企業・教室名','公式・窓口URL','エリア','メール（未再確認）','確認日'],[
 ['CARE-DEMO','CARE','掲載未許諾のテスト会社','https://www.example.org/contact','東京都','info@example.org','2026-10-31']
]);
const book={getSheetByName:n=>tabs[n]};
const context=vm.createContext({
 Session:{getEffectiveUser:()=>({getEmail:()=> 'kosodatemate@gmail.com'})},
 SpreadsheetApp:{openById:()=>book},
 PropertiesService:{getScriptProperties:()=>({getProperty:k=>settings[k]})},
 MailApp:{getRemainingDailyQuota:()=>100},
 GmailApp:{sendEmail(){mails++;throw Error('test must never send')},search:()=>[]},
 ScriptApp:{getProjectTriggers:()=>[],newTrigger:()=>{throw Error('not expected')}},
 LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock:()=>{}})},
 Utilities:{
  formatDate:()=> '2026-10-31 15:00:00',
  computeDigest:()=>Array.from({length:32},(_,i)=>i+1),
  DigestAlgorithm:{SHA_256:'SHA_256'},
 },
 URL:undefined,Date,console
});
vm.runInContext(source,context,{filename:'mate_auto_ops_v4.gs'});
const run=(expr)=>vm.runInContext(expr,context);
assert.equal(run("mateV4Https_('https://www.example.org/contact')"),true,'validate HTTPS without unavailable URL Web API');
assert.equal(run("mateV4Https_('http://example.org/')"),false);
assert.equal(run("mateV4Https_('https://user@example.org/')"),false);
assert.equal(run("mateV4Https_('https://example.org:8443/')"),false);
assert.equal(run("mateV4SeedExistingCRM()"),1,'seed existing verified CRM names into no-send review queue');
assert.equal(run("mateV4SeedExistingCRM()"),0,'CRM seeding is idempotent');
assert.equal(leads.length,2);
assert.equal(leads[1][13],'窓口確認待ち','never infer solicitation permission from an existing CRM record');
assert.equal(run("mateV4SendOutreach()"),'OFF','default mail must remain off');
settings.MATE_AUTO_SEND='ON';
assert.equal(run("mateV4SendOutreach()"),'OFF','legal gate must remain off');
settings.MATE_AUTO_SEND_LEGAL_REVIEWED='YES';
assert.throws(()=>run("mateV4SendOutreach()"),/実在する送信者名と所在地/);
settings.MATE_SENDER_NAME='NextEdu MATE運営';
settings.MATE_SENDER_ADDRESS='東京都北区 123 正式な営業所在地';
assert.equal(run("mateV4SendOutreach()"),0,'without qualified leads, send zero');
assert.equal(mails,0);
assert.equal(run("mateV4Email_('personal@gmail.com')"),'','exclude personal email');
assert.equal(run("mateV4Email_('partner@example.org')"),'partner@example.org');
assert.equal(run("mateV4SyncReferralLedger()"),1,'only fully consented referral is logged');
assert.equal(referrals.length,2);
assert.equal(referrals[1][2],'PLAY');
assert.equal(referrals[1][5],'取次実施');
assert.equal(run("mateV4SyncReferralLedger()"),0,'idempotent referral import');
assert.equal(referrals.length,2);
assert.equal(inquiries.length,3,'source inquiry rows stay intact');
console.log('PASS: auto-send off by default, legal/identity gates, personal email exclusion, consent-only referral, idempotency; NO email sent.');
