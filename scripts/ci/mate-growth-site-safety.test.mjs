import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const source=fs.readFileSync(path.resolve(import.meta.dirname,'../mate_auto_ops_v4.gs'),'utf8');
const first=source.indexOf('function mateV4Host_(');
const last=source.indexOf('function mateV4SameBusinessHost_(',first);
assert.ok(first>0&&last>first,'URL parsing functions must remain extractable');
const fn=new Function(source.slice(first,last)+'\nreturn {mateV4Host_,mateV4CandidateHttps_};')();
test('imports plain www and http business URLs only as HTTPS discovery candidates',()=>{
  assert.equal(fn.mateV4CandidateHttps_('http://school.example.jp/classes'),'https://school.example.jp/classes');
  assert.equal(fn.mateV4CandidateHttps_('www.school.example.jp'),'https://www.school.example.jp');
  assert.equal(fn.mateV4CandidateHttps_('https://school.example.jp/contact'),'https://school.example.jp/contact');
});
test('rejects local/private numeric IP and malformed address destinations',()=>{
  for(const value of ['http://127.0.0.1/', 'http://169.254.169.254/latest',
    'https://10.0.0.1', 'https://metadata.google.internal',
    'https://evil.local','https://school.example.jp:8080',
    'javascript:alert(1)','https://school.example.jp @invalid.tld']) {
    assert.equal(fn.mateV4CandidateHttps_(value),'',value);
  }
});
test('candidate normalization is not outreach consent or verified HTTPS availability',()=>{
  const normalized=fn.mateV4CandidateHttps_('http://nonexistent-business.example.jp/');
  assert.equal(normalized,'https://nonexistent-business.example.jp/');
  assert.equal(fn.mateV4Host_(normalized),'nonexistent-business.example.jp');
});
