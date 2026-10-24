/* Offline simulated GAS contract tests: no Gmail, no real Sheets, no HTTP. */
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const source=fs.readFileSync("scripts/mate_direct_intake.gs","utf8");
const ID="f47ac10b-58cc-4bf2-a567-0e02b2c3d481";
const headers=(text)=> {
  const pat=/appHeaders:(\[[^\n]+\]),/;
  const match=text.match(pat);assert.ok(match);
  return JSON.parse(match[1]);
};
const appHeaders=headers(source);
const contactHeaders=["受付ID","受付日時","サービス","担当者名（非公開）","返信用メール（非公開）","電話（非公開）","申請メモ（非公開）"];
const nowParts=(d)=>{
  const parts=Object.fromEntries(new Intl.DateTimeFormat("en",{timeZone:"Asia/Tokyo",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(d).map(p=>[p.type,p.value]));
  return [parts.year,parts.month,parts.day].join("-");
};
function appSheet(header) {
  const rows=[header.slice()];
  const sh={
    rows,
    getLastRow(){return rows.length},
    getRange(r,c,height,width){
      return {
        getDisplayValues(){return Array.from({length:height},(_,i)=>Array.from({length:width},(_,j)=>String(rows[r-1+i]?.[c-1+j]??"")))},
        setValues(values){values.forEach((v,i)=>{rows[r-1+i]||=[]; v.forEach((x,j)=>{rows[r-1+i][c-1+j]=x})});return this}
      }
    },
    setFrozenRows(){}
  };
  return sh;
}
function makeEnvironment({host="kosuke-saito0807.github.io",captcha=true,secret=true,contacts=true,lock=true}={}){
  const approved=appSheet(appHeaders),privateContacts=contacts?appSheet(contactHeaders):null;
  const book={getSheetByName(name){return name==="掲載セルフ申請"?approved:name==="掲載申請連絡先"?privateContacts:null},
    insertSheet(){throw Error("setup test not configured")}};
  const cache={m:new Map(),get(k){return this.m.get(k)},put(k,v){this.m.set(k,v)}};
  const sandbox={
    Session:{getEffectiveUser:()=>({getEmail:()=>"kosodatemate@gmail.com"})},
    SpreadsheetApp:{openById:()=>book},
    PropertiesService:{getScriptProperties:()=>({getProperty:()=>secret?"test-secret":null})},
    LockService:{getScriptLock:()=>({tryLock:()=>lock,releaseLock(){}})},
    CacheService:{getScriptCache:()=>cache},
    Utilities:{
      formatDate(d){return d instanceof Date?nowParts(d):String(d)},
      DigestAlgorithm:{SHA_256:"sha"},
      computeDigest:(_,s)=>Array.from(require("node:crypto").createHash("sha256").update(s).digest()),
      base64EncodeWebSafe:(v)=>Buffer.from(v).toString("base64url")
    },
    UrlFetchApp:{fetch:()=>({getResponseCode:()=>200,getContentText:()=>JSON.stringify({success:captcha,action:"mate_listing",hostname:host})})},
    HtmlService:{createHtmlOutput:body=>({body})},
    Date,Number,JSON,Object,String,RegExp,Error,Array,Math
  };
  vm.createContext(sandbox);vm.runInContext(source,sandbox,{filename:"mate_direct_intake.gs"});
  return {sandbox,approved,privateContacts,cache};
}
function input(service="CARE"){
  const d=nowParts(new Date());
  return {service,submission_id:ID,company:"Example school",
    name:"Private Person",email:"private@example.com",phone:"",
    message:"Confidential memo",website:"https://example.org/",
    region:"東京都",city:"北区",category:"ベビーシッター",
    description:"法人運営の子育て支援事業の説明を記載します。掲載権限の審査待ちで、一般公開しません。",
    listing_content_checked_at:d,listing_permission:"掲載の意向",
    privacy_agree:"同意する", "cf-turnstile-response":"mock-cloudflare-siteverify-token-01234567890",
    ages:"幼児",tags:"子育て"
  };
}
function execute(env,data){
  const event={parameter:data,parameters:Object.fromEntries(Object.entries(data).map(([k,v])=>[k,[v]])),
    postData:{length:JSON.stringify(data).length}};
  return env.sandbox.doPost(event).body;
}
function test(name,fn){try{fn();console.log("PASS",name)}catch(e){console.error("FAIL",name,e);process.exitCode=1}}
test("CARE submitted only to private review, no public approval",()=>{
 const e=makeEnvironment(),html=execute(e,input());
 assert.match(html,/申請を受け付けました/);
 assert.equal(e.approved.rows.length,2);
 assert.equal(e.privateContacts.rows.length,2);
 assert.equal(e.approved.rows[1][24],"未審査");
 assert.equal(e.approved.rows[1][25],"未確認");
 assert.ok(!JSON.stringify(e.approved.rows).includes("private@example.com"));
 assert.ok(!JSON.stringify(e.approved.rows).includes("Private Person"));
 assert.ok(JSON.stringify(e.privateContacts.rows).includes("private@example.com"));
});
test("SPARK accepted only from spark domain",()=>{
 const e=makeEnvironment({host:"mate-spark.web.app"});
 assert.match(execute(e,input("SPARK")),/申請を受け付けました/);
});
test("PLAY accepted only from github pages",()=>{
 const e=makeEnvironment();
 assert.match(execute(e,input("PLAY")),/申請を受け付けました/);
});
test("Wrong widget domain is refused",()=>{
 const e=makeEnvironment({host:"evil.example"});
 assert.match(execute(e,input()),/受け付けられませんでした/);
 assert.equal(e.approved.rows.length,1);
});
test("Failed CAPTCHA is refused",()=>{
 const e=makeEnvironment({captcha:false});
 assert.match(execute(e,input()),/受け付けられませんでした/);
 assert.equal(e.approved.rows.length,1);
});
test("No CAPTCHA secret is fail-closed",()=>{
 const e=makeEnvironment({secret:false});
 assert.match(execute(e,input()),/受け付けられませんでした/);
 assert.equal(e.approved.rows.length,1);
});
test("No private contacts tab is fail-closed",()=>{
 const e=makeEnvironment({contacts:false});
 assert.match(execute(e,input()),/受け付けられませんでした/);
 assert.equal(e.approved.rows.length,1);
});
test("Invalid privacy consent is refused",()=>{
 const e=makeEnvironment(),data=input();delete data.privacy_agree;
 assert.match(execute(e,data),/受け付けられませんでした/);
 assert.equal(e.approved.rows.length,1);
});
test("Malformed URL is refused",()=>{
 const e=makeEnvironment(),data=input();data.website="https://user:pass@example.org/path";
 assert.match(execute(e,data),/受け付けられませんでした/);
 assert.equal(e.approved.rows.length,1);
});
test("Formula in company name is escaped",()=>{
 const e=makeEnvironment(),data=input();data.company="=HYPERLINK(1)";
 assert.match(execute(e,data),/申請を受け付けました/);
 assert.ok(e.approved.rows[1][3].startsWith("'="));
});
test("Idempotent receipt prevents second row",()=>{
 const e=makeEnvironment();execute(e,input());execute(e,input());
 assert.equal(e.approved.rows.length,2);assert.equal(e.privateContacts.rows.length,2);
});
test("Different request by same email is rate limited",()=>{
 const e=makeEnvironment();execute(e,input());
 const d=input();d.submission_id="f47ac10b-58cc-4bf2-a567-0e02b2c3d482";
 assert.match(execute(e,d),/短時間に複数の申請はできません/);
 assert.equal(e.approved.rows.length,2);
});
test("No app approval on honeypot filled",()=>{
 const e=makeEnvironment(),d=input();d._honey="bot";
 assert.match(execute(e,d),/受け付けられませんでした/);
 assert.equal(e.approved.rows.length,1);
});
test("Duplicate parameter is refused",()=>{
 const e=makeEnvironment(),d=input();
 const event={parameter:d,parameters:{service:["CARE","SPARK"]},postData:{length:1200}};
 assert.match(e.sandbox.doPost(event).body,/受け付けられませんでした/);
});
test("Missing reviewer, proof and contract remain absent",()=>{
 const e=makeEnvironment();execute(e,input());
 const r=e.approved.rows[1];
 assert.equal(r[26],""); assert.equal(r[27],"");assert.ok(r[23].startsWith("WEB-"));
});
console.log("GAS direct intake tests done");
