import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const src=fs.readFileSync(path.resolve(import.meta.dirname,'../mate_auto_ops_v4.gs'),'utf8');
const audit=src.slice(src.indexOf('function mateV4AuditOfficialContacts(){'),
 src.indexOf('function previewMateOutreachReadinessV4(){'));
const send=src.slice(src.indexOf('function mateV4SendOutreach(){'),
 src.indexOf('function mateV4PrepareReviewDrafts(){'));
test('public first-party site audit is capped at three and defers on the deadline',()=>{
 assert.match(audit,/MATE_PUBLIC_AUDIT_BATCH'\)\|\|3/);
 assert.match(audit,/Math\.min\(3,Math\.max\(1,Math\.floor\(requested\)\)\):3/);
 assert.ok(audit.includes('if(checked>=batchSize||Date.now()>=deadline-35000)break'));
 assert.ok(audit.includes("throw Error('MATE_AUDIT_BUDGET_DEFER')"));
 assert.ok(audit.includes("outcomes.budgetDeferred++"));
 assert.ok(audit.includes("checked--;outcomes.budgetDeferred++;break"));
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
 const sent=trigger.indexOf('const resultSends=mateV4SendOutreach()');
 assert.ok(optout>=0&&bounce>optout&&sent>bounce);
 assert.ok(trigger.includes('if(!lock.tryLock(1000))'));
});

test('fast-trigger telemetry records every real start and final status in dedicated sheet',()=>{
 const fast=src.slice(src.indexOf('function mateV4FastOutreachCycle(){'),
   src.indexOf('function mateV4EnsureFastOutreachTrigger_(){'));
 assert.ok(fast.includes("'MATE_15分送信稼働監視V1'"));
 assert.ok(fast.includes("'STARTED'"));
 assert.ok(fast.includes("status='CYCLE_COMPLETED'"));
 assert.ok(fast.includes("status='CYCLE_FAILED '"));
 assert.ok(fast.includes("monitor.getRange(monitorRow,3,1,3).setValues("));
 assert.ok(fast.includes("lock.releaseLock()"));
});

test('positive business reply is routed to the correct service form without auto-publishing',()=>{
 const start=src.indexOf('function mateV4AcknowledgeListingInterests_(){');
 const end=src.indexOf('function mateV4ProductionHeartbeat_',start);
 assert.ok(start>0&&end>start);
 const reply=src.slice(start,end);
 for(const uri of ['https://care.kosodatemate.jp/contact.html',
   'https://spark.kosodatemate.jp/partners.html',
   'https://care.kosodatemate.jp/play-listing.html'])assert.ok(reply.includes(uri));
 assert.ok(reply.includes("x['状態']!=='要返信・申請案内'"));
 assert.ok(reply.includes('optouts.has(email)'));
 assert.ok(reply.includes('mateV4ReplyWithoutQuotedCampaign_'));
 assert.ok(reply.includes("if(from!==email"));
 assert.ok(reply.includes('MailApp.getRemainingDailyQuota()'));
 assert.ok(reply.indexOf("申請案内送信結果要確認")<reply.indexOf("msg.reply(body"));
 assert.ok(reply.includes('自動的に掲載公開・契約・課金されることはありません'));
 assert.ok(reply.includes("申請案内送信済・正式申請待ち"));
});

test('15-minute zero-send diagnostics distinguishes cap, Gmail limit, and missing prospects',()=>{
 const start=src.indexOf('function mateV4FastZeroSendReason_(){');
 const end=src.indexOf('function mateV4FastOutreachCycle(){',start);
 assert.ok(start>0&&end>start);
 const diagnostic=src.slice(start,end);
 assert.ok(diagnostic.includes('DAILY_CAP_REACHED'));
 assert.ok(diagnostic.includes('GMAIL_QUOTA_EXHAUSTED'));
 assert.ok(diagnostic.includes('NO_PRELIMINARY_SENDABLE_PROSPECTS'));
 assert.ok(diagnostic.includes('diagnoseMateV4Backlog()'));
 assert.ok(diagnostic.includes("phase==='PER_SERVICE_30'?90"));
 const cycle=src.slice(end,src.indexOf('function mateV4FastTriggerEvidence_',end));
 assert.ok(cycle.includes("if(!sent)try{detail=mateV4FastZeroSendReason_()"));
 assert.ok(cycle.includes("detail||'送信抑止・重複確認済み'"));
});
