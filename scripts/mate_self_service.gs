/**
 * MATE owner self-service intake and safe "approve, then publish" pipeline.
 * To install: paste this alongside scripts/mate_inquiry_intake.gs as a SEPARATE
 * .gs file in the Apps Script owned by kosodatemate@gmail.com.
 * Does NOT send mail, create contracts, auto approve, or process parent's PII.
 * All human review stays in the private "掲載セルフ申請" sheet.
 */
const MATE_SELF = Object.freeze({
  bookId:"1CLJeXuznctRtH8Y3AMZ2XyOu3dQedmh9obBDrPlIEuQ",
  inbox:"kosodatemate@gmail.com",
  sourceTab:"掲載セルフ申請",
  ageDays:30,
  maxThreads:120,
  maxPerRun:100
});
const MATE_SELF_HEADERS=["申請ID","受信日時","サービス","教室・事業者名","公式URL","都道府県","市区町村・対応エリア","ジャンル","対象区分","紹介文","月謝（税込円）","体験料金（税込円）","対象最少年齢","対象最高年齢","曜日","最寄駅","タグ","次回体験予定日","料金メモ","対応時間","情報確認日","掲載申請の意思","取次相談の希望","GmailメッセージID","審査状態","担当者権限の確認","審査者","公開ID","保留・差戻し理由"];

function mateSelfOwner_(){
 const acc=String(Session.getEffectiveUser().getEmail()||"").toLowerCase();
 if(acc!==MATE_SELF.inbox)throw Error("MATE専用Gmailアカウントで実行してください");
}
function mateSelfBook_(){
 const book=SpreadsheetApp.openById(MATE_SELF.bookId);
 const sheet=book.getSheetByName(MATE_SELF.sourceTab);
 if(!sheet)throw Error("掲載セルフ申請 タブがありません");
 const headers=sheet.getRange(1,1,1,MATE_SELF_HEADERS.length).getDisplayValues()[0];
 if(JSON.stringify(headers)!==JSON.stringify(MATE_SELF_HEADERS))throw Error("セルフ申請のヘッダーが変更されています");
 return {book,sheet};
}
function mateSelfSafe_(raw,length){
 let s=String(raw==null?"":raw).replace(/\x00/g,"").trim().slice(0,length);
 if(/^[=+\-@\t\r]/.test(s))s="'"+s; // spreadsheet formula injection protection
 return s;
}
function mateSelfPayload_(text){
 const m=String(text||"").match(/MATE_LISTING_V1__([A-Za-z0-9+/=]{80,16000})/);
 if(!m)return null;
 let obj;
 try{
   const bytes=Utilities.base64Decode(m[1]);
   obj=JSON.parse(Utilities.newBlob(bytes).getDataAsString("UTF-8"));
 }catch(e){return null}
 if(!obj||typeof obj!=="object"||Array.isArray(obj))return null;
 const service=String(obj.service||"").trim();
 if(service!=="CARE"&&service!=="SPARK"&&service!=="PLAY")return null;
 const result={};
 const lengths={
  company:160,website:500,region:24,city:140,area:140,
  category:70,ages:100,description:500,monthlyPrice:10,trialPrice:10,
  ageMin:2,ageMax:2,weekdays:80,station:100,tags:160,
  nextTrialDate:10,pricingNotes:140,openingHours:140,
  listing_content_checked_at:10,listing_permission:140,
  trial_referral_consent:140
 };
 for(const [key,max]of Object.entries(lengths))result[key]=mateSelfSafe_(obj[key],max);
 result.service=service;
 if(!result.company||!result.website||!result.description||!result.region||!result.city||
    !result.category||!result.listing_permission)return null;
 if(!/^https:\/\/[a-z0-9.-]+\.[a-z]{2,}(?:[/:?#]|$)/i.test(result.website))return null;
 if(result.description.length<25)return null;
 if(!/^\d{4}-\d{2}-\d{2}$/.test(result.listing_content_checked_at))return null;
 return result;
}
function mateSelfCols_(app,id,stamp,msgId){
 return [
 "MATE-"+id,stamp,app.service,app.company,app.website,app.region,app.city,
 app.category,app.ages,app.description,app.monthlyPrice,app.trialPrice,app.ageMin,app.ageMax,
 app.weekdays,app.station,app.tags,app.nextTrialDate,app.pricingNotes,app.openingHours,
 app.listing_content_checked_at,app.listing_permission,app.trial_referral_consent,msgId,
 "未審査","未確認","","","確認後に掲載。連絡先・担当者名はGmailの原文参照"
 ];
}
function syncMateSelfServiceApplications(){
 mateSelfOwner_();
 const lock=LockService.getScriptLock();
 if(!lock.tryLock(20000))return 0;
 try{
  const {sheet}=mateSelfBook_();
  const last=sheet.getLastRow();
  const seen=new Set(last<2?[]:sheet.getRange(2,24,last-1,1).getDisplayValues().map(x=>String(x[0]||"")));
  const threads=GmailApp.search("in:anywhere -in:trash -in:spam newer_than:"+MATE_SELF.ageDays+
    "d to:"+MATE_SELF.inbox+" {subject:\"MATE CARE\" subject:\"MATE SPARK\" subject:\"MATE PLAY\"}",0,MATE_SELF.maxThreads);
  const next=[];
  for(const thread of threads)for(const msg of thread.getMessages()){
    if(next.length>=MATE_SELF.maxPerRun)break;
    const id=String(msg.getId());
    if(seen.has(id)||!String(msg.getTo()||"").toLowerCase().includes(MATE_SELF.inbox))continue;
    const subj=String(msg.getSubject()||"");
    if(!/MATE[\s　]*(CARE|SPARK|PLAY)/i.test(subj))continue;
    const app=mateSelfPayload_(String(msg.getPlainBody()||"").slice(0,200000))||
      mateSelfPayload_(String(msg.getBody()||"").slice(0,200000));
    if(!app)continue; // old form, partial payload or malformed data: manual Gmail review
    if(!subj.toUpperCase().includes(app.service))continue;
    const stamp=Utilities.formatDate(msg.getDate(),"Asia/Tokyo","yyyy-MM-dd HH:mm:ss");
    next.push(mateSelfCols_(app,id,stamp,id));seen.add(id);
  }
  if(next.length)sheet.getRange(last+1,1,next.length,MATE_SELF_HEADERS.length).setValues(next);
  return next.length;
 }finally{lock.releaseLock()}
}
// Reviewers should manually set 審査状態=承認, 担当者権限の確認=確認済み,
// 審査者=reviewer. Approval is NOT permission to initiate a trial referral.
function publishReviewedMateApplications(){
 mateSelfOwner_();
 const lock=LockService.getScriptLock();
 if(!lock.tryLock(20000))return 0;
 try{
  const {book,sheet}=mateSelfBook_();
  const rows=sheet.getDataRange().getDisplayValues().slice(1);
  const care=book.getSheetByName("営業管理DB");
  const spark=book.getSheetByName("SPARK営業候補");
  if(!care||!spark)throw Error("登録先の既存シートが見つかりません");
  const careIds=new Set(care.getRange(2,1,Math.max(care.getLastRow()-1,1),1).getDisplayValues().map(x=>x[0]));
  const sparkIds=new Set(spark.getRange(2,1,Math.max(spark.getLastRow()-1,1),1).getDisplayValues().map(x=>x[0]));
  let count=0;
  for(let i=0;i<rows.length;i++){
    const a=rows[i];
    if(a[24]!=="承認"||a[25]!=="確認済み"||!a[26]||!a[21]||!a[23]||a[27])continue;
    // Never automatically publish PLAY, whose CMS is outside this repository.
    const svc=a[2];if(svc!=="CARE"&&svc!=="SPARK")continue;
    if(!/^https:\/\/[a-z0-9.-]+\.[a-z]{2,}(?:[/:?#]|$)/i.test(a[4]))continue;
    const d=a[20];
    if(!/^\d{4}-\d{2}-\d{2}$/.test(d))continue;
    const checked=new Date(d+"T00:00:00+09:00");
    if(!Number.isFinite(checked.getTime())||checked.getTime()>Date.now())continue;
    const unique=svc==="CARE"?"mate-care-self-"+a[23].slice(-14):"mate-spark-self-"+a[23].slice(-14);
    if(svc==="CARE"){
      if(!careIds.has(unique)){
        const values={
          "ID":unique,"事業者名":a[3],"エリア":a[5]+"・"+a[6],
          "MATE掲載ステータス":"掲載許可","公式サイト":a[4],
          "営業ステータス":"先方申請済","掲載許可":"許可",
          "掲載情報確認日":d,"料金プラン":"無料",
          "掲載紹介文":a[9],"サービス区分":a[7],"料金メモ":a[18],
          "対応時間":a[19],"特徴タグ":a[16],
          "メモ":"申請者作成原稿。Gmail証跡="+a[23]
        };
        mateSelfAppendByHeaders_(care,values);careIds.add(unique);
      }
    }else if(!sparkIds.has(unique)){
      const values={
        "ID":unique,"企業・教室名":a[3],
        "都県・対象":a[5]+"・"+a[6],"ジャンル":a[7],"公式・窓口URL":a[4],
        "確認内容・営業上の注意":"本人申請/運営権限確認。Gmail証跡="+a[23],
        "営業ステータス":"掲載申請済","掲載許諾":"許可","希望プラン":"無料",
        "対象学年（カンマ区切り）":a[8],"最寄駅":a[15],"掲載紹介文":a[9],
        "体験受付許諾":"未確認","掲載内容確認日":d,
        "月謝税込円":a[10],"体験料金税込円":a[11],
        "対象最少年齢":a[12],"対象最高年齢":a[13],
        "開講曜日（カンマ区切り）":a[14],
        "教室所在地":a[6],"特徴タグ（カンマ区切り）":a[16],
        "次回体験予定日":a[17]
      };
      mateSelfAppendByHeaders_(spark,values);sparkIds.add(unique);
      // Create an INACTIVE contract draft with evidence id (not applicant name).
      // A human must verify signer and fill signed terms before marking 有効.
      const contract=book.getSheetByName("掲載契約");
      if(!contract)throw Error("掲載契約 tab missing");
      const contracts=contract.getDataRange().getDisplayValues();
      if(!contracts.slice(1).some(r=>r[2]===unique)){
        mateSelfAppendByHeaders_(contract,{
          "契約ID":"DRAFT-"+unique,"サービス":"SPARK","掲載先ID":unique,
          "企業・教室名":a[3],"プラン":"無料",
          "成果単価税込円":"0","月額税込円":"0",
          "条件版":"2026-10-23",
          "合意証拠URL・メールID":a[23],
          "状態":"未契約"
        });
      }
      // SPARK fail closed: 未契約 draft, no signer/date; no real listing or trial
      // until signer identity, contract and partner consent are verified.
    }
    sheet.getRange(i+2,28).setValue(unique);
    sheet.getRange(i+2,25).setValue(svc==="CARE"?"公開待ち":"契約確認待ち");
    count++;
  }
  return count;
 }finally{lock.releaseLock()}
}
function mateSelfAppendByHeaders_(sheet,obj){
 const width=sheet.getLastColumn();
 const headings=sheet.getRange(1,1,1,width).getDisplayValues()[0];
 const values=headings.map(h=>Object.prototype.hasOwnProperty.call(obj,h)?mateSelfSafe_(obj[h],550):"");
 sheet.getRange(sheet.getLastRow()+1,1,1,width).setValues([values]);
}
// One-time account-owner setup. No automatic send or public approval is authorized.
function installMateSelfServiceTriggers(){
 mateSelfOwner_();mateSelfBook_();
 const fns=["syncMateSelfServiceApplications","publishReviewedMateApplications"];
 for(const tr of ScriptApp.getProjectTriggers()){
   if(fns.includes(tr.getHandlerFunction()))ScriptApp.deleteTrigger(tr);
 }
 ScriptApp.newTrigger(fns[0]).timeBased().everyHours(1).create();
 ScriptApp.newTrigger(fns[1]).timeBased().everyHours(1).create();
 return "セルフ申請の受信と承認済みデータの反映を毎時確認します。営業メール送信なし。";
}
