/* No Gmail messages, real Sheets edits, actual Cloudflare, or HTTP calls.
 * Contract-test the real GAS source against private in-memory mock services.
 */
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('scripts/mate_direct_intake.gs','utf8');
const uuid='3cdcb0aa-4c48-4332-93b1-f19911235b70';
const inquiryHeaders=['受付ID','受付日時','サービス','問い合わせ種別','事業者・教室ID','対象教室・事業者名','GmailメッセージID/証跡','希望教室ID（複数はカンマ区切り）','進捗','掲載許諾確認','体験取次許諾確認','保護者の情報提供同意','次回対応日','教室への取次日時','結果確認日','結果','担当者','メモ（氏名・健康情報は記入しない）'];
function sheet(header){
 const rows=[header.slice()];
 return {rows,getLastRow(){return rows.length},getRange(r,c,h=1,w=1){
  return {getDisplayValues(){return Array.from({length:h},(_,i)=>Array.from({length:w},(_,j)=>String(rows[r+i-1]?.[c+j-1]??'')))},
   setValues(values){if(values.length!==h)throw Error('row height mismatch');
    values.forEach((x,i)=>{if(x.length!==w)throw Error('col mismatch');while(rows.length<r+i)rows.push([]);x.forEach((v,j)=>{rows[r+i-1][c+j-1]=v})});}};
 }};
}
function env({captcha=true,action='mate_consult',host='kosuke-saito0807.github.io',canSend=true,owner=true,validTab=true}={}){
 const table=sheet(validTab?inquiryHeaders:['wrong-header']),sent=[],cache=new Map();
 const sandbox={
  Session:{getEffectiveUser:()=>({getEmail:()=>owner?'kosodatemate@gmail.com':'personal@example.org'})},
  SpreadsheetApp:{openById:()=>({getSheetByName:n=>n==='問い合わせ管理'?table:null})},
  PropertiesService:{getScriptProperties:()=>({getProperty:()=> 'server-private-test-secret'})},
  UrlFetchApp:{fetch:()=>({getResponseCode:()=>200,getContentText:()=>JSON.stringify({success:captcha,action,hostname:host})})},
  MailApp:{sendEmail(o){if(!canSend)throw Error('mail-delivery-unavailable');sent.push(o)}},
  LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock(){}})},
  CacheService:{getScriptCache:()=>({get:k=>cache.get(k),put:(k,v)=>cache.set(k,v)})},
  Utilities:{
    formatDate:()=> '2026-10-28 09:10:00',
    DigestAlgorithm:{SHA_256:'SHA_256'},
    computeDigest:(_alg,value)=>Array.from(require('node:crypto').createHash('sha256').update(value).digest()),
    base64EncodeWebSafe:buffer=>Buffer.from(buffer).toString('base64url')
  },
  HtmlService:{createHtmlOutput:body=>({body})},
  Date,JSON,Math,String,Number,Object,RegExp,Array,Error
 };
 vm.createContext(sandbox);vm.runInContext(source,sandbox,{filename:'mate_direct_intake.gs'});
 return {sandbox,table,sent,cache};
}
function params(service='PLAY'){
 return {intake_type:'family_consult',service,submission_id:uuid,
  email:'private-family@example.org',inquiryType:'体験・利用相談',
  area:'東京都北区',guardianName:'Private Family',phone:'03-9999-8888',
  message:'Private consultation content; contains no child data.',
  privacy_agree:'同意する',referral_interest:'案内を希望する（情報共有は別途同意）',
  'cf-turnstile-response':'mock-token-12345678901234567890'};
}
function submit(e,p){return e.sandbox.doPost({parameter:p,parameters:Object.fromEntries(Object.entries(p).map(([k,v])=>[k,[v]])),postData:{length:JSON.stringify(p).length}}).body}
function run(title,fn){try{fn();console.log('PASS',title)}catch(e){console.error('FAIL',title,e);process.exitCode=1}}
run('PLAY receives email, returns id and logs only metadata',()=>{
 const e=env(),p=params(),html=submit(e,p);
 assert.match(html,/ご相談を受け付けました/);
 assert.match(html,/MATE-CONSULT-/);
 assert.equal(e.sent.length,1);
 assert.equal(e.sent[0].to,'kosodatemate@gmail.com');
 assert.equal(e.sent[0].replyTo,p.email);
 assert.equal(e.table.rows.length,2);
 assert.equal(e.table.rows[1][8],'受付');
 assert.equal(e.table.rows[1][11],'同意済み');
 assert.ok(!JSON.stringify(e.table.rows).includes(p.email));
 assert.ok(!JSON.stringify(e.table.rows).includes(p.message));
 assert.ok(!JSON.stringify(e.table.rows).includes(p.phone));
 assert.ok(e.sent[0].body.includes(p.message));
 assert.ok(!e.sent[0].subject.includes('MATE PLAY'));
});
run('CARE uses same GAS and stores CARE service',()=>{
 const e=env();assert.match(submit(e,params('CARE')),/ご相談を受け付けました/);
 assert.equal(e.table.rows[1][2],'CARE');
});
run('same receipt id never sends another email',()=>{
 const e=env(),p=params();submit(e,p);submit(e,p);
 assert.equal(e.sent.length,1);assert.equal(e.table.rows.length,2);
});
run('missing consent fails closed',()=>{
 const e=env(),p=params();delete p.privacy_agree;
 assert.match(submit(e,p),/ご相談を受け付けられませんでした/);
 assert.equal(e.sent.length,0);assert.equal(e.table.rows.length,1);
});
run('failed Turnstile is rejected',()=>{
 const e=env({captcha:false});assert.match(submit(e,params()),/ご相談を受け付けられませんでした/);assert.equal(e.sent.length,0);
});
run('wrong Turnstile action is rejected',()=>{
 const e=env({action:'mate_listing'});assert.match(submit(e,params()),/ご相談を受け付けられませんでした/);assert.equal(e.sent.length,0);
});
run('wrong widget hostname is rejected',()=>{
 const e=env({host:'evil.example'});assert.match(submit(e,params()),/ご相談を受け付けられませんでした/);assert.equal(e.sent.length,0);
});
run('missing Gmail send keeps a retryable pending row',()=>{
 const e=env({canSend:false});assert.match(submit(e,params()),/ご相談を受け付けられませんでした/);
 assert.equal(e.table.rows.length,2);assert.equal(e.table.rows[1][8],'メール通知待ち');assert.equal(e.sent.length,0);
});
run('wrong sheet header prevents receipt and email',()=>{
 const e=env({validTab:false});assert.match(submit(e,params()),/ご相談を受け付けられませんでした/);
 assert.equal(e.sent.length,0);assert.equal(e.table.rows.length,1);
});
run('wrong GAS account cannot receive',()=>{
 const e=env({owner:false});assert.match(submit(e,params()),/ご相談を受け付けられませんでした/);
 assert.equal(e.sent.length,0);
});
run('honeypot refuses automated submission',()=>{
 const e=env(),p=params();p._honey='spam';
 assert.match(submit(e,p),/ご相談を受け付けられませんでした/);assert.equal(e.sent.length,0);
});
run('same email different receipt is throttled',()=>{
 const e=env(),p=params();submit(e,p);
 const q=params();q.submission_id='3cdcb0aa-4c48-4332-93b1-f19911235b71';
 assert.match(submit(e,q),/短時間に複数の相談は送れません/);
 assert.equal(e.sent.length,1);assert.equal(e.table.rows.length,2);
});
run('duplicate parameters rejected before mailing',()=>{
 const e=env(),p=params();
 const event={parameter:p,parameters:{service:['PLAY','CARE']},postData:{length:1900}};
 assert.match(e.sandbox.doPost(event).body,/ご相談を受け付けられませんでした/);
 assert.equal(e.sent.length,0);
});
run('unknown intake route rejected without changing listing',()=>{
 const e=env(),p=params();p.intake_type='unknown';
 assert.match(submit(e,p),/申請を受け付けられませんでした/);
 assert.equal(e.sent.length,0);
});
console.log('MATE family consultation GAS contract suite completed');
