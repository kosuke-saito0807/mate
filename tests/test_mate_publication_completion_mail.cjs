const fs=require("node:fs"),vm=require("node:vm"),assert=require("node:assert/strict");
const source=fs.readFileSync("scripts/mate_publication_completion_mail.gs","utf8");
const ctx={console,Date,URL,Utilities:{formatDate:()=>"2026-11-10"},Session:{getEffectiveUser:()=>({getEmail:()=>"kosodatemate@gmail.com"})}};
vm.createContext(ctx);vm.runInContext(source,ctx);
function row(n){return Array(n).fill("")}
const aid="MATE-WEB-test",sid="mate_spark_test";
const application=row(30);Object.assign(application,{0:aid,2:"SPARK",3:"Example School",20:"2026-11-10",21:"同意済み",24:"承認",25:"確認済み",26:"運営審査者",27:sid});
const approval=row(17);Object.assign(approval,{1:aid,2:"SPARK",3:"Example School",5:"公式サイト検証",6:"OWNER_CONFIRMATION:2026-11-10",7:"2026-11-10",8:"運営審査者",9:"確認済み",10:sid,12:"公開確認済",13:"https://spark.kosodatemate.jp/schools/test",14:"未送信"});
const contract=row(14);Object.assign(contract,{0:"MATE-FREE-test",1:"SPARK",2:sid,3:"Example School",7:"2026-11-01",8:"2027-11-01",9:"担当",10:"2026-11-10",11:"2026-11-04-v1",12:"APPLICATION:proof",13:"有効"});
const contact=row(7);Object.assign(contact,{0:aid,4:"approved-owner@example.org"});
const apps={values:[application]},contracts={values:[contract]},contacts={values:[contact]};
function evaluate(){return ctx.matePubEvaluate_(apps,approval,contracts,contacts)}
assert.equal(evaluate().publicId,sid);
approval[14]="送信済み";assert.equal(evaluate(),"送信済みまたは送信証跡あり");approval[14]="未送信";
approval[12]="審査中";assert.match(evaluate(),/公開確認/);approval[12]="公開確認済";
contract[13]="未契約";assert.equal(evaluate(),"有効契約なし");contract[13]="有効";
application[24]="未審査";assert.match(evaluate(),/承認/);application[24]="承認";
approval[13]="https://evil.example/schools/test";assert.match(evaluate(),/URL/);
approval[13]="http://spark.kosodatemate.jp/schools/test";assert.match(evaluate(),/URL/);
approval[13]="https://spark.kosodatemate.jp/schools/test";assert.equal(evaluate().service,"SPARK");
console.log("PASS: approval, contract, site-host, idempotence, contact gates");