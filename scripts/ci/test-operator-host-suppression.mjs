import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync('scripts/mate_auto_ops_v4.gs','utf8');
const block=(a,b)=>{
  const start=source.indexOf(a),end=source.indexOf(b,start+a.length);
  assert.ok(start>=0&&end>start,a+' segment missing');
  return source.slice(start,end);
};
test('An earlier mailed first-party host is held across CARE/SPARK/PLAY and alias mailboxes',()=>{
  const context=vm.createContext({});
  vm.runInContext(source,context,{timeout:3000});
  const pitched=context.mateV4PreviouslyPitchedHosts_([
    {'候補キー':'OLD-PLAY','サービス':'PLAY','宛先メール':'info@ayasan.jp',
     '根拠URL':'https://www.ayasan.jp/ja/contact','状態':'送信結果要確認'},
    {'候補キー':'OLD-SPARK','サービス':'SPARK','宛先メール':'hello@another-school.co.jp',
     '根拠URL':'https://another-school.co.jp/'},
    {'候補キー':'OLD-THIRD','サービス':'CARE','宛先メール':'hosted@example.co.jp',
     '根拠URL':'https://docs.google.com/document/d/123'},
    {'候補キー':'OLD-HTTP','サービス':'CARE','宛先メール':'ab@invalid.co.jp',
     '根拠URL':'http://insecure.co.jp/'}
  ]);
  assert.equal(pitched.has('ayasan.jp'),true);
  assert.equal(pitched.has('another-school.co.jp'),true);
  assert.equal(pitched.has('docs.google.com'),false);
  assert.equal(pitched.has('insecure.co.jp'),false);
  assert.equal(pitched.has('unrelated-brand.co.jp'),false);
});
test('Mailer checks previous company host before each send and reserves it atomically',()=>{
  const sender=block('function mateV4SendOutreach(){','function mateV4PrepareReviewDrafts(){');
  assert.match(sender,/const pitchedHosts=mateV4PreviouslyPitchedHosts_\(logs\)/);
  const guards=sender.match(/pitchedHosts\.has\(mateV4Host_\(x\['公式URL'\]\)\)/g)||[];
  assert.equal(guards.length,2,'hold both BALANCED_15 readiness and real mail loop');
  const reservation=sender.indexOf('mateV4Append_(sheet,[');
  const add=sender.indexOf("pitchedHosts.add(mateV4Host_(x['公式URL']))");
  const attempt=sender.indexOf('GmailApp.sendEmail(');
  assert.ok(reservation>=0&&add>reservation&&attempt>add,
    'reservation and operator host must be held before any external send');
  assert.ok(sender.includes('manualHistory.has(email)'));
  assert.ok(sender.includes('blocked.has(email)'));
  assert.ok(sender.includes('allRecipients.has(email)'));
});
test('Contact audit does not reclassify previously pitched host as available prospect',()=>{
  const audit=block('function mateV4AuditOfficialContacts(){',
    'function previewMateOutreachReadinessV4(){');
  assert.ok(audit.includes('const pitchedHosts=mateV4PreviouslyPitchedHosts_(sentLogs)'));
  assert.ok(audit.includes("pitchedHosts.has(mateV4Host_(x['公式URL']))"));
  assert.ok(audit.includes('if(alreadyAttempted)return 99'));
  assert.ok(audit.includes('mateV4SalesRefusal_'));
  assert.ok(audit.includes('stopped.has(email)'));
});
test('Seed sources skip previously pitched domains before recording unverified candidates',()=>{
  const importer=block('function mateV4SeedEditorialProspects(){',
    '/** Business fit is a rank hint only; never implies solicitation consent.');
  assert.ok(importer.includes("pitchedHosts.has(host)"));
  assert.ok(importer.includes("previouslyContactedHost++"));
  assert.ok(importer.includes("'UNVERIFIED'"));
  assert.ok(importer.includes("'窓口確認待ち'"));
  assert.ok(!importer.includes('GmailApp.sendEmail'));
});
