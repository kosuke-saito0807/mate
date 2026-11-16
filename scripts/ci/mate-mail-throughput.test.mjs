import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const src=fs.readFileSync(path.resolve(import.meta.dirname,'../mate_auto_ops_v4.gs'),'utf8');
const audit=src.slice(src.indexOf('function mateV4AuditOfficialContacts(){'),
 src.indexOf('function previewMateOutreachReadinessV4(){'));
const send=src.slice(src.indexOf('function mateV4SendOutreach(){'),
 src.indexOf('function mateV4PrepareReviewDrafts(){'));
test('public first-party site audit defaults to twelve, capped at sixteen companies per cycle',()=>{
 assert.match(audit,/MATE_PUBLIC_AUDIT_BATCH'\)\|\|12/);
 assert.match(audit,/Math\.min\(16,Math\.max\(3,Math\.floor\(requested\)\)\):12/);
 assert.ok(audit.includes('if(checked>=batchSize)break'));
 assert.ok(audit.includes('mateV4SalesRefusal_'));
 assert.ok(audit.includes('mateV4OwnerBlocked_'));
 assert.ok(audit.includes("mateV4SameBusinessHost_"));
});
test('outreach can send up to ten in one cycle without bypassing overall DAILY_30 cap',()=>{
 assert.ok(send.includes("const maxPerExecution=phase==='DAILY_30'?10"));
 assert.ok(send.includes("const maxCap=phase==='PILOT'?1:phase==='BALANCED_15'?15:phase==='DAILY_30'?30"));
 assert.ok(send.includes("if(sent+already>=cap||sent>=maxPerExecution"));
 assert.ok(send.includes("attempted.has(key)"));
 assert.ok(send.includes("blocked.has(email)"));
 assert.ok(send.includes("manualHistory.has(email)"));
 assert.ok(send.includes("GmailApp.sendEmail(email,subject,body"));
});

test('fresh first-party Web-discovered business mailbox outranks old failed audit',()=>{
 const fresh=audit.indexOf("String(x['最終確認結果']||'').startsWith('WEB_DISCOVERY ')");
 const stale=audit.indexOf("if(x['状態']==='窓口確認待ち'&&mateV4RoleEmail_(email))return 3");
 assert.ok(fresh>=0&&stale>fresh);
 assert.ok(audit.includes('mateV4Fresh_(String(x[\'取得日時\']||\'\').slice(0,10),7)'));
});

test('owner-approved per-service 30 batches more than six per run without relaxing daily caps',()=>{
 assert.ok(send.includes("phase==='PER_SERVICE_30'?10:cap"));
 assert.ok(send.includes("phase==='PER_SERVICE_30'?90"));
 assert.ok(send.includes("phase==='PER_SERVICE_30'?30"));
 assert.ok(send.includes("MailApp.getRemainingDailyQuota()<1"));
});
test('guarded fast outreach trigger runs every fifteen minutes and preserves opt-out-first ordering',()=>{
 const trigger=src.slice(src.indexOf('function mateV4FastOutreachCycle(){'),
   src.indexOf('function installMateAutoOpsV4(){'));
 assert.ok(trigger.includes('everyMinutes(15).create()'));
 assert.ok(trigger.includes('getProjectTriggers()'));
 assert.ok(trigger.includes("getHandlerFunction()==='mateV4FastOutreachCycle'"));
 assert.ok(trigger.includes("MATE_AUTO_SEND_LEGAL_REVIEWED"));
 const optout=trigger.indexOf('const optouts=mateV4OptoutInbox()');
 const bounce=trigger.indexOf('const bounces=mateV4HardBounceQuarantine()');
 const sent=trigger.indexOf('const sent=mateV4SendOutreach()');
 assert.ok(optout>=0&&bounce>optout&&sent>bounce);
 assert.ok(trigger.includes('if(!lock.tryLock(1000))'));
});
