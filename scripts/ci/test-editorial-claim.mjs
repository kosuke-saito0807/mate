import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

async function run({service='CARE', hash='#claim=editorial-foo', rows=[], initialCompany='', initialSite=''}) {
  const filepath = service === 'CARE' ? 'assets/mate-reference-claim.js' :
    'spark/assets/mate-reference-claim.js';
  const code = readFileSync(filepath, 'utf8');
  const events = [];
  const requests = [];
  const fields = {
    company: {value:initialCompany}, website:{value:initialSite},
    service:{value:service}
  };
  const form = {querySelector(selector) {
    const match = selector.match(/^input\[name="(service|company|website)"\]$/);
    return match ? fields[match[1]] : null;
  }};
  const notice = {hidden:true, textContent:''};
  const context = {
    window: {
      location:{hash},
      fetch(path,opts) {
        requests.push({path,opts:JSON.parse(JSON.stringify(opts))});
        return Promise.resolve({ok:true,json:()=>Promise.resolve(rows)});
      },
      gtag(...args) {events.push(JSON.parse(JSON.stringify(args)));}
    },
    document:{
      querySelector(selector) {
        if (selector === 'form[data-mate-direct-listing="true"]') return form;
        if (selector === '[data-mate-claim-notice]') return notice;
        return null;
      }
    },
    URL,
  };
  vm.runInNewContext(code, context, {filename:filepath,timeout:2000});
  await new Promise(resolve=>setImmediate(resolve));
  return {fields,notice,events,requests,code};
}

test('CARE editorial record only prefills public company and website with explicit warning', async () => {
  const x=await run({rows:[{
    id:'editorial-foo',name:'テスト事業者',url:'https://example.co.jp/service',
    editorial:true,approved:false
  }]});
  assert.equal(x.fields.company.value,'テスト事業者');
  assert.equal(x.fields.website.value,'https://example.co.jp/service');
  assert.equal(x.notice.hidden,false);
  assert.match(x.notice.textContent,/本人確認や掲載承認ではありません/);
  assert.deepEqual(x.requests,[{path:'editorial-care.json',
    opts:{cache:'no-store',credentials:'same-origin'}}]);
  assert.deepEqual(x.events,[['event','mate_editorial_claim_prefill',{
    service:'CARE',reference_type:'unapproved_editorial'
  }]]);
});

test('SPARK editorial input helps only when existing form fields are empty', async () => {
  const x=await run({service:'SPARK',hash:'#claim=editorial-bar',
    initialCompany:'手入力済み',
    rows:[{id:'editorial-bar',name:'公開参考教室',
      url:'https://school.example.jp/',editorial:true,approved:false}]});
  assert.equal(x.fields.company.value,'手入力済み');
  assert.equal(x.fields.website.value,'https://school.example.jp/');
  assert.equal(x.requests[0].path,'editorial-schools.json');
});

test('approved listings and nonexistent references never automatically become a claim', async () => {
  for(const rows of [
    [{id:'editorial-foo',name:'正式掲載',url:'https://approved.co.jp/',editorial:false,approved:true}],
    [{id:'editorial-other',name:'無関係',url:'https://other.co.jp/',editorial:true,approved:false}]
  ]) {
    const x=await run({rows});
    assert.equal(x.fields.company.value,'');
    assert.equal(x.notice.hidden,true);
    assert.equal(x.events.length,0);
  }
});

test('invalid hashes never fetch even first-party source', async () => {
  for(const hash of ['#claim=../../evil','#claim=partner-1',
    '#claim=editorial-x%2F', '#claim=editorial-!','']) {
    const x=await run({hash});
    assert.equal(x.requests.length,0,hash);
    assert.equal(x.events.length,0,hash);
  }
});

test('invalid provider URL and overlong name are never inserted', async () => {
  for(const row of [
    {name:'公開事業者',url:'http://insecure.example.jp/'},
    {name:'A'.repeat(165),url:'https://safe.example.jp/'},
    {name:'公開事業者',url:'https://person:secret@safe.example.jp/'}
  ]) {
    const x=await run({rows:[{id:'editorial-foo',editorial:true,approved:false,...row}]});
    assert.equal(x.fields.website.value,'');
    assert.equal(x.notice.hidden,true);
  }
});

test('claim script has no form submits, storage, cross-site requests or payload collection', async () => {
  for(const service of ['CARE','SPARK']) {
    const x=await run({service});
    for(const forbidden of ['.submit(','.requestSubmit(', 'sendBeacon', 'localStorage',
      'sessionStorage','FormData(', 'XMLHttpRequest','location.href=']) {
      assert.equal(x.code.includes(forbidden),false,service+' forbidden '+forbidden);
    }
    assert.equal(x.events.length,0);
  }
});
