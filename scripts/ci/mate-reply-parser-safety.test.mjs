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
test('fake image addresses in HTML asset names can never be outreach recipients',()=>{
 assert.equal(mail('mail@2x.png'),'');
 assert.equal(mail('support@banner.svg'),'');
 assert.equal(mail('info@sample-school.jp'),'info@sample-school.jp');
});
