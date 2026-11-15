import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const src=fs.readFileSync(path.resolve(import.meta.dirname,'../mate_auto_ops_v4.gs'),'utf8');
const a=src.indexOf('function mateV4ProductionHeartbeat_(report){');
const b=src.indexOf('function mateAutoOpsV4Cycle(){',a);
assert.ok(a>0&&b>a);
const code=src.slice(a,b);
function run(report){
 const writes=[];
 const deps={
  mateV4Book_:()=>({}),mateV4Tab_:(_b,name)=>name==='GAS本番稼働監視V4'?
   {getRange:()=>({setValues:rows=>writes.push(rows)})}:name,
  mateV4Rows_:()=>[],mateV4Jst_:()=> '2026-11-16 00:10:00',
  MATE_V4:{leads:'leads',version:'TEST-GAS'}
 };
 new Function(...Object.keys(deps),code+'\nreturn mateV4ProductionHeartbeat_;')(...Object.values(deps))(report);
 return writes[0][0];
}
test('OFF and other nonnumeric send states never become NaN in Sheets',()=>{
 const row=run({outreach:'OFF',phaseIndex:1});
 assert.equal(row[8],0);
 assert.equal(row[10],'CYCLE_COMPLETED');
});
test('audit productivity and actual application/publication counts appear in heartbeat',()=>{
 const row=run({outreach:2,publicAudit:{checked:8,eligible:3,discovered:4},
  externalListingKpi:{actualExternalApplications:1,actualExternalPublications:1},
  listingIntent:{newInterests:2}});
 assert.equal(row[8],2);
 const diag=JSON.parse(row[9]);
 assert.equal(diag.audit.checked,8);
 assert.equal(diag.audit.eligible,3);
 assert.equal(diag.interest,2);
 assert.equal(diag.externalApps,1);
 assert.equal(diag.public,1);
});
