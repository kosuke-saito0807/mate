import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const source=fs.readFileSync(path.resolve(import.meta.dirname,'../mate_auto_ops_v4.gs'),'utf8');
const a=source.indexOf('function mateV4ExternalListingFunnel_(){');
const b=source.indexOf('function mateV4RefreshExternalListingKpi_(){',a);
const c=source.indexOf('function mateV4CaptureListingIntent_(){',b);
const d=source.indexOf('function mateV4ProductionHeartbeat_(',c);
assert.ok(a>0&&b>a&&c>b&&d>c);

function funnel(applications=[],reviews=[]){
 const data={
  '営業候補_自動収集':[],
  '営業送信ログV4':[],
  '掲載セルフ申請':applications,
  '掲載公開承認V1_運営専用':reviews
 };
 const deps={mateV4Book_:()=>({}),mateV4Tab_:(_b,n)=>n,
  mateV4Rows_:n=>data[n]||[],MATE_V4:{leads:'営業候補_自動収集',sent:'営業送信ログV4'},
  mateV4Jst_:()=> '2026-11-15 22:00:00',mateV4Https_:s=>String(s).startsWith('https://')};
 return new Function(...Object.keys(deps),source.slice(a,b)+'\nreturn mateV4ExternalListingFunnel_;')(
  ...Object.values(deps))();
}
const app={
  '申請ID':'T-1','サービス':'SPARK','教室・事業者名':'CodeCampKIDS 大崎教室',
  '公式URL':'https://codecampkids.jp/','審査状態':'承認','担当者権限の確認':'確認済み',
  '公開ID':'pub1','紹介文':'正規教室'};
const review={
  '申請ID':'T-1','サービス':'SPARK','権限確認証跡':'OWNER_ATTESTATION:2026-11-15',
  '進捗':'公開確認済み','公開URL':'https://spark.kosodatemate.jp/#listing-pub1',
  '公開用ID':'pub1','操作':'掲載承認'
};
test('owner-related approved listing does not count as external acquisition',()=>{
 const v=funnel([app],[review]);
 assert.equal(v.summary.SPARK.allApplications,1);
 assert.equal(v.summary.SPARK.verifiedExternalApplications,0);
 assert.equal(v.summary.SPARK.verifiedExternalPublications,0);
});
test('uncorroborated external applicant cannot be called acquired listing',()=>{
 const v=funnel([{...app,'教室・事業者名':'株式会社虹の教室',
  '公式URL':'https://niji-school.jp/'}],[review]);
 assert.equal(v.summary.SPARK.verifiedExternalApplications,0);
});
test('independent third-party evidence and published URL count once',()=>{
 const a={...app,'教室・事業者名':'株式会社虹の教室',
   '公式URL':'https://niji-school.jp/'};
 const rv={...review,'権限確認証跡':'THIRD_PARTY_VERIFIED:company-domain-mail-evidence'};
 const v=funnel([a,a],[rv]);
 assert.equal(v.summary.SPARK.allApplications,1);
 assert.equal(v.summary.SPARK.verifiedExternalApplications,1);
 assert.equal(v.summary.SPARK.verifiedExternalPublications,1);
});
test('reply queue requires existing send, explicit intent, suppresses STOP and cannot publish',()=>{
 const code=source.slice(c,d);
 for(const fragment of ["recipients.get(email)","stopped.has(email)",
  "掲載希望","配信停止","newInterests:added","要返信・申請案内"])
  assert.ok(code.includes(fragment),fragment);
 assert.ok(!code.includes("GmailApp.sendEmail("));
 assert.ok(!code.includes("MailApp.sendEmail("));
 assert.ok(!code.includes("掲載承認"));
});

test('KPI refresh records one daily trend row per service and updates same-day snapshots',()=>{
 const a=source.indexOf('function mateV4RefreshExternalListingKpi_(){');
 const b=source.indexOf('function mateV4CaptureListingIntent_(){',a);
 const body=source.slice(a,b);
 assert.ok(body.includes("MATE_外部掲載日次推移_V1"));
 assert.ok(body.includes("previous.find(x=>x['集計日']===today"));
 assert.ok(body.includes("trend.getRange(existing._row,1,1,11).setValues([snapshot])"));
 assert.ok(body.includes("else mateV4Append_(trend,snapshot)"));
});
