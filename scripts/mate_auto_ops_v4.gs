/**
 * MATE AutoOps V4: prospect CSV import, opt-out quarantine, low-volume
 * first-contact outreach and evidence-gated referral ledger.
 *
 * Install as an additional .gs file in the existing dedicated MATE Google Apps
 * Script project. Uses existing Sheets; does not alter form handlers or CMS.
 * Initial state: all mail OFF. Does NOT approve a listing or share family PII.
 * CSV input is limited to owner-approved, appropriately licensed HTTPS sources.
 *
 * Required Script Properties to enable actual mail:
 *   MATE_AUTO_SEND = ON
 *   MATE_SENDER_NAME = accurate sender name / operator
 *   MATE_SENDER_ADDRESS = valid real sender postal address
 *   MATE_AUTO_SEND_LEGAL_REVIEWED = YES
 *   (optional) MATE_DAILY_CAP = 5, maximum 5
 */
const MATE_V4=Object.freeze({
  bookId:'1CLJeXuznctRtH8Y3AMZ2XyOu3dQedmh9obBDrPlIEuQ',
  account:'kosodatemate@gmail.com',
  sources:'収集元設定V1',leads:'営業候補_自動収集',
  sent:'営業送信ログV4',optouts:'配信停止V1',
  inquiries:'問い合わせ管理',referrals:'送客実績V1',
  maxCSVBytes:600000,maxNewLeadsPerRun:100,version:'2026-10-31'
});
function mateV4Book_(){
  if(String(Session.getEffectiveUser().getEmail()||'').toLowerCase()!==MATE_V4.account)
    throw Error('MATE専用アカウントで実行してください');
  return SpreadsheetApp.openById(MATE_V4.bookId);
}
function mateV4Tab_(b,name){
  const s=b.getSheetByName(name);if(!s)throw Error('必須タブなし: '+name);return s;
}
function mateV4Rows_(s){
  const data=s.getDataRange().getDisplayValues();
  if(data.length<2)return [];
  const headings=data.shift();
  return data.filter(r=>r.some(c=>String(c).trim())).map((r,i)=>{
    const o={_row:i+2};headings.forEach((h,j)=>o[h]=String(r[j]||'').trim());return o;
  });
}
function mateV4San_(s,n){
  const v=String(s==null?'':s).trim().replace(/[\x00-\x08\x0b-\x1f]/g,'').slice(0,n);
  return /^[=+\-@]/.test(v)?"'"+v:v;
}
function mateV4Append_(s,values){s.appendRow(values.map(v=>mateV4San_(v,900)))}
function mateV4Jst_(){return Utilities.formatDate(new Date(),'Asia/Tokyo','yyyy-MM-dd HH:mm:ss')}
function mateV4Date_(s){if(!/^\d{4}-\d{2}-\d{2}$/.test(String(s)))return null;const d=new Date(s+'T00:00:00+09:00');return Number.isFinite(+d)?d:null}
function mateV4Fresh_(s,maxDays){
  const d=mateV4Date_(s);return !!d&&Date.now()-d.getTime()>=0&&Date.now()-d.getTime()<=maxDays*86400000;
}
function mateV4Https_(s){
  try{const u=new URL(s);return u.protocol==='https:'&&!!u.hostname&&u.hostname.includes('.')&&!u.username&&!u.password&&s.length<=500}catch(e){return false}
}
function mateV4Email_(s){
  const x=String(s||'').trim().toLowerCase();
  if(!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(x)||x.length>250)return '';
  // Avoid mistakenly marketing to private personal inboxes.
  if(/@(gmail\.com|yahoo\.co\.jp|yahoo\.com|icloud\.com|outlook\.com|hotmail\.com)$/i.test(x))return '';
  return x;
}
function mateV4Key_(service,website,name){
  const u=new URL(website);const host=u.hostname.replace(/^www\./,'').toLowerCase();
  const input=service+'|'+host+'|'+String(name||'').trim().toLowerCase();
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,input)
    .slice(0,14).map(x=>('0'+((x+256)%256).toString(16)).slice(-2)).join('');
}
function mateV4SourceCsv_(url){
  if(!mateV4Https_(url))throw Error('CSVは公開HTTPS URLのみ');
  const resp=UrlFetchApp.fetch(url,{muteHttpExceptions:true,followRedirects:false,timeout:15000});
  if(resp.getResponseCode()!==200)throw Error('CSV HTTP '+resp.getResponseCode());
  if(resp.getBlob().getBytes().length>MATE_V4.maxCSVBytes)throw Error('CSV exceeds size limit');
  const rows=Utilities.parseCsv(resp.getContentText('UTF-8'));
  const keys=(rows.shift()||[]).map(s=>String(s).trim().toLowerCase());
  const required=['service','name','website','region','email','contact_url','source_url','mail_basis','checked_at','solicitation_prohibited'];
  if(required.every(k=>keys.includes(k)))
    return rows.map(row=>{const o={};keys.forEach((k,i)=>o[k]=String(row[i]||'').trim());return o});
  // Also accept common official Japanese open-data CSV headers for prospect discovery.
  // Public facility listings are not proof that mail contact is permitted.
  const columns={
    name:['事業者名','法人名','企業名','教室名','施設名','名称','事業所名'],
    website:['公式url','ホームページ','ホームページurl','ウェブサイト','webサイト','url','公式サイト'],
    region:['都道府県','住所','所在地','地域','エリア'],
    email:['メール','メールアドレス','公開メール'],
    contact_url:['問い合わせurl','問合せurl','お問い合わせurl'],
  };
  const at=k=>{for(const alias of columns[k]){const i=keys.indexOf(alias);if(i>=0)return i}return -1};
  const indexes={};for(const key of Object.keys(columns))indexes[key]=at(key);
  if(indexes.name<0||indexes.website<0)throw Error('公開CSVに事業者名/公式サイトURLがないため取込停止');
  return rows.map(row=>{
    const get=k=>indexes[k]<0?'':String(row[indexes[k]]||'').trim();
    return {name:get('name'),website:get('website'),region:get('region'),
      email:get('email'),contact_url:get('contact_url'),service:'',
      source_url:url,mail_basis:'UNVERIFIED',
      checked_at:mateV4Jst_().slice(0,10),solicitation_prohibited:'FALSE'};
  });
}
/**
 * The owner must provide a licensed, public HTTPS CSV in 収集元設定V1.
 * Each source row needs 再利用許諾確認=確認済み and 有効=TRUE.
 * No search-engine scraping, personal contacts, or inferred email addresses.
 */
function mateV4SeedExistingCRM(){
  const b=mateV4Book_(),dest=mateV4Tab_(b,MATE_V4.leads);
  const existing=new Set(mateV4Rows_(dest).map(x=>x['重複キー']).filter(Boolean));
  const rows=mateV4Rows_(mateV4Tab_(b,'3サービス営業リスト'));
  let added=0;
  for(const x of rows){
    if(added>=MATE_V4.maxNewLeadsPerRun)break;
    const svc=x['サービス'],name=x['企業・教室名'],url=x['公式・窓口URL'];
    if(!['CARE','SPARK','PLAY'].includes(svc)||!name||!mateV4Https_(url))continue;
    const key=mateV4Key_(svc,url,name);
    if(existing.has(key))continue;
    mateV4Append_(dest,[
      'CRM-'+key,mateV4Jst_(),svc,name,url,x['エリア']||'',
      mateV4Email_(x['メール（未再確認）']),url,url,'UNVERIFIED',x['確認日']||'',
      key,'FALSE','窓口確認待ち','既存CRMより引継ぎ。公開メールは自動送信の許可証拠ではない。',
      'CRM ID='+x['ID']
    ]);
    existing.add(key);added++;
  }
  return added;
}
function mateV4CollectLeads(){
  const b=mateV4Book_(),src=mateV4Tab_(b,MATE_V4.sources),dest=mateV4Tab_(b,MATE_V4.leads);
  const sources=mateV4Rows_(src),existing=mateV4Rows_(dest);
  const seen=new Set(existing.map(x=>x['重複キー']).filter(Boolean));
  const known=new Set(mateV4Rows_(mateV4Tab_(b,'3サービス営業リスト'))
    .filter(x=>mateV4Https_(x['公式・窓口URL']))
    .map(x=>{try{return mateV4Key_(x['サービス'],x['公式・窓口URL'],x['企業・教室名'])}catch(e){return ''}}));
  let count=0;
  for(const source of sources){
    if(source['有効']!=='TRUE'||source['再利用許諾確認']!=='確認済み'||!mateV4Https_(source['取得元CSV HTTPS URL']))continue;
    const service=source['サービス'];if(!['CARE','SPARK','PLAY'].includes(service))continue;
    let rows;
    try{rows=mateV4SourceCsv_(source['取得元CSV HTTPS URL'])}
    catch(e){src.getRange(source._row,7).setValue('取得失敗: '+String(e).slice(0,180));continue}
    let imported=0;
    for(const x of rows){
      if(count>=MATE_V4.maxNewLeadsPerRun)break;
      if((x.service&&x.service!==service)||!x.name||!mateV4Https_(x.website)||!mateV4Https_(x.source_url))continue;
      const id=mateV4Key_(service,x.website,x.name);
      if(seen.has(id)||known.has(id))continue;
      const deny=/^(true|yes|1|禁止)$/i.test(x.solicitation_prohibited);
      const mail=mateV4Email_(x.email);
      const checked=mateV4Fresh_(x.checked_at,14);
      const basis=['OPT_IN','SOLICITATIONS_WELCOME'].includes(x.mail_basis)?x.mail_basis:'UNVERIFIED';
      const state=deny?'配信禁止':(mail&&checked&&basis!=='UNVERIFIED'?'営業可能候補':'窓口確認待ち');
      mateV4Append_(dest,[
        'AUTO-'+id,mateV4Jst_(),service,x.name,x.website,x.region||'',
        mail,x.contact_url||'',x.source_url,basis,x.checked_at||'',id,
        deny?'TRUE':'FALSE',state,'ソース由来の情報。掲載・取次の許諾は未取得。',''
      ]);
      seen.add(id);count++;imported++;
    }
    src.getRange(source._row,6,1,2).setValues([[mateV4Jst_(),String(imported)+' 件取込']]);
  }
  return count;
}
function mateV4OptoutInbox(){
  const b=mateV4Book_(),sheet=mateV4Tab_(b,MATE_V4.optouts);
  const old=new Set(mateV4Rows_(sheet).map(x=>x['メール'].toLowerCase()));
  const logged=new Set(mateV4Rows_(mateV4Tab_(b,MATE_V4.sent)).map(x=>x['宛先メール'].toLowerCase()));
  let count=0;
  // Only business addresses we have actually contacted; never copy message text.
  for(const thread of GmailApp.search('in:inbox newer_than:45d',0,80)){
    for(const msg of thread.getMessages()){
      const raw=String(msg.getFrom()||'').toLowerCase();
      const m=raw.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/);
      const addr=m&&m[0];if(!addr||old.has(addr)||!logged.has(addr))continue;
      const txt=(String(msg.getSubject()||'')+'\n'+String(msg.getPlainBody()||'').slice(0,500)).trim();
      if(!/^(配信停止|メール不要|今後連絡不要|unsubscribe|stop)(\s|$)/i.test(txt)&&
        !/配信停止(をお願いします|希望します)|please unsubscribe/i.test(txt))continue;
      mateV4Append_(sheet,[addr,mateV4Jst_(),'受信者からの配信停止希望',msg.getId()]);
      old.add(addr);count++;
    }
  }
  return count;
}
function mateV4SendOutreach(){
  const b=mateV4Book_(),p=PropertiesService.getScriptProperties();
  if(p.getProperty('MATE_AUTO_SEND')!=='ON'||p.getProperty('MATE_AUTO_SEND_LEGAL_REVIEWED')!=='YES')return 'OFF';
  const sender=String(p.getProperty('MATE_SENDER_NAME')||'').trim();
  const address=String(p.getProperty('MATE_SENDER_ADDRESS')||'').trim();
  if(sender.length<2||address.length<10||/未設定|\[.+\]/.test(address))throw Error('実在する送信者名と所在地を設定');
  const cap=Math.min(5,Math.max(0,parseInt(p.getProperty('MATE_DAILY_CAP')||'5',10)||0));
  const leads=mateV4Rows_(mateV4Tab_(b,MATE_V4.leads));
  const sheet=mateV4Tab_(b,MATE_V4.sent);
  const logs=mateV4Rows_(sheet);
  const blocked=new Set(mateV4Rows_(mateV4Tab_(b,MATE_V4.optouts)).map(x=>x['メール'].toLowerCase()));
  const attempted=new Set(logs.map(x=>x['候補キー']).filter(Boolean));
  const allRecipients=new Set(logs.map(x=>x['宛先メール'].toLowerCase()).filter(Boolean));
  const today=mateV4Jst_().slice(0,10);
  const already=logs.filter(x=>x['送信処理日時'].startsWith(today)).length;
  let sent=0;
  if(MailApp.getRemainingDailyQuota()<1)return 0;
  for(const x of leads){
    if(sent+already>=cap||sent>=MailApp.getRemainingDailyQuota())break;
    if(x['状態']!=='営業可能候補'||x['営業拒否']!=='FALSE')continue;
    if(!mateV4Fresh_(x['根拠確認日時'],14)||!mateV4Https_(x['確認元URL']))continue;
    if(!['OPT_IN','SOLICITATIONS_WELCOME'].includes(x['メール用途・営業可の根拠']))continue;
    const email=mateV4Email_(x['業務用メール']);
    const key=x['重複キー'];if(!email||!key||attempted.has(key)||blocked.has(email)||allRecipients.has(email))continue;
    const service=x['サービス'];
    if(!['CARE','SPARK','PLAY'].includes(service))continue;
    const link=service==='PLAY'?'https://care.kosodatemate.jp/play-listing.html':
      service==='SPARK'?'https://spark.kosodatemate.jp/partners.html':'https://care.kosodatemate.jp/contact.html';
    const subject='【MATE '+service+'】無料掲載のご案内｜'+x['事業者名'].slice(0,70);
    const body=x['事業者名']+' ご担当者様\n\nMATE運営事務局です。\n'+
      '子育て家庭に向けた情報サイト「MATE '+service+'」への無料掲載についてご案内します。\n'+
      '掲載料は無料で、有料プランに自動移行しません。掲載内容・許諾を確認した後に公開します。\n'+
      '掲載をご希望の場合はこちらから申請いただけます。\n'+link+'\n\n'+
      'ご案内が不要な場合は「配信停止」とご返信ください。再送しません。\n'+
      '運営：'+sender+'\n所在地：'+address+'\n連絡先：'+MATE_V4.account+
      '\n運営者情報：https://care.kosodatemate.jp/operator.html';
    // Reserve before external send: ambiguous failures are held, never retried automatically.
    const targetRow=sheet.getLastRow()+1;
    mateV4Append_(sheet,[key,mateV4Jst_(),service,email,subject,'送信結果要確認',x['確認元URL'],x['メール用途・営業可の根拠'],'二重送信防止:実行前に予約']);
    attempted.add(key);allRecipients.add(email);
    try{
      GmailApp.sendEmail(email,subject,body,{name:sender,replyTo:MATE_V4.account});
      sheet.getRange(targetRow,6).setValue('送信済');sent++;
    }catch(err){
      sheet.getRange(targetRow,9).setValue('送信状態はGmail送信済みフォルダで確認: '+String(err).slice(0,150));
    }
  }
  return sent;
}
function mateV4SyncReferralLedger(){
  const b=mateV4Book_(),inquiries=mateV4Rows_(mateV4Tab_(b,MATE_V4.inquiries));
  const dest=mateV4Tab_(b,MATE_V4.referrals);
  const seen=new Set(mateV4Rows_(dest).map(x=>x['イベントID']).filter(Boolean));
  let count=0;
  for(const x of inquiries){
    const id=x['受付ID'];const service=x['サービス'],provider=x['事業者・教室ID'];
    if(!/^[A-Za-z0-9_-]{12,110}$/.test(id||'')||!['CARE','SPARK','PLAY'].includes(service)||!provider)continue;
    const permission=x['掲載許諾確認']==='確認済み'&&x['体験取次許諾確認']==='確認済み'&&x['保護者の情報提供同意']==='確認済み';
    if(!permission||!x['GmailメッセージID/証跡']||!x['教室への取次日時'])continue;
    const key='REF-'+id;
    if(!seen.has(key)&&['教室へ取次','結果確認','完了'].includes(x['進捗'])){
      mateV4Append_(dest,[key,mateV4Jst_(),service,provider,x['対象教室・事業者名'],'取次実施',id,
        '有効',x['GmailメッセージID/証跡'],x['教室への取次日時'],'未確認','','0','0',
        x['GmailメッセージID/証跡'],'保護者情報を保存しない。送信実行の証跡はGmail側で照合。']);
      seen.add(key);count++;
    }
    const resultId='RESULT-'+id;
    if(!seen.has(resultId)&&x['結果確認日']&&['結果確認','完了'].includes(x['進捗'])){
      mateV4Append_(dest,[resultId,mateV4Jst_(),service,provider,x['対象教室・事業者名'],'結果確認',id,
        '有効',x['GmailメッセージID/証跡'],x['教室への取次日時'],x['結果']||'未確認',
        x['結果確認日'],'0','0',x['GmailメッセージID/証跡'],'有料成果確定とは別。']);
      seen.add(resultId);count++;
    }
  }
  return count;
}
function mateAutoOpsV4Cycle(){
  const lock=LockService.getScriptLock();if(!lock.tryLock(15000))return 'SKIP_LOCK';
  try{
    const report={crmSeeded:mateV4SeedExistingCRM(),collected:mateV4CollectLeads(),optouts:mateV4OptoutInbox(),
      referrals:mateV4SyncReferralLedger(),outreach:mateV4SendOutreach()};
    console.log(JSON.stringify(report));return report;
  }finally{lock.releaseLock()}
}
function installMateAutoOpsV4(){
  mateV4Book_();
  for(const tr of ScriptApp.getProjectTriggers())
    if(tr.getHandlerFunction()==='mateAutoOpsV4Cycle')ScriptApp.deleteTrigger(tr);
  ScriptApp.newTrigger('mateAutoOpsV4Cycle').timeBased().everyHours(1).create();
  return 'MATE AutoOps V4: 1時間おきに収集・拒否記録・紹介台帳を確認。メールはScript PropertiesがそろうまでOFF。';
}
