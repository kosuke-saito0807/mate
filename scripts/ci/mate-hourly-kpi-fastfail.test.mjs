import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const source=fs.readFileSync(path.resolve(import.meta.dirname,'../mate_auto_ops_v4.gs'),'utf8');
const cycle=source.slice(source.indexOf('function mateAutoOpsV4Cycle(){'),source.indexOf('function installMateAutoOpsV4(){'));
const heartbeat=source.slice(source.indexOf('function mateV4ProductionHeartbeat_(report){'),source.indexOf('function mateAutoOpsV4Cycle(){'));
test('external application and publication KPI refreshes before any rotating discovery phase',()=>{
 assert.ok(cycle.indexOf("report.externalListingKpi=safe(")>0);
 assert.ok(cycle.indexOf("report.externalListingKpi=safe(")<cycle.indexOf('if(phaseIndex===0)'));
 assert.equal((cycle.match(/report\.externalListingKpi=safe/g)||[]).length,1);
});
function heartbeatStatus(report){
 const values=[];
 const sheet={getRange:()=>({setValues:x=>values.push(x)})};
 const deps={
  mateV4Book_:()=>({}),mateV4Tab_:(_b,name)=>name==='GAS本番稼働監視V4'?sheet:name,
  mateV4Rows_:()=>[],mateV4Jst_:()=> '2026-11-15 22:00:00',
  MATE_V4:{leads:'leads',version:'FASTFAIL-TEST'}
 };
 const run=new Function(...Object.keys(deps),heartbeat+'\nreturn mateV4ProductionHeartbeat_;')(...Object.values(deps));
 run(report);
 return values[0][0][10];
}
test('heartbeat flags a failed isolated phase even when other steps succeed',()=>{
 const status=heartbeatStatus({phaseIndex:0,
  catalogDiscovery:{step:'catalogDiscovery',status:'FAILED_NO_SIDE_EFFECT_ASSUMED_FALSE'},
  externalListingKpi:{actualExternalApplications:1}});
 assert.match(status,/^CYCLE_PARTIAL: catalogDiscovery$/);
});
test('heartbeat only reports completed for a clean cycle',()=>{
 assert.equal(heartbeatStatus({phaseIndex:1,externalListingKpi:{actualExternalPublications:2}}),'CYCLE_COMPLETED');
});

test('genuine listing interest is captured ahead of slow public-site audits',()=>{
 const intent=cycle.indexOf("report.listingIntent=safe(");
 const audit=cycle.indexOf("report.publicAudit=safe(");
 const optout=cycle.indexOf("report.optouts=mateV4OptoutInbox()");
 assert.ok(intent>optout,'suppression must be processed first');
 assert.ok(intent<audit,'warm lead replies must not wait for external audits');
 assert.equal((cycle.match(/report\.listingIntent=safe/g)||[]).length,1);
});
