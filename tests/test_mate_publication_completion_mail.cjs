const fs=require("node:fs"),vm=require("node:vm"),assert=require("node:assert/strict");
const source=fs.readFileSync("scripts/mate_publication_completion_mail.gs","utf8");
const ctx={console,Date,URL,Utilities:{formatDate:()=>"2026-11-10"},Session:{getEffectiveUser:()=>({getEmail:()=>"kosodatemate@gmail.com"})}};
vm.createContext(ctx);vm.runInContext(source,ctx);
function row(n){return Array(n).fill("")}
const aid="MATE-WEB-test",sid="mate_spark_test";
const application=row(30);Object.assign(application,{0:aid,2:"SPARK",3:"Example School",20:"2026-11-10",21:"同意済み",24:"承認",25:"確認済み",26:"運営審査者",27:sid});
const approval=row(17);Object.assign(approval,{1:aid,2:"SPARK",3:"Example School",5:"公式サイト検証",6:"OWNER_CONFIRMATION:2026-11-10",7:"2026-11-10",8:"運営審査者",9:"確認済み",10:sid,12:"公開確認済み",13:"https://spark.kosodatemate.jp/#listing-mate_spark_test",14:"未送信"});
const contract=row(14);Object.assign(contract,{0:"MATE-FREE-test",1:"SPARK",2:sid,3:"Example School",7:"2026-11-01",8:"2027-11-01",9:"担当",10:"2026-11-10",11:"2026-11-04-v1",12:"APPLICATION:proof",13:"有効"});
const contact=row(7);Object.assign(contact,{0:aid,4:"approved-owner@example.org"});
const apps={values:[application]},contracts={values:[contract]},contacts={values:[contact]};
function evaluate(){return ctx.matePubEvaluate_(apps,approval,contracts,contacts)}
assert.equal(evaluate().publicId,sid);
approval[14]="送信済み";assert.equal(evaluate(),"送信済みまたは送信証跡あり");approval[14]="未送信";
approval[12]="審査中";assert.match(evaluate(),/公開確認/);approval[12]="公開確認済み";
contract[13]="未契約";assert.equal(evaluate(),"有効契約なし");contract[13]="有効";
application[24]="未審査";assert.match(evaluate(),/承認/);application[24]="承認";
approval[13]="https://evil.example/#listing-mate_spark_test";assert.match(evaluate(),/URL/);
approval[13]="http://spark.kosodatemate.jp/#listing-mate_spark_test";assert.match(evaluate(),/URL/);
approval[13]="https://spark.kosodatemate.jp/#listing-mate_spark_test";assert.equal(evaluate().service,"SPARK");
console.log("PASS: approval, contract, site-host, idempotence, contact gates");
assert.equal(ctx.matePubExpectedLink_("SPARK",sid),"https://spark.kosodatemate.jp/#listing-"+sid);
assert.equal(ctx.matePubExpectedLink_("CARE","mate_care_123456"),"https://care.kosodatemate.jp/#listing-mate_care_123456");
assert.equal(ctx.matePubExpectedLink_("PLAY","mate_play_123456"),"https://play.kosodatemate.jp/");
const validFeed=JSON.stringify([{id:sid,name:"Example School",approved:true}]);
ctx.UrlFetchApp={fetch:(u,opts)=>({getResponseCode:()=>200,getContentText:()=>validFeed})};
assert.equal(ctx.matePubLiveEvidence_(approval[13],approval[3],sid,"SPARK"),true);
ctx.UrlFetchApp={fetch:()=>({getResponseCode:()=>200,getContentText:()=>JSON.stringify([{id:sid,name:"Wrong Name",approved:true}])})};
assert.equal(ctx.matePubLiveEvidence_(approval[13],approval[3],sid,"SPARK"),false);
ctx.UrlFetchApp={fetch:()=>({getResponseCode:()=>302,getContentText:()=>validFeed})};
assert.equal(ctx.matePubLiveEvidence_(approval[13],approval[3],sid,"SPARK"),false);
console.log("PASS: exact source JSON, immutable listing identity, no redirects");

const reviewed=row(17);Object.assign(reviewed,{1:aid,2:"SPARK",3:"Example School",5:"公式確認",6:"OWNER_ATTESTATION",7:"2026-11-10",8:"審査担当",9:"確認済み",10:sid,11:"掲載承認",12:"公開待ち",14:"未送信"});
let writes=[],deliveries=0;
function makeSheet(name,rows){
 return {getLastRow:()=>rows.length+1,getLastColumn:()=>rows[0]?.length||17,
   getRange:(r,c,h,w)=>({getDisplayValues:()=>rows.slice(r-2,r-2+h).map(x=>x.slice(c-1,c-1+w)),
     setValues:(v)=>{writes.push({name,r,c,v});if(name==="掲載公開承認V1_運営専用"){rows[r-2][c-1]=v[0][0];rows[r-2][c]=v[0][1];}}})};
}
const mockSheets={
 "掲載公開承認V1_運営専用":makeSheet("掲載公開承認V1_運営専用",[reviewed]),
 "掲載セルフ申請":makeSheet("掲載セルフ申請",[application]),
 "掲載契約":makeSheet("掲載契約",[contract])
};
ctx.SpreadsheetApp={openById:()=>({getSheetByName:n=>mockSheets[n]})};
ctx.LockService={getScriptLock:()=>({tryLock:()=>true,releaseLock:()=>{}})};
ctx.MailApp={sendEmail:()=>{deliveries++}};
ctx.UrlFetchApp={fetch:()=>({getResponseCode:()=>200,getContentText:()=>validFeed})};
const preview=ctx.matePubReconcile_(false);
assert.equal(preview.live,1);assert.equal(writes.length,0);
const done=ctx.matePubReconcile_(true);
assert.equal(done.updated,1);assert.equal(reviewed[12],"公開確認済み");
assert.equal(reviewed[13],"https://spark.kosodatemate.jp/#listing-"+sid);
assert.equal(deliveries,0);
assert.equal(ctx.matePubReconcile_(true).updated,0);
console.log("PASS: reconciled actual publication without mail, idempotent on repeat");

assert.equal(ctx.matePubReconcile_(true).updated,0);
assert.equal(reviewed[12],"公開確認済み");
console.log("PASS: validation-compatible status is exactly 公開確認済み");
