import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const source=fs.readFileSync(path.resolve(import.meta.dirname,'../mate_auto_ops_v4.gs'),'utf8');
const a=source.indexOf('function mateAutoOpsV4Cycle(){');
const b=source.indexOf('function installMateAutoOpsV4(){',a);
assert.ok(a>0&&b>a);
const fnSource=source.slice(a,b);
function runCycle(phase,failOptout=false){
 const props={'MATE_V4_WORK_PHASE':String(phase)},invoked=[],log=[];
 const sheet={getRange:()=>({setValue:()=>{}})};
 const keys={
  LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock:()=>invoked.push('unlock')})},
  PropertiesService:{getScriptProperties:()=>({getProperty:k=>props[k]||'',
    setProperty:(k,v)=>{props[k]=v}})},
  mateV4Tab_:()=>sheet,mateV4Book_:()=>({}),
  mateV4Jst_:()=> '2026-11-15 12:00:00',
  MATE_V4:{version:'TEST-SLICED'},
  console:{log:v=>log.push(v)}
 };
 const steps=[
 'mateV4SeedExistingCRM','mateV4SeedSectorDirectories','mateV4DiscoverLicensedPublicCsvSources',
 'mateV4DiscoverGeneralWebProspects','mateV4SeedEditorialProspects','mateV4CollectLeads',
 'mateV4DiscoverFreeOsmCandidates','mateV4PromoteFreeWebCandidates',
 'mateV4OptoutInbox','mateV4HardBounceQuarantine','mateV4ReconcileSentReservations',
 'mateV4AuditOfficialContacts','mateV4PrepareReviewDrafts','mateV4SyncReferralLedger',
 'mateV4SendOutreach','mateV4TrackReplies','mateV4RefreshExternalListingKpi_',
 'mateV4CaptureListingIntent_','mateV4AcknowledgeListingInterests_'];
 for(const name of steps)keys[name]=()=>{invoked.push(name);
   if(failOptout&&name==='mateV4OptoutInbox')throw Error('optout processing failed');
   return 1;
 };
 keys.mateV4ProductionHeartbeat_=report=>({version:'TEST-SLICED',codeRunning:true});
 const fn=new Function(...Object.keys(keys),fnSource+'\nreturn mateAutoOpsV4Cycle;')(...Object.values(keys));
 let result,err;try{result=fn()}catch(e){err=e}
 return {result,err,invoked,props};
}
test('three rotating phases each preserve send guards and report success',()=>{
 for(let phase=0;phase<3;phase++){
   const r=runCycle(phase);
   assert.equal(r.err,undefined);
   assert.equal(r.result.phaseIndex,phase);
   assert.equal(r.props.MATE_V4_WORK_PHASE,String((phase+1)%3));
   assert.equal(r.invoked.includes('mateV4SendOutreach'),true);
   assert.equal(r.invoked.includes('mateV4OptoutInbox'),true);
   assert.equal(r.result.productionHeartbeat.codeRunning,true);
 }
});
test('failure of optout processing aborts before sending mail',()=>{
 const r=runCycle(0,true);
 assert.match(String(r.err),/optout processing failed/);
 assert.equal(r.invoked.includes('mateV4SendOutreach'),false);
 assert.equal(r.invoked.includes('unlock'),true);
});
test('each phase includes only its expensive discovery job',()=>{
 const x=runCycle(0),y=runCycle(1),z=runCycle(2);
 assert.equal(x.invoked.includes('mateV4DiscoverLicensedPublicCsvSources'),true);
 assert.equal(x.invoked.includes('mateV4DiscoverGeneralWebProspects'),false);
 assert.equal(y.invoked.includes('mateV4CollectLeads'),true);
 assert.equal(y.invoked.includes('mateV4SeedEditorialProspects'),true);
 assert.equal(x.invoked.includes('mateV4SeedEditorialProspects'),false);
 assert.equal(z.invoked.includes('mateV4SeedEditorialProspects'),false);
 assert.equal(z.invoked.includes('mateV4DiscoverFreeOsmCandidates'),true);
 assert.equal(z.invoked.includes('mateV4PromoteFreeWebCandidates'),true);
});
