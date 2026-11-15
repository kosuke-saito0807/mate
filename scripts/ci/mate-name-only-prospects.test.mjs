import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const source=fs.readFileSync(path.resolve(import.meta.dirname,'../mate_auto_ops_v4.gs'),'utf8');
const start=source.indexOf('function mateV4NameOnlyKey_(');
const end=source.indexOf('function mateV4CollectLeads(){',start);
assert.ok(start>0&&end>start);
const added=[];
const mocks={
  Utilities:{DigestAlgorithm:{SHA_256:'sha256'},computeDigest:(_type,text)=>
    [...new TextEncoder().encode(text)].concat(Array(14).fill(0)).slice(0,14)},
  mateV4OwnerBlocked_:()=>false,
  mateV4Https_:s=>/^https:\/\/[^\s/]+/i.test(String(s)),
  mateV4Jst_:()=> '2026-11-15 09:00:00',
  mateV4Append_:(_sheet,values)=>added.push(values)
};
const factory=new Function(...Object.keys(mocks),
  source.slice(start,end)+'\nreturn {mateV4StageNameOnly_,mateV4CandidateRegion_};');
const {mateV4StageNameOnly_,mateV4CandidateRegion_}=factory(...Object.values(mocks));

test('retains only prefecture/municipality from public address and not street-level detail',()=>{
  assert.equal(mateV4CandidateRegion_('奈良県生駒郡三郷町立野北3-12-7').includes('3-12-7'),false);
  assert.equal(mateV4CandidateRegion_('大阪府大阪市北区梅田1-2-3').includes('1-2-3'),false);
});
test('stores a non-sendable public facility name once',()=>{
  added.length=0;
  const seen=new Set();
  const prospect={name:'親子ものづくり体験工房',region:'東京都八王子市中町1-2-3'};
  assert.equal(mateV4StageNameOnly_({},seen,prospect,'PLAY','https://data.bodik.jp/dataset/approved.csv'),true);
  assert.equal(mateV4StageNameOnly_({},seen,prospect,'PLAY','https://data.bodik.jp/dataset/approved.csv'),false);
  assert.equal(added.length,1);
  assert.equal(added[0][6],'公式URL未確認');
  assert.equal(added[0][7].includes('送信禁止'),true);
  assert.equal(added[0].join(' ').includes('1-2-3'),false);
});
test('excludes personal-name-like rows, missing region and invalid sources',()=>{
  added.length=0;
  const examples=[
    [{name:'山田太郎',region:'東京都新宿区'},'https://data.bodik.jp/dataset/test.csv'],
    [{name:'ベビースクールA',region:''},'https://data.bodik.jp/dataset/test.csv'],
    [{name:'事業者ダミー',region:'東京都港区'},'https://data.bodik.jp/dataset/test.csv'],
    [{name:'実在の教室ABC',region:'大阪府大阪市'},'http://internal.local/list']
  ];
  for(const [lead,src] of examples)
    assert.equal(mateV4StageNameOnly_({},new Set(),lead,'SPARK',src),false);
  assert.equal(added.length,0);
});
