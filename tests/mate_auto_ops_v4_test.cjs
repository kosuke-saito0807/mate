const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('scripts/mate_auto_ops_v4.gs','utf8');
let mails=0;
const reviewDrafts=[];
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
const review=sheet('営業審査下書きV4',['候補キー','作成日時','サービス','事業者名','状態','Gmail下書きID','確認元URL','備考']);
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
 PropertiesService:{getScriptProperties:()=>({getProperty:k=>settings[k],setProperty:(k,v)=>{settings[k]=v}})},
 MailApp:{getRemainingDailyQuota:()=>100},
 GmailApp:{sendEmail(){mails++;throw Error('test must never send')},search:()=>[],
  createDraft(to,subject,body){reviewDrafts.push({to,subject,body});return {getId:()=> 'draft-'+reviewDrafts.length}}},
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
const preview=JSON.parse(run('previewMateOutreachReadinessV4()'));
assert.equal(preview.mode,'READ_ONLY_NO_SEND');
assert.equal(preview.automationSwitch,'OFF');
assert.equal(preview.totalCandidateRows,leads.length-1);
assert.equal(preview.notEvidenceOfLegalPermission,true);
const operatorReport=run('checkMateAutoOpsV4()');
assert.equal(operatorReport.mode,'READ_ONLY_NO_SEND');
assert.equal(operatorReport.dailyLeadCycleInstalled,false);
assert.equal(operatorReport.ownerGrowthDigestInstalled,false);
assert.equal(operatorReport.totalCandidateRows,1);
assert.equal(operatorReport.automationSwitch,'OFF');

assert.deepEqual(Object.keys(preview.eligibleByScriptChecks).sort(),['CARE','PLAY','SPARK']);
assert.equal(mails,0,'preflight must never send external email');

settings.MATE_AUTO_SEND='ON';
assert.equal(run("mateV4SendOutreach()"),'OFF','legal gate must remain off');
settings.MATE_AUTO_SEND_LEGAL_REVIEWED='YES';
assert.equal(run("mateV4SendOutreach()"),'OFF','phase defaults to OFF');
settings.MATE_OUTREACH_PHASE='PILOT';
assert.throws(()=>run("mateV4SendOutreach()"),/実在する送信者名と所在地/);
settings.MATE_SENDER_NAME='NextEdu MATE運営';
settings.MATE_SENDER_ADDRESS='東京都北区 123 正式な営業所在地';
assert.equal(run("mateV4SendOutreach()"),0,'without qualified leads, send zero');
settings.MATE_OUTREACH_PHASE='OFF';
assert.equal(run("mateV4SendOutreach()"),'OFF','disabled phase blocks all sending');
settings.MATE_OUTREACH_PHASE='PILOT';
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
// Internal review drafting is automatic but NEVER addresses an unverified prospect.
assert.equal(run("mateV4PrepareReviewDrafts()"),1);
assert.equal(reviewDrafts.length,1);
assert.equal(reviewDrafts[0].to,'kosodatemate@gmail.com');
assert.match(reviewDrafts[0].subject,/社内確認専用・送信禁止/);
assert.equal(review.length,2,'one internal review state reserved');
assert.equal(review[1][4],'社内確認用ドラフト');
assert.equal(run("mateV4PrepareReviewDrafts()"),0,'never duplicate a review draft');

// A reply to an actually sent campaign is attributed without auto-answering.
leads[1][13]='営業可能候補';
log.push([leads[1][11],'2026-10-31 15:00:00','CARE','info@example.org',
  '【MATE CARE】無料掲載のご案内','送信済','https://www.example.org/contact','OPT_IN','']);
context.GmailApp.search=query=>query.includes('in:inbox newer_than:45d from:info@example.org')
  ?[{getMessages:()=>[{
      getFrom:()=> 'Company <info@example.org>',
      getSubject:()=> 'Re: 【MATE CARE】無料掲載のご案内',
      getDate:()=>new Date('2026-10-31T15:10:00+09:00'),
      getId:()=> 'reply-example-1'
    }]}]:[];
assert.equal(run("mateV4TrackReplies()"),1);
assert.equal(log.at(-1)[5],'返信あり');
assert.equal(leads[1][13],'返信あり・要対応');
assert.equal(run("mateV4TrackReplies()"),0,'reply triage is idempotent');
assert.equal(mails,0,'review drafts and reply monitoring never send mail');

// Blank worksheet rows must not skew source row numbers for future status updates.
sheet('gap-test',['item'],[['first'],[],['third']]);
const gapRows=run("mateV4Rows_(mateV4Tab_(mateV4Book_(),'gap-test'))");
assert.equal(gapRows.length,2);
assert.equal(gapRows[0]._row,2);
assert.equal(gapRows[1]._row,4,'physical row preserved after blank row');

// A licensed CSV is NOT evidence that a partner has opted into solicitation.
// Even a CSV that self-asserts OPT_IN must arrive in human-review state.
sheet('収集元設定V1',['サービス','ソース名','取得元CSV HTTPS URL','再利用許諾確認','有効','最終取込日時','前回結果'],[
 ['SPARK','Source with unreviewed opt-in claim','https://licensed.example.org/data.csv','確認済み','TRUE','','']
]);
context.UrlFetchApp={fetch:()=>({
 getResponseCode:()=>200,
 getBlob:()=>({getBytes:()=>Array(300).fill(65)}),
 getContentText:()=>[
 'service,name,website,region,email,contact_url,source_url,mail_basis,checked_at,solicitation_prohibited',
 'SPARK,Licensed Studio,https://licensed.example.org/,Tokyo,partners@licensed.example.org,https://licensed.example.org/contact,https://licensed.example.org/contact,OPT_IN,2026-11-01,FALSE'
 ].join('\n')
})};
context.Utilities.parseCsv=text=>text.trim().split(/\r?\n/).map(line=>line.split(','));
context.Utilities.computeDigest=(algo,input)=>Array.from({length:32},(_,i)=>(input.length+i*7)%256);
assert.equal(run("mateV4CollectLeads()"),1);
assert.equal(leads.at(-1)[13],'窓口確認待ち','unreviewed CSV must not become send-ready');
assert.equal(leads.at(-1)[9],'OPT_IN','claimed basis retained as unverified source data');
assert.equal(mails,0,'no outbound email is attempted');

/* Official-site audit: only self-published role emails with no visible
 * solicitation refusal are eligible, and only after an explicit sender opt-in. */
context.UrlFetchApp.fetch=url=>{
  if(!String(url).startsWith('https://licensed.example.org/'))throw Error('unexpected URL '+url);
  return {
    getResponseCode:()=>200,
    getBlob:()=>({getBytes:()=>Array(200).fill(65)}),
    getContentText:()=>'<html><body><h1>Licensed Studio</h1><a href="mailto:partners@licensed.example.org">お問い合わせ</a></body></html>'
  };
};
settings.MATE_PUBLIC_EMAIL_EXCEPTION_REVIEWED='NO';
assert.equal(run("mateV4RoleEmail_('ceo@example.org')"),'','personal employee email not for bulk marketing');
assert.equal(run("mateV4RoleEmail_('info@example.org')"),'info@example.org');
let audit=run("mateV4AuditOfficialContacts()");
assert.equal(audit.checked,1);
assert.equal(audit.eligible,0,'public page alone does not enable unsolicited sending');
assert.equal(leads.at(-1)[13],'公式公開メール確認済・送信待機');
assert.equal(leads.at(-1)[9],'PUBLIC_BUSINESS_EMAIL');
assert.equal(run("mateV4AuditOfficialContacts()").checked,0,'unapproved source is not scanned repeatedly');
settings.MATE_PUBLIC_EMAIL_EXCEPTION_REVIEWED='YES';
audit=run("mateV4AuditOfficialContacts()");
assert.equal(audit.checked,1,'recheck held evidence when user explicitly approves exception');
assert.equal(audit.eligible,1);
assert.equal(leads.at(-1)[13],'営業可能候補');
assert.equal(leads.at(-1)[8],'https://licensed.example.org/contact');
assert.equal(mails,0,'audit does not send to candidate');
const publishDone=leads.at(-1).slice();
publishDone[0]='AUTO-BLOCKED-COMPANY';
publishDone[11]='unique-blocked-1';
publishDone[3]='No solicitations';
publishDone[13]='窓口確認待ち';
publishDone[14]='';
leads.push(publishDone);
context.UrlFetchApp.fetch=url=>({
 getResponseCode:()=>200,
 getBlob:()=>({getBytes:()=>Array(400).fill(65)}),
 getContentText:()=>'<html><body><p>営業メールはお断りしております</p><a href="mailto:partners@licensed.example.org">contact</a></body></html>'
});
audit=run("mateV4AuditOfficialContacts()");
assert.equal(audit.eligible,0,'explicit solicitation refusal blocks auto qualification');
assert.equal(leads.at(-1)[13],'窓口確認待ち','prohibited lead stays out of queue');
settings.MATE_PUBLIC_SITE_AUDIT='OFF';
assert.equal(run("mateV4AuditOfficialContacts()"),'OFF');
assert.equal(mails,0,'no live third-party sending in any test');

// Verify discovery never follows a cross-origin contact link.
context.__testHtml='<html><a href="/contact/">Contact</a></html>';
assert.equal(run("mateV4ContactLink_(__testHtml,'https://company.example.org/')"),
  'https://company.example.org/contact/');
context.__testHtml='<html><a href="https://external.example.org/contact/">Contact</a></html>';
assert.equal(run("mateV4ContactLink_(__testHtml,'https://company.example.org/')"),
  '','external host excluded from first-party email search');
console.log('PASS: auto-send off by default, legal/identity gates, personal email exclusion, consent-only referral, idempotency, blank-row safety and source-review gates, public-business opt-in audit; NO email sent.');

/* Service classification is only for ranking, never a mail permission. */
assert.equal(run("mateV4FitScore_({'サービス':'SPARK','事業者名':'こどもピアノ教室'})"),3);
assert.equal(run("mateV4FitScore_({'サービス':'PLAY','事業者名':'陶芸ワークショップ'})"),3);
assert.equal(run("mateV4FitScore_({'サービス':'CARE','事業者名':'ベビーシッターサービス'})"),3);
assert.equal(run("mateV4FitScore_({'サービス':'PLAY','事業者名':'一般的な会社'})"),1);
const balanced=run("mateV4BalancedQueue_([{サービス:'CARE',事業者名:'ベビーシッター'}, {サービス:'SPARK',事業者名:'ピアノ教室'}, {サービス:'PLAY',事業者名:'陶芸体験'}],'2026-11-10')");
assert.equal(new Set([...balanced].map(x=>x['サービス'])).size,3,'three services all represented in balanced list');
const sameRecipient=run("mateV4BalancedQueue_([{サービス:'CARE',事業者名:'一般会社',業務用メール:'info@multi.example.org'}, {サービス:'SPARK',事業者名:'こどもピアノ教室',業務用メール:'info@multi.example.org'}],'2026-11-10')");
assert.equal(sameRecipient.length,1,'one email receives one MATE service pitch');
assert.equal(sameRecipient[0]['サービス'],'SPARK','choose the business-relevant service');

context.GmailApp.search=query=>query.startsWith('in:sent')
  ? [{getMessages:()=>[{
     getSubject:()=> '【MATE CARE】ベビーシッターサービス無料掲載のご相談',
     getFrom:()=> 'MATE運営事務局 <kosodatemate@gmail.com>',
     getTo:()=> 'Business <info@prior-example.org>'
  }]}]:[];
const prior=run("mateV4HistoricCampaignRecipients_()");
assert.equal(prior.has('info@prior-example.org'),true,'prior manual sent mails excluded from new campaigns');
assert.equal(prior.size,1);
context.GmailApp.search=query=>query.startsWith('in:sent')?Array(400).fill({getMessages:()=>[]}):[];
assert.throws(()=>run("mateV4HistoricCampaignRecipients_()"),/上限/,'history paging overflow blocks sending');
context.GmailApp.search=()=>[];

sheet('SPARK営業候補',['ID','企業・教室名','都県・対象','公式・窓口URL'],[
  ['school-1','登録済み候補と重複しないピアノ教室','東京都','https://new-music.example.org/']
]);
sheet('営業管理DB',['ID','事業者名','公式サイト','エリア'],[
  ['care-1','登録済み候補と重複しないベビーシッター','https://new-care-provider.example.org/','東京都']
]);
const extra=run('mateV4SeedSectorDirectories()');
assert.equal(extra.total,2,'two safe review-only sector candidates added');
assert.equal(extra.byService.CARE,1);assert.equal(extra.byService.SPARK,1);
assert.equal(leads.at(-1)[13],'窓口確認待ち');
assert.equal(leads.at(-1)[9],'UNVERIFIED');
assert.equal(run('mateV4SeedSectorDirectories()').total,0,'sector-seeding idempotent');

sheet('掲載セルフ申請',['申請ID','サービス','受付日時','審査状態'],[
  ['MATE-WEB-demo','SPARK','2026-10-31 10:00:00','未審査']
]);
let internalDigest=0;
context.MailApp.sendEmail=({to})=>{
  assert.equal(to,'kosodatemate@gmail.com');
  internalDigest++;
};
assert.equal(run('mateV4DailyGrowthDigest()').day,'2026-10-31');
assert.equal(internalDigest,1,'one operator-only digest');
assert.equal(run('mateV4DailyGrowthDigest()'),'ALREADY_DONE','no repeated operator digest');
assert.equal(internalDigest,1);
assert.equal(mails,0,'no external outreach ever sent by growth tests');
console.log('PASS: service ranking, fair cycling, historic Gmail dedupe, safe sector import, owner-only digest');
