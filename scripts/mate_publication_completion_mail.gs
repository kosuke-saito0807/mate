/**
 * MATE CARE/SPARK/PLAY publication completion notification.
 * INSTALLATION: add this single file to the existing MATE operations GAS project
 * under kosodatemate@gmail.com. Do not add doPost, overwrite V4, or install a
 * trigger until the operator has reviewed dry-run results.
 *
 * No external sales are sent by this script.
 * A public listing, an actual approved application, a verified active contract
 * and explicit operator publication evidence are required before any mail.
 * MATE_PUBLICATION_MAIL_ENABLED defaults to OFF.
 */
var MATE_PUBLISHED_MAIL = Object.freeze({
  spreadsheetId:"1CLJeXuznctRtH8Y3AMZ2XyOu3dQedmh9obBDrPlIEuQ",
  owner:"kosodatemate@gmail.com",
  approvalTab:"掲載公開承認V1_運営専用",
  applicationTab:"掲載セルフ申請",
  contractTab:"掲載契約",
  contactTab:"掲載申請連絡先",
  allowedHosts:{CARE:"care.kosodatemate.jp",SPARK:"spark.kosodatemate.jp",PLAY:"play.kosodatemate.jp"}
});
function matePubText_(v){return String(v==null?"":v).trim()}
function matePubGet_(row,i){return matePubText_(row[i-1])}
function matePubOwner_(){
  if(String(Session.getEffectiveUser().getEmail()||"").toLowerCase()!==MATE_PUBLISHED_MAIL.owner)
    throw Error("MATE運営Gmailで実行してください");
}
function matePubSheet_(book,name){
  var sheet=book.getSheetByName(name);
  if(!sheet)throw Error("必須の台帳が見つかりません: "+name);
  return sheet;
}
function matePubRows_(book,name){
  var sheet=matePubSheet_(book,name),last=sheet.getLastRow();
  return {sheet:sheet,values:last>1?sheet.getRange(2,1,last-1,sheet.getLastColumn()).getDisplayValues():[]};
}
function matePubExactContract_(rows,service,publicId,company){
  var found=rows.filter(function(r){
    return matePubGet_(r,2)===service && matePubGet_(r,3)===publicId &&
      matePubGet_(r,4)===company && matePubGet_(r,14)==="有効";
  });
  if(found.length!==1)return false;
  var r=found[0];
  if(!matePubGet_(r,1)||!matePubGet_(r,8)||!matePubGet_(r,9)||
     !matePubGet_(r,10)||!matePubGet_(r,11)||!matePubGet_(r,12)||
     !matePubGet_(r,13))return false;
  var now=Utilities.formatDate(new Date(),"Asia/Tokyo","yyyy-MM-dd");
  return matePubGet_(r,8)<=now && matePubGet_(r,9)>=now;
}
function matePubVerifiedUrl_(url,service){
  // Apps Script does not consistently expose the browser URL constructor.
  // Require a canonical first-party HTTPS URL without ports, userinfo,
  // query, fragment, encoded slash or redirect to another domain.
  var host=MATE_PUBLISHED_MAIL.allowedHosts[service];
  if(!host || typeof url!=="string" || url.length>270)return false;
  var pattern=new RegExp("^https:\\/\\/"+host.replace(/\\./g,"\\.")+"(?:\\/[a-zA-Z0-9_./~-]*)?$");
  return pattern.test(url) && url.indexOf("..")<0;
}
function matePubLiveEvidence_(url,company,publicId){
  // No redirects or fetching third-party hosts. A successful public response
  // alone is insufficient: match exact listing ID and name in the response.
  try{
    var response=UrlFetchApp.fetch(url,{
      followRedirects:false,muteHttpExceptions:true,validateHttpsCertificates:true,
      headers:{"Accept":"text/html,application/json"}
    });
    if(response.getResponseCode()!==200)return false;
    var text=response.getContentText();
    if(text.length>750000)return false;
    return text.indexOf(publicId)!==-1 && text.indexOf(company)!==-1;
  }catch(e){return false}
}
function matePubEvaluate_(app,approvals,contracts,contacts){
  var applicant=app.values.filter(function(r){return matePubGet_(r,1)===matePubGet_(approvals,2)});
  if(applicant.length!==1)return "申請ID不一致";
  var a=applicant[0],service=matePubGet_(approvals,3),publicId=matePubGet_(approvals,11),
      company=matePubGet_(approvals,4),url=matePubGet_(approvals,14);
  if(!MATE_PUBLISHED_MAIL.allowedHosts[service])return "サービス不正";
  if(matePubGet_(a,3)!==service||matePubGet_(a,4)!==company||
     matePubGet_(a,28)!==publicId)return "申請内容不一致";
  if(matePubGet_(a,25)!=="承認"||matePubGet_(a,26)!=="確認済み"||
     !matePubGet_(a,27)||!matePubGet_(a,21)||!matePubGet_(a,22))
    return "承認・権限・掲載意思の証拠不足";
  if(matePubGet_(approvals,13)!=="公開確認済" ||
     matePubGet_(approvals,10)!=="確認済み" ||
     !matePubGet_(approvals,6)||!matePubGet_(approvals,7)||
     !matePubGet_(approvals,8)||!matePubGet_(approvals,9))
    return "公開確認・同意証跡不足";
  if(matePubGet_(approvals,15)==="送信済み" || matePubGet_(approvals,16))
    return "送信済みまたは送信証跡あり";
  if(!["","未送信"].includes(matePubGet_(approvals,15)))return "通知処理中・要確認";
  if(!publicId||!matePubVerifiedUrl_(url,service))return "公開URL・ID不正";
  if(!matePubExactContract_(contracts.values,service,publicId,company))return "有効契約なし";
  var recipient=contacts.values.filter(function(r){return matePubGet_(r,1)===matePubGet_(approvals,2)});
  if(recipient.length!==1)return "連絡先不一致";
  var email=matePubGet_(recipient[0],5);
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return "メール形式不正";
  return {service:service,publicId:publicId,url:url,email:email,company:company,
    applicationId:matePubGet_(approvals,2)};
}
function matePubRun_(send){
  matePubOwner_();
  var book=SpreadsheetApp.openById(MATE_PUBLISHED_MAIL.spreadsheetId);
  var approvals=matePubRows_(book,MATE_PUBLISHED_MAIL.approvalTab);
  var apps=matePubRows_(book,MATE_PUBLISHED_MAIL.applicationTab);
  var contracts=matePubRows_(book,MATE_PUBLISHED_MAIL.contractTab);
  var contacts=matePubRows_(book,MATE_PUBLISHED_MAIL.contactTab);
  var summary={mode:send?"LIVE_GATED":"READ_ONLY",checked:0,eligible:0,verified:0,sent:0,
    held:0,reasons:{}};
  var props=PropertiesService.getScriptProperties();
  if(send&&props.getProperty("MATE_PUBLICATION_MAIL_ENABLED")!=="ON")
    throw Error("掲載完了通知はOFFです");
  var lock=LockService.getScriptLock();
  if(send&&!lock.tryLock(1000))throw Error("他の通知処理が実行中です");
  try{
    approvals.values.forEach(function(r,i){
      if(!matePubGet_(r,2))return;
      summary.checked++;
      var result=matePubEvaluate_(apps,r,contracts,contacts);
      if(typeof result==="string"){
        summary.held++;summary.reasons[result]=(summary.reasons[result]||0)+1;return;
      }
      summary.eligible++;
      if(!matePubLiveEvidence_(result.url,result.company,result.publicId)){
        summary.held++;summary.reasons["本番ページでIDと名称を確認できない"]=
          (summary.reasons["本番ページでIDと名称を確認できない"]||0)+1;return;
      }
      summary.verified++;
      if(!send)return;
      // Mark processing BEFORE attempting mail. Ambiguous failures are never
      // retried automatically, preventing duplicate sends.
      var rowNo=i+2;
      var state=approvals.sheet.getRange(rowNo,15);
      var evidence=approvals.sheet.getRange(rowNo,16);
      if(matePubText_(state.getDisplayValue())!=="未送信" &&
         matePubText_(state.getDisplayValue())!=="")return;
      state.setValue("送信処理中・要確認");
      evidence.setValue("MAIL_ATTEMPT:"+Utilities.getUuid());
      SpreadsheetApp.flush();
      var body=["MATE "+result.service+"への掲載申請をいただき、ありがとうございます。","",
        "事務局による審査と公開確認が完了し、掲載ページを公開しました。",
        "掲載先："+result.url,"",
        "掲載内容の訂正・削除をご希望の場合は、このメールへご返信ください。",
        "MATE運営事務局（NextEdu）","kosodatemate@gmail.com"].join("\n");
      try{
        MailApp.sendEmail({to:result.email,
          subject:"【MATE "+result.service+"】掲載開始のご案内",
          body:body,replyTo:MATE_PUBLISHED_MAIL.owner,name:"MATE運営事務局"});
        // '送信済み' means MailApp accepted it, not final inbox delivery.
        state.setValue("送信済み");
        summary.sent++;
      }catch(e){
        state.setValue("送信結果不明・手動照合");
        summary.held++;
      }
    });
  }finally{if(send)lock.releaseLock()}
  return summary;
}
/** Owner-only preview. Does not update cells or send messages. */
function previewMatePublicationMail(){return matePubRun_(false)}
/** Explicitly gated real send; only eligible, already-published applications. */
function dispatchMatePublicationMail(){return matePubRun_(true)}
