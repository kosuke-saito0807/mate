import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const src=fs.readFileSync(path.resolve(import.meta.dirname,'../mate_auto_ops_v4.gs'),'utf8');
const fn=src.slice(src.indexOf('function mateV4SendOutreach(){'),src.indexOf('function mateV4TrackReplies(){'));
assert.ok(fn.startsWith('function mateV4SendOutreach(){'));
const capExpression=fn.match(/const perServiceCap=([^;]+);/)?.[1];
assert.ok(capExpression);
const serviceCap=new Function('phase','cap','return '+capExpression);
test('DAILY_30 can allocate up to 30 to a service only when other service slots are unused',()=>{
  assert.equal(serviceCap('DAILY_30',30),30);
  assert.ok(fn.includes('sent+already>=cap'),'global count must always cap account at 30');
  assert.ok(fn.includes('serviceToday[service]>=perServiceCap'));
});
test('PILOT, BALANCED_15, and PER_SERVICE_30 guardrails remain intact',()=>{
  assert.equal(serviceCap('BALANCED_15',15),5);
  assert.equal(serviceCap('PILOT',1),1);
  assert.equal(serviceCap('PER_SERVICE_30',90),30);
});
test('duplicate, optout, legal basis and quota gates remain necessary',()=>{
  for(const v of ['attempted.has(key)','blocked.has(email)','allRecipients.has(email)',
    'manualHistory.has(email)','MATE_AUTO_SEND_LEGAL_REVIEWED',
    'MailApp.getRemainingDailyQuota()','x[\'営業拒否\']']){
    assert.ok(fn.includes(v),v);
  }
});
