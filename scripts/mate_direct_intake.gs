/**
 * MATE Direct Listing Intake — standalone Google Apps Script WEB APP.
 * Publishes NO listings, sends NO email, never approves a provider.
 * Deploy as kosodatemate@gmail.com: Execute as ME / Access ANYONE.
 *
 * Configure Script Properties: MATE_TURNSTILE_SECRET (private).
 * Cloudflare Turnstile widget MUST validate the publishing hostname.
 * Run setupMateDirectIntake() once as owner before creating the Web App deployment.
 * Do not paste this into existing projects with other doPost implementations.
 */
var MATE_DIRECT = Object.freeze({
  sheetId:"1CLJeXuznctRtH8Y3AMZ2XyOu3dQedmh9obBDrPlIEuQ",
  owner:"kosodatemate@gmail.com",
  applications:"掲載セルフ申請",
  contacts:"掲載申請連絡先",
  inquiries:"問い合わせ管理",
  inquiryHeaders:["受付ID","受付日時","サービス","問い合わせ種別","事業者・教室ID","対象教室・事業者名","GmailメッセージID/証跡","希望教室ID（複数はカンマ区切り）","進捗","掲載許諾確認","体験取次許諾確認","保護者の情報提供同意","次回対応日","教室への取次日時","結果確認日","結果","担当者","メモ（氏名・健康情報は記入しない）"],
  hosts:{CARE:["kosuke-saito0807.github.io"],SPARK:["mate-spark.web.app"],PLAY:["kosuke-saito0807.github.io"]},
  appHeaders:["申請ID","受信日時","サービス","教室・事業者名","公式URL","都道府県","市区町村・対応エリア","ジャンル","対象区分","紹介文","月謝（税込円）","体験料金（税込円）","対象最少年齢","対象最高年齢","曜日","最寄駅","タグ","次回体験予定日","料金メモ","対応時間","情報確認日","掲載申請の意思","取次相談の希望","GmailメッセージID","審査状態","担当者権限の確認","審査者","公開ID","保留・差戻し理由"],
  contactHeaders:["受付ID","受付日時","サービス","担当者名（非公開）","返信用メール（非公開）","電話（非公開）","申請メモ（非公開）"],
  prefectures:"北海道 青森県 岩手県 宮城県 秋田県 山形県 福島県 茨城県 栃木県 群馬県 埼玉県 千葉県 東京都 神奈川県 新潟県 富山県 石川県 福井県 山梨県 長野県 岐阜県 静岡県 愛知県 三重県 滋賀県 京都府 大阪府 兵庫県 奈良県 和歌山県 鳥取県 島根県 岡山県 広島県 山口県 徳島県 香川県 愛媛県 高知県 福岡県 佐賀県 長崎県 熊本県 大分県 宮崎県 鹿児島県 沖縄県 全国".split(" ")
});

function mateDirectOwner_() {
  if(String(Session.getEffectiveUser().getEmail()||"").toLowerCase()!==MATE_DIRECT.owner){
    throw Error("専用Gmailアカウントで実行してください");
  }
}
function mateDirectText_(v,max) {
  var s=String(v==null?"":v).replace(/\u0000/g,"").trim().slice(0,max);
  return /^[=+\-@\t\r]/.test(s)?"'"+s:s; // block spreadsheet formula evaluation
}
function mateDirectRaw_(v,max) {return String(v==null?"":v).trim().slice(0,max)}
function mateDirectDate_(v) {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  var d=new Date(v+"T00:00:00+09:00");
  var today=new Date();
  return Number.isFinite(d.getTime()) && Utilities.formatDate(d,"Asia/Tokyo","yyyy-MM-dd")===v && d.getTime()<=today.getTime()+86400000 && d.getTime()>=today.getTime()-95*86400000;
}
function mateDirectHeaders_(sheet,headers) {
  var current=sheet.getRange(1,1,1,headers.length).getDisplayValues()[0];
  if(JSON.stringify(current)!==JSON.stringify(headers))throw Error("台帳の列構成が変更されています");
}
function setupMateDirectIntake(){
  mateDirectOwner_();
  if(!PropertiesService.getScriptProperties().getProperty("MATE_TURNSTILE_SECRET"))
    throw Error("MATE_TURNSTILE_SECRET をスクリプト プロパティに設定してください");
  var book=SpreadsheetApp.openById(MATE_DIRECT.sheetId);
  var apps=book.getSheetByName(MATE_DIRECT.applications);
  if(!apps)throw Error("掲載セルフ申請が見つかりません");
  mateDirectHeaders_(apps,MATE_DIRECT.appHeaders);
  var contacts=book.getSheetByName(MATE_DIRECT.contacts);
  if(!contacts){
    contacts=book.insertSheet(MATE_DIRECT.contacts);
    contacts.getRange(1,1,1,MATE_DIRECT.contactHeaders.length).setValues([MATE_DIRECT.contactHeaders]);
    contacts.setFrozenRows(1);
  }
  mateDirectHeaders_(contacts,MATE_DIRECT.contactHeaders);
  var inquiries=book.getSheetByName(MATE_DIRECT.inquiries);
  if(!inquiries)throw Error("問い合わせ管理シートが見つかりません");
  mateDirectHeaders_(inquiries,MATE_DIRECT.inquiryHeaders);
  return "受付台帳の構造・Turnstile設定を確認しました。未審査で保存されます。";
}
function mateDirectForm_(p){
  var service=mateDirectRaw_(p.service,10);
  if(!MATE_DIRECT.hosts[service])throw Error("不正なサービスです");
  var id=mateDirectRaw_(p.submission_id,60).toLowerCase();
  if(!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(id))throw Error("受付番号を確認してください");
  if(p._honey || p.website_check)throw Error("受付できませんでした");
  var name=mateDirectRaw_(p.name,80),email=mateDirectRaw_(p.email,254);
  if(!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw Error("担当者の連絡先をご確認ください");
  var company=mateDirectText_(p.company,160),url=mateDirectRaw_(p.website,500);
  if(!company||!/^https:\/\/[a-z0-9.-]+\.[a-z]{2,}(?:[/:?#]|$)/i.test(url)||/[\s@]/.test(url))throw Error("公式サイトURLをご確認ください");
  var region=mateDirectRaw_(p.region,24),city=mateDirectText_(p.city,140);
  if(MATE_DIRECT.prefectures.indexOf(region)<0||!city)throw Error("対応地域をご確認ください");
  var desc=mateDirectText_(p.description,500);
  if(desc.length<25||!mateDirectRaw_(p.category,70))throw Error("公開情報をご確認ください");
  var checked=mateDirectRaw_(p.listing_content_checked_at,10);
  if(!mateDirectDate_(checked))throw Error("掲載内容の確認日をご確認ください");
  if(!mateDirectRaw_(p.listing_permission,140))throw Error("掲載の意向への同意が必要です");
  if(p.privacy_agree!=="同意する")throw Error("個人情報の取扱いへの同意が必要です");
  var token=mateDirectRaw_(p["cf-turnstile-response"],2100);
  if(token.length<20||token.length>2048)throw Error("セキュリティ認証が必要です");
  var data={service:service,id:id,name:name,email:email,token:token,checked:checked,
    company:company,url:url,region:region,city:city,description:desc,
    category:mateDirectText_(p.category,70)};
  ["phone","message","area","ages","monthlyPrice","trialPrice","ageMin","ageMax",
   "weekdays","station","tags","nextTrialDate","pricingNotes","openingHours","trial_referral_consent",
   "listing_permission"].forEach(function(k){data[k]=mateDirectText_(p[k],k==="message"?500:k==="phone"?30:160)});
  if(data.monthlyPrice&&!/^\d{1,8}$/.test(data.monthlyPrice))throw Error("料金を確認してください");
  if(data.trialPrice&&!/^\d{1,8}$/.test(data.trialPrice))throw Error("体験料金を確認してください");
  if(data.ageMin&&!/^\d{1,2}$/.test(data.ageMin))throw Error("対象年齢を確認してください");
  if(data.ageMax&&!/^\d{1,2}$/.test(data.ageMax))throw Error("対象年齢を確認してください");
  if(data.ageMin&&data.ageMax&&Number(data.ageMin)>Number(data.ageMax))throw Error("対象年齢の範囲を確認してください");
  return data;
}
function mateDirectCaptcha_(form){
  var secret=PropertiesService.getScriptProperties().getProperty("MATE_TURNSTILE_SECRET");
  if(!secret)throw Error("受付システムは設定中です");
  var res=UrlFetchApp.fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify",{
    method:"post",payload:{secret:secret,response:form.token},muteHttpExceptions:true});
  if(res.getResponseCode()!==200)throw Error("セキュリティ認証をやり直してください");
  var body=JSON.parse(res.getContentText());
  if(body.success!==true || body.action!=="mate_listing" ||
     MATE_DIRECT.hosts[form.service].indexOf(String(body.hostname||"").toLowerCase())<0)
    throw Error("セキュリティ認証をやり直してください");
}
function mateDirectExists_(sheet,column,key){
  var last=sheet.getLastRow();
  if(last<2)return false;
  return sheet.getRange(2,column,last-1,1).getDisplayValues().some(function(row){return row[0]===key});
}
function mateDirectApplication_(d,stamp){
  return [
    "MATE-WEB-"+d.id,stamp,d.service,d.company,d.url,d.region,d.city,d.category,d.ages,
    d.description,d.monthlyPrice,d.trialPrice,d.ageMin,d.ageMax,d.weekdays,d.station,d.tags,
    d.nextTrialDate,d.pricingNotes,d.openingHours,d.checked,d.listing_permission,
    d.trial_referral_consent,
    "WEB-"+d.id, // Existing legacy column name: GmailメッセージID; this is a direct WEB receipt
    "未審査","未確認","","","直接受付。権限と申請者の同意内容を必ず別途確認"
  ];
}
function mateDirectReceive_(d){
  mateDirectOwner_();
  var book=SpreadsheetApp.openById(MATE_DIRECT.sheetId);
  var apps=book.getSheetByName(MATE_DIRECT.applications);
  var contacts=book.getSheetByName(MATE_DIRECT.contacts);
  if(!apps||!contacts)throw Error("受付システムは準備中です");
  mateDirectHeaders_(apps,MATE_DIRECT.appHeaders);
  mateDirectHeaders_(contacts,MATE_DIRECT.contactHeaders);
  var lock=LockService.getScriptLock();
  if(!lock.tryLock(18000))throw Error("混雑しています。時間をおいてください");
  try{
    var aid="MATE-WEB-"+d.id;
    if(mateDirectExists_(apps,1,aid))return {id:aid,duplicate:true};
    var rate=CacheService.getScriptCache();
    // Hash the address; do not retain private email in a cache key.
    var bytes=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,d.email.toLowerCase());
    var hash=Utilities.base64EncodeWebSafe(bytes).slice(0,32);
    if(rate.get("mate.direct."+hash))throw Error("短時間に複数の申請はできません");
    var stamp=Utilities.formatDate(new Date(),"Asia/Tokyo","yyyy-MM-dd HH:mm:ss");
    if(!mateDirectExists_(contacts,1,aid)){
      contacts.getRange(contacts.getLastRow()+1,1,1,MATE_DIRECT.contactHeaders.length).setValues([
        [aid,stamp,d.service,mateDirectText_(d.name,80),mateDirectText_(d.email,254),d.phone,d.message]
      ]);
    }
    // If appending the approval record fails, retrying the SAME receipt ID can repair it.
    apps.getRange(apps.getLastRow()+1,1,1,MATE_DIRECT.appHeaders.length).setValues([mateDirectApplication_(d,stamp)]);
    rate.put("mate.direct."+hash,"1",90);
    return {id:aid,duplicate:false};
  } finally {lock.releaseLock()}
}
function mateDirectEscape_(s){return String(s).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]})}
function mateDirectView_(ok,service,message,ref){
  var home={CARE:"https://kosuke-saito0807.github.io/mate/",SPARK:"https://mate-spark.web.app/",
    PLAY:"https://mate-play.kosuke-saito0807.chatgpt.site/"}[service]||"https://kosuke-saito0807.github.io/mate/";
  var title=ok?"申請を受け付けました":"申請を受け付けられませんでした";
  var extra=ok?"受付番号："+mateDirectEscape_(ref||"")+"。掲載には運営側の確認と承認が必要です。":mateDirectEscape_(message||"時間をおいて再度お試しください");
  return HtmlService.createHtmlOutput('<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+title+
    '</title></head><body style="font:16px/1.9 system-ui,sans-serif;margin:0;background:#f6f9fe;color:#173a55"><main style="max-width:610px;padding:48px 24px;margin:auto"><h1>'+title+'</h1><p>'+extra+
    '</p><p><a href="'+home+'">MATEに戻る ↗</a></p><p style="font-size:13px">お問い合わせ：kosodatemate@gmail.com</p></main></body></html>');
}
function doGet(){return mateDirectView_(false,"","このURLは申請フォームではありません。","")}
// Family consultations are received by the EXISTING direct-intake Web App.
// This path must never publish providers or forward a visitor to a partner.
function mateConsultForm_(p) {
  var service=mateDirectRaw_(p.service,10);
  if(service!=="CARE" && service!=="PLAY")throw Error("ご利用サービスが不正です");
  var uuid=mateDirectRaw_(p.submission_id,60).toLowerCase();
  if(!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(uuid))throw Error("受付番号を確認してください");
  if(p._honey || p.website_check)throw Error("受付できませんでした");
  var email=mateDirectRaw_(p.email,254);
  if(!email || email.length>254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    /[\r\n]/.test(email))throw Error("返信用メールアドレスをご確認ください");
  if(p.privacy_agree!=="同意する")throw Error("個人情報の取扱いへの同意が必要です");
  var kinds=["掲載先を探している","掲載内容について","体験・利用相談","その他"];
  var kind=mateDirectRaw_(p.inquiryType,40);
  if(kinds.indexOf(kind)<0)throw Error("相談の種類をご確認ください");
  var token=mateDirectRaw_(p["cf-turnstile-response"],2100);
  if(token.length<20||token.length>2048)throw Error("セキュリティ認証が必要です");
  // Reject overlong input server-side even if HTML maxlength is bypassed.
  var keys=[["area",100],["guardianName",80],["phone",30],["message",600]];
  var out={service:service,uuid:uuid,id:"MATE-CONSULT-"+uuid,email:email,kind:kind,token:token,
    referral:p.referral_interest==="案内を希望する（情報共有は別途同意）"};
  keys.forEach(function(pair){
    var raw=String(p[pair[0]]==null?"":p[pair[0]]);
    if(raw.length>pair[1])throw Error("入力内容が長すぎます");
    // Plain-text email; strip C0 control characters, without logging original.
    out[pair[0]]=raw.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g,"").trim();
  });
  return out;
}
function mateConsultCaptcha_(form) {
  var secret=PropertiesService.getScriptProperties().getProperty("MATE_TURNSTILE_SECRET");
  if(!secret)throw Error("受付システムは設定中です");
  var res=UrlFetchApp.fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify",{
    method:"post",payload:{secret:secret,response:form.token},muteHttpExceptions:true
  });
  if(res.getResponseCode()!==200)throw Error("セキュリティ認証をやり直してください");
  var result=JSON.parse(res.getContentText());
  // The existing widget is already registered for GitHub Pages.
  if(result.success!==true || result.action!=="mate_consult" ||
     MATE_DIRECT.hosts[form.service].indexOf(String(result.hostname||"").toLowerCase())<0)
    throw Error("セキュリティ認証をやり直してください");
}
function mateConsultReceive_(form) {
  mateDirectOwner_();
  var doc=SpreadsheetApp.openById(MATE_DIRECT.sheetId);
  var tab=doc.getSheetByName(MATE_DIRECT.inquiries);
  if(!tab)throw Error("問い合わせ管理台帳が見つかりません");
  mateDirectHeaders_(tab,MATE_DIRECT.inquiryHeaders);
  var lock=LockService.getScriptLock();
  if(!lock.tryLock(18000))throw Error("受付が混み合っています");
  try {
    var last=tab.getLastRow();
    var target=0;
    if(last>1){
      var ids=tab.getRange(2,1,last-1,1).getDisplayValues();
      for(var i=0;i<ids.length;i++)if(ids[i][0]===form.id){target=i+2;break}
    }
    if(target){
      // Do not send the same contact email a second time for a completed receipt.
      var progress=String(tab.getRange(target,9,1,1).getDisplayValues()[0][0]||"");
      if(progress==="受付")return form.id;
    } else {
      var bytes=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,form.email.toLowerCase());
      var hash=Utilities.base64EncodeWebSafe(bytes).slice(0,32);
      var cache=CacheService.getScriptCache();
      if(cache.get("mate.consult."+hash))throw Error("短時間に複数の相談は送れません");
      var date=Utilities.formatDate(new Date(),"Asia/Tokyo","yyyy-MM-dd HH:mm:ss");
      var row=[form.id,date,form.service,form.kind,"","","WEB-"+form.id,"",
        "メール通知待ち","未確認","未確認","未確認","","","","","","プライバシーポリシー送信同意あり。取次・情報提供は未承諾。連絡先と本文はGmailのみ"];
      target=last+1;
      tab.getRange(target,1,1,MATE_DIRECT.inquiryHeaders.length).setValues([row]);
    }
    var lines=[
      "MATE家族向け相談（非公開）",
      "受付番号: "+form.id,"サービス: "+form.service,"相談種別: "+form.kind,
      "返信先: "+form.email,"希望エリア: "+form.area,
      "お名前（任意）: "+form.guardianName,"電話（任意）: "+form.phone,
      "相談内容（任意）:\n"+form.message,
      "案内希望: "+(form.referral?"あり（情報提供・事業者取次の同意ではない）":"なし"),
      "個人情報取扱いの同意: あり",
      "【注意】掲載先には自動転送せず、取次は別途同意確認"
    ];
    // Avoid the legacy subject-only Gmail-to-Sheets sync's 'MATE PLAY' regex,
    // which would otherwise double-register the same submission.
    MailApp.sendEmail({
      to:MATE_DIRECT.owner,
      subject:"【MATE受付】"+form.service+" 家族向け相談 "+form.id,
      body:lines.join("\n"),
      replyTo:form.email,
      name:"MATE 相談受付"
    });
    // Mark accepted only after MailApp has successfully returned.
    tab.getRange(target,9,1,1).setValues([["受付"]]);
    cache=CacheService.getScriptCache();
    bytes=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,form.email.toLowerCase());
    hash=Utilities.base64EncodeWebSafe(bytes).slice(0,32);
    cache.put("mate.consult."+hash,"1",90);
    return form.id;
  } finally {lock.releaseLock()}
}
function mateConsultView_(ok,service,reason,id){
  var home=service==="PLAY"?"https://mate-play.kosuke-saito0807.chatgpt.site/":"https://kosuke-saito0807.github.io/mate/";
  var title=ok?"ご相談を受け付けました":"ご相談を受け付けられませんでした";
  var text=ok?"受付番号："+mateDirectEscape_(id)+"。運営事務局が内容を確認します。":
    mateDirectEscape_(reason||"受付できませんでした。");
  return HtmlService.createHtmlOutput(
    '<!doctype html><html lang="ja"><head><meta charset="utf-8">'+
    '<meta name="viewport" content="width=device-width,initial-scale=1"><title>'+title+'</title></head>'+
    '<body style="margin:0;background:#f8fbff;color:#15344e;font:16px/1.8 system-ui,sans-serif">'+
    '<main style="max-width:640px;margin:45px auto;padding:24px"><h1>'+title+'</h1>'+
    '<p>'+text+'</p><p><a href="'+home+'">MATEに戻る</a></p>'+
    '<p style="font-size:13px">お問い合わせ：kosodatemate@gmail.com</p></main></body></html>');
}
function doPost(e){
  var parameters=e&&e.parameter||{};
  var service=String(parameters.service||"").trim();
  try{
    if(!e||!e.parameter||!e.postData||e.postData.length>15000)throw Error("送信内容を確認してください");
    if(e.parameters&&Object.keys(e.parameters).some(function(k){return e.parameters[k].length!==1}))
      throw Error("送信内容を確認してください");
    if(parameters.intake_type==="family_consult"){
      if(e.postData.length>9000)throw Error("送信内容を確認してください");
      var consultation=mateConsultForm_(parameters);
      mateConsultCaptcha_(consultation);
      var receipt=mateConsultReceive_(consultation);
      return mateConsultView_(true,consultation.service,"",receipt);
    }
    // The existing listing workflow remains unchanged and must not accept
    // arbitrary intake_type values as listing submissions.
    if(parameters.intake_type)throw Error("送信種別が不正です");
    var form=mateDirectForm_(parameters);
    mateDirectCaptcha_(form);
    var outcome=mateDirectReceive_(form);
    return mateDirectView_(true,form.service,"",outcome.id);
  }catch(error){
    var safe=String(error&&error.message||"受付に失敗しました");
    if(safe.length>120)safe="受付に失敗しました";
    if(parameters.intake_type==="family_consult")return mateConsultView_(false,service,safe,"");
    return mateDirectView_(false,service,safe,"");
  }
}
