import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const source=fs.readFileSync(path.resolve(import.meta.dirname,'../mate_auto_ops_v4.gs'),'utf8');
const from=source.indexOf('function mateV4SendOutreach(){');
const until=source.indexOf('function mateV4PrepareReviewDrafts(){',from);
assert.ok(from>=0&&until>from);
const send=source.slice(from,until);

test('low-friction interest reply never becomes an automatic listing approval',()=>{
 assert.match(send,/「掲載希望」とご返信/);
 assert.match(send,/ご返信だけで掲載が確定するものではありません/);
 assert.match(send,/申請内容とご担当者様の権限を確認/);
 assert.match(send,/配信停止/);
});
test('conversion copy retains service-specific URLs and sender legal identity',()=>{
 for(const url of ['care.kosodatemate.jp/contact.html',
  'spark.kosodatemate.jp/partners.html','care.kosodatemate.jp/play-listing.html']){
  assert.ok(send.includes(url),url);
 }
 assert.ok(send.includes('送信責任主体（正式名称）'));
 assert.ok(send.includes('MATE_AUTO_SEND_LEGAL_REVIEWED'));
 assert.ok(send.includes('sent+already>=cap'));
});
