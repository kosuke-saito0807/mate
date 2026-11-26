import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const source=fs.readFileSync(path.resolve(import.meta.dirname,'../mate_auto_ops_v4.gs'),'utf8');
const a=source.indexOf('function mateAutoOpsV4Cycle(){');
const b=source.indexOf('function installMateAutoOpsV4(){',a);
assert.ok(a>0&&b>a);
const fnSource=source.slice(a,b);
function runCycle(phase,failOptout=false,cooldown=false,failEditorial=false,exhaustAfterSend=false){
 const props={'MATE_V4_WORK_PHASE':String(phase)},invoked=[],log=[],statuses=[];
 let now=1000000;
 if(cooldown)props.MATE_FAST_GMAIL_QUOTA_BLOCKED_JST='2026-11-15';
 const sheet={getRange:(row,col)=>({setValue:v=>{if(row===2&&col===11)statuses.push(v)}})};
 const keys={
  Date:{now:()=>now},
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
   if(exhaustAfterSend&&name==='mateV4SendOutreach')now+=220000;
   if(failOptout&&name==='mateV4OptoutInbox')throw Error('optout processing failed');
   if(failEditorial&&name==='mateV4SeedEditorialProspects')throw Error('editorial source failed');
   return 1;
 };
 keys.mateV4ProductionHeartbeat_=report=>({version:'TEST-SLICED',codeRunning:true});
 const fn=new Function(...Object.keys(keys),fnSource+'\nreturn mateAutoOpsV4Cycle;')(...Object.values(keys));
 let result,err;try{result=fn()}catch(e){err=e}
 return {result,err,invoked,props,statuses};
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

test('Gmail cooldown keeps only bounded editorial discovery and sheet KPI refresh active',()=>{
 const r=runCycle(1,false,true);
 assert.equal(r.err,undefined);
 assert.deepEqual(r.invoked,['mateV4SeedEditorialProspects','mateV4RefreshExternalListingKpi_','unlock']);
 assert.equal(r.result.outreach,'NOT_ATTEMPTED');
 assert.equal(r.result.sendOutcome,'NOT_ASSERTED');
 assert.equal(r.result.editorialProspects,1);
 assert.equal(r.result.externalListingKpi,1);
 assert.equal(r.props.MATE_V4_WORK_PHASE,'1');
 assert.equal(r.statuses.at(-1),'GMAIL_QUOTA_COOLDOWN_NO_GMAIL_CALLS_DISCOVERY_ONLY');
});
test('Cooldown discovery failure still refreshes KPI, holds every send and flags partial state',()=>{
 const r=runCycle(0,false,true,true);
 assert.equal(r.err,undefined);
 assert.deepEqual(r.invoked,['mateV4SeedEditorialProspects','mateV4RefreshExternalListingKpi_','unlock']);
 assert.equal(r.result.editorialProspects.status,'FAILED_NO_SIDE_EFFECT_ASSUMED_FALSE');
 assert.equal(r.result.outreach,'NOT_ATTEMPTED');
 assert.equal(r.statuses.at(-1),'GMAIL_QUOTA_COOLDOWN_NO_GMAIL_CALLS_DISCOVERY_PARTIAL');
});

test('optional deadline skips slow work without skipping opt-outs, bounce guard or sender',()=>{
 const r=runCycle(1,false,false,false,true);
 assert.equal(r.err,undefined);
 for(const required of ['mateV4OptoutInbox','mateV4HardBounceQuarantine',
                        'mateV4ReconcileSentReservations','mateV4SendOutreach'])
   assert.equal(r.invoked.includes(required),true,required+' remains mandatory');
 for(const optional of ['mateV4AuditOfficialContacts','mateV4SeedEditorialProspects',
                        'mateV4RefreshExternalListingKpi_','mateV4CollectLeads'])
   assert.equal(r.invoked.includes(optional),false,optional+' skipped by deadline');
 assert.equal(r.result.publicAudit.status,'SKIPPED_EXECUTION_BUDGET');
 assert.equal(r.result.editorialProspects.status,'SKIPPED_EXECUTION_BUDGET');
 assert.equal(r.result.productionHeartbeat.codeRunning,true);
 assert.ok(r.statuses.includes('SEND_STAGE_REACHED_NOT_DELIVERY_CONFIRMATION'));
 assert.equal(r.invoked.at(-1),'unlock','script lock released after budget defer');
});
