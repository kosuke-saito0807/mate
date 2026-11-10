/**
 * Private approved-media permission repair (owner-only admin action).
 *
 * This does not publish anything or send email. An actual approved application,
 * an operator-confirmed publication, matching valid contract, reviewed media,
 * explicit image rights, and membership of the designated private upload folder
 * are required before sharing each file with configured read-only publisher
 * service accounts. Never share as "anyone with the link".
 *
 * Even if a private folder is shared, provider-created files sometimes return
 * Drive API 403 to a separate publishing service account. This safely creates
 * per-file viewer permissions ONLY for already published/contracted records.
 */
function mateDirectReaderEmails_(){
  var raw=String(PropertiesService.getScriptProperties()
    .getProperty("MATE_MEDIA_READER_EMAILS")||"");
  var emails=[...new Set(raw.split(",").map(function(x){return x.trim().toLowerCase()}).filter(Boolean))];
  if(!emails.length || emails.length>4)throw Error("画像公開用のサービスアカウント設定を確認してください");
  emails.forEach(function(email){
    if(!/^[a-z0-9._-]+@[a-z0-9-]+\.iam\.gserviceaccount\.com$/.test(email))
      throw Error("サービスアカウントのメールアドレス形式が不正です");
  });
  return emails;
}
function mateDirectReaderFingerprint_(email){
  var hash=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,email);
  return hash.slice(0,8).map(function(byte){
    return ("0"+((byte+256)%256).toString(16)).slice(-2);
  }).join("");
}
/** Hashes let the operator compare accounts with CI without exposing keys. */
function previewMateMediaReaderFingerprintsV1(){
  mateDirectOwner_();
  return mateDirectReaderEmails_().map(mateDirectReaderFingerprint_);
}
function mateDirectApprovedMediaPermissions_(write){
  mateDirectOwner_();
  var readers=mateDirectReaderEmails_(),folder=mateDirectMediaFolder_();
  var folderId=folder.getId(),book=SpreadsheetApp.openById(MATE_DIRECT.sheetId);
  function rows(name){
    var s=book.getSheetByName(name);
    if(!s)throw Error("画像権限修復に必要な台帳がありません: "+name);
    return s.getLastRow()>1?s.getRange(2,1,s.getLastRow()-1,s.getLastColumn()).getDisplayValues():[];
  }
  function val(r,i){return String(r[i-1]==null?"":r[i-1]).trim()}
  var apps=rows(MATE_DIRECT.applications),approvals=rows("掲載公開承認V1_運営専用"),
    contracts=rows("掲載契約"),media=rows(MATE_DIRECT.imagesLedger),
    today=Utilities.formatDate(new Date(),"Asia/Tokyo","yyyy-MM-dd");
  var summary={mode:write?"GRANT_APPROVED_VIEWER":"PREVIEW_ONLY",approvedApplications:0,
    selectedFiles:0,fileMembershipRejected:0,viewerGrants:0,grantErrors:0,
    readerFingerprints:readers.map(mateDirectReaderFingerprint_)};
  var seenFiles=new Set();
  for(var i=0;i<media.length;i++){
    var entry=media[i],aid=val(entry,1),svc=val(entry,2);
    if(!["CARE","SPARK","PLAY"].includes(svc)||
       val(entry,8)!=="掲載権限あり"||val(entry,9)!=="確認済み")continue;
    var matched=apps.filter(function(a){return val(a,1)===aid});
    if(matched.length!==1)continue;
    var applicant=matched[0],name=val(applicant,4),pubId=val(applicant,28);
    if(val(applicant,3)!==svc||val(applicant,25)!=="承認"||
       val(applicant,26)!=="確認済み"||!val(applicant,27)||!pubId)continue;
    var ok=approvals.filter(function(a){
      return val(a,2)===aid&&val(a,3)===svc&&val(a,4)===name&&
        val(a,11)===pubId&&val(a,10)==="確認済み"&&
        val(a,12)==="掲載承認"&&val(a,13)==="公開確認済み"&&
        !!val(a,14)&&!!val(a,6)&&!!val(a,7)&&!!val(a,8)&&!!val(a,9);
    });
    if(ok.length!==1)continue;
    var signed=contracts.filter(function(c){
      return ["CARE","SITTER"].includes(val(c,2))&&svc==="CARE"||
         val(c,2)===svc;
    }).filter(function(c){
      return val(c,3)===pubId&&val(c,4)===name&&val(c,14)==="有効"&&
        !val(c,1).startsWith("DRAFT-")&&!!val(c,10)&&!!val(c,11)&&
        !!val(c,12)&&!!val(c,13)&&val(c,8)<=today&&val(c,9)>=today;
    });
    if(signed.length!==1)continue;
    summary.approvedApplications++;
    for(var j=3;j<=7;j++){
      var raw=val(entry,j),m=raw.match(/^DRIVE:([A-Za-z0-9_-]{20,128})$/);
      if(!m)continue;
      var fid=m[1];
      if(seenFiles.has(fid))continue;
      seenFiles.add(fid);
      if(summary.selectedFiles>=30)throw Error("画像ファイルの許可上限30件に達しました");
      try{
        var file=DriveApp.getFileById(fid),parentFiles=file.getParents(),belongs=false;
        while(parentFiles.hasNext())if(parentFiles.next().getId()===folderId)belongs=true;
        if(!belongs){summary.fileMembershipRejected++;continue}
        summary.selectedFiles++;
        if(write)for(var k=0;k<readers.length;k++){
          try{file.addViewer(readers[k]);summary.viewerGrants++}
          catch(e){summary.grantErrors++}
        }
      }catch(e){summary.grantErrors++}
    }
  }
  return summary;
}
function previewMateApprovedMediaAccessV1(){
  return mateDirectApprovedMediaPermissions_(false);
}
function repairMateApprovedMediaAccessV1(){
  return mateDirectApprovedMediaPermissions_(true);
}
