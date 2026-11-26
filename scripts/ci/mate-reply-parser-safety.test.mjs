import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const src=fs.readFileSync(path.resolve(import.meta.dirname,'../mate_auto_ops_v4.gs'),'utf8');
const start=src.indexOf('function mateV4ReplyWithoutQuotedCampaign_(raw){');
const end=src.indexOf('function mateV4CaptureListingIntent_(){',start);
assert.ok(start>=0&&end>start);
const strip=new Function(src.slice(start,end)+'\nreturn mateV4ReplyWithoutQuotedCampaign_;')();
const mailStart=src.indexOf('function mateV4Email_(s){');
const mailEnd=src.indexOf('function mateV4OwnerBlocked_',mailStart);
assert.ok(mailStart>=0&&mailEnd>mailStart);
const emailCode=src.slice(mailStart,mailEnd);
const mail=new Function(emailCode+'\nreturn mateV4Email_;')();
const interested=new Function(src.slice(start,end)+'\nreturn mateV4GenuineListingInterest_;')();

test('quoted MATE campaign must not be mistaken for an interested reply',()=>{
 const raw='承知しました。\n\nOn Sun, Nov 15, 2026 at 11:00 AM MATE wrote:\n> 掲載希望と返信してください\n> 配信停止とご返信ください';
 const body=strip(raw);
 assert.equal(body,'承知しました。');
 assert.equal(/掲載希望/.test(body),false);
});
test('real positive reply remains readable without quote and unsubscribe footer',()=>{
 const raw='掲載希望です。手続き方法を教えてください。\n\n-----Original Message-----\n掲載希望と返信してください\n配信停止とご返信ください';
 const body=strip(raw);
 assert.match(body,/掲載希望です/);
 assert.equal(body.includes('配信停止'),false);
});
test('a clear unsubscribe request takes precedence over interest',()=>{
 const raw='掲載希望と書きましたが、配信停止でお願いします。\nFrom: MATE <kosodatemate@gmail.com>\n掲載希望とご返信';
 const body=strip(raw);
 assert.match(body,/配信停止/);
 assert.match(body,/掲載希望/);
});
test('Japanese Gmail quoted timestamp is excluded from real business reply',()=>{
 const raw='MATE運営事務局様\n\n掲載を前向きに検討したいと考えております。\nご案内よろしくお願いいたします。\n\n2026年11月24日(火) 8:44 MATE運営事務局 <kosodatemate@gmail.com>:\n掲載希望とご返信ください\n配信停止とご返信ください';
 const own=strip(raw);
 assert.match(own,/掲載を前向きに検討したい/);
 assert.equal(own.includes('配信停止'),false);
 assert.equal(own.includes('掲載希望とご返信ください'),false);
 assert.equal(interested(own),true);
});

test('positive reply classifier is shared across capture and acknowledgement',()=>{
 const capture=src.slice(src.indexOf('function mateV4CaptureListingIntent_(){'),
                         src.indexOf('function mateV4AcknowledgeListingInterests_(){'));
 const ack=src.slice(src.indexOf('function mateV4AcknowledgeListingInterests_(){'),
                     src.indexOf('function mateV4ProductionHeartbeat_'));
 assert.match(capture,/if\(!mateV4GenuineListingInterest_\(body\)\)continue;/);
 assert.match(ack,/if\(!mateV4GenuineListingInterest_\(own\)\)/);
 assert.match(capture,/prior\.has\(id\)/);
 assert.match(ack,/申請案内送信結果要確認/);
 assert.match(ack,/MailApp\.getRemainingDailyQuota\(\)<1/);
});

test('intent decisions reject quoted campaign, refusals and generic thanks',()=>{
 for(const line of ['承知しました。','ありがとうございます。','参考までにご連絡いたしました。',
                     '掲載希望ですが配信停止してください。','掲載は不要です。',
                     '掲載を希望しないので連絡を止めてください。']){
   assert.equal(interested(line),false,line);
 }
 for(const line of ['掲載希望です。','掲載を前向きに検討したいと考えております。',
                    '掲載を検討しております。','掲載について質問があります。']){
   assert.equal(interested(line),true,line);
 }
});

test('fake image addresses in HTML asset names can never be outreach recipients',()=>{
 assert.equal(mail('mail@2x.png'),'');
 assert.equal(mail('support@banner.svg'),'');
 assert.equal(mail('info@sample-school.jp'),'info@sample-school.jp');
});
