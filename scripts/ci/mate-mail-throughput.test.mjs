import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const src=fs.readFileSync(path.resolve(import.meta.dirname,'../mate_auto_ops_v4.gs'),'utf8');
const audit=src.slice(src.indexOf('function mateV4AuditOfficialContacts(){'),
 src.indexOf('function previewMateOutreachReadinessV4(){'));
const send=src.slice(src.indexOf('function mateV4SendOutreach(){'),
 src.indexOf('function mateV4PrepareReviewDrafts(){'));
test('public first-party site audit checks at most eight companies per cycle',()=>{
 assert.match(audit,/MATE_PUBLIC_AUDIT_BATCH'\)\|\|8/);
 assert.match(audit,/Math\.min\(8,Math\.max\(3,Math\.floor\(requested\)\)\):8/);
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
