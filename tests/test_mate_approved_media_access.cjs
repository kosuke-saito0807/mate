const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const source=fs.readFileSync('scripts/mate_direct_intake.gs','utf8');
function row(n){return Array(n).fill('')}
const aid='MATE-WEB-48444d99-17e4-4fd9-a2ac-45a07e93e832',pub='mate_spark_48444d9917e44fd9';
const app=row(30);Object.assign(app,{0:aid,2:'SPARK',3:'CodeCampKIDS 大崎教室',24:'承認',25:'確認済み',26:'MATE運営事務局',27:pub});
const approved=row(17);Object.assign(approved,{1:aid,2:'SPARK',3:'CodeCampKIDS 大崎教室',5:'本人確認',6:'EVIDENCE',7:'2026-11-10',8:'運営',9:'確認済み',10:pub,11:'掲載承認',12:'公開確認済み',13:'https://spark.kosodatemate.jp/#listing-'+pub});
const agreement=row(14);Object.assign(agreement,{0:'MATE-FREE-contract',1:'SPARK',2:pub,3:'CodeCampKIDS 大崎教室',7:'2026-11-01',8:'2027-11-01',9:'担当',10:'2026-11-10',11:'v1',12:'EVIDENCE',13:'有効'});
const image=row(11);Object.assign(image,{0:aid,1:'SPARK',2:'DRIVE:'+'a'.repeat(32),3:'DRIVE:'+'b'.repeat(32),7:'掲載権限あり',8:'確認済み'});
const outsider=row(11);Object.assign(outsider,{0:'MATE-WEB-outside',1:'SPARK',2:'DRIVE:'+'c'.repeat(32),7:'掲載権限あり',8:'未審査'});
const data={
 '掲載セルフ申請':[app],
 '掲載公開承認V1_運営専用':[approved],
 '掲載契約':[agreement],
 '掲載画像V1_非公開':[image,outsider]
};
function sheet(name){return {
 getLastRow:()=>data[name].length+1,getLastColumn:()=>data[name][0]?.length||17,
 getRange:(start,col,len)=>({getDisplayValues:()=>data[name].slice(start-2,start-2+len)})
}}
const email='publisher@service-project.iam.gserviceaccount.com';
const grants=[];
const ctx=vm.createContext({
 Session:{getEffectiveUser:()=>({getEmail:()=> 'kosodatemate@gmail.com'})},
 PropertiesService:{getScriptProperties:()=>({getProperty:k=>k==='MATE_MEDIA_READER_EMAILS'?email:k==='MATE_UPLOAD_FOLDER_ID'?'media-folder':''})},
 SpreadsheetApp:{openById:()=>({getSheetByName:n=>data[n]?sheet(n):null})},
 DriveApp:{getFolderById:()=>({getId:()=> 'media-folder'}),
   getFileById:id=>({getParents:()=>({hasNext:()=>true,next:()=>({getId:()=> 'media-folder'})}),
      addViewer:mail=>grants.push({id,mail})})},
 Utilities:{formatDate:()=> '2026-11-10',DigestAlgorithm:{SHA_256:'SHA_256'},computeDigest:(_,v)=>[...crypto.createHash('sha256').update(v).digest()]},
 Date,console
});
vm.runInContext(source,ctx);
const expected=crypto.createHash('sha256').update(email).digest('hex').slice(0,16);
assert.equal(ctx.previewMateMediaReaderFingerprintsV1()[0],expected);
const preview=ctx.previewMateApprovedMediaAccessV1();
assert.equal(preview.mode,'PREVIEW_ONLY');
assert.equal(preview.approvedApplications,1);
assert.equal(preview.selectedFiles,2);
assert.equal(grants.length,0,'preview cannot grant or publish media');
const result=ctx.repairMateApprovedMediaAccessV1();
assert.equal(result.selectedFiles,2);assert.equal(result.viewerGrants,2);
assert.deepEqual(grants.map(v=>v.id),['a'.repeat(32),'b'.repeat(32)]);
assert.ok(grants.every(v=>v.mail===email));
approved[12]='公開待ち';
assert.equal(ctx.repairMateApprovedMediaAccessV1().viewerGrants,0,'not-published applications receive no permission grants');
approved[12]='公開確認済み';
image[8]='未審査';
assert.equal(ctx.repairMateApprovedMediaAccessV1().viewerGrants,0,'unreviewed photos never shared');
console.log('PASS: approved published contracted media-only viewer repair; no public access, mail or publication');