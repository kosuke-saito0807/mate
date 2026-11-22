import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const root=new URL('../',import.meta.url);
const script=fs.readFileSync(new URL('assets/mate-reference-claim.js',root),'utf8');
const records=JSON.parse(fs.readFileSync(new URL('editorial-play.json',root),'utf8'));
function simulate({hash='#claim=editorial-muumuu',service='PLAY',preEdited=false,approved=false}={}){
  const company={value:preEdited?'申請者が入力した名称':''};
  const site={value:preEdited?'https://applicant.example.jp/':''};
  const notice={hidden:true,textContent:''},events=[],requests=[];
  const data=approved?[{...records[0],approved:true}]:records;
  const form={querySelector(sel){
    if(sel==='input[name="service"]')return{value:service};
    if(sel==='input[name="company"]')return company;
    if(sel==='input[name="website"]')return site;
    return null;
  }};
  const window={
    location:{hash},
    fetch(url,opt){requests.push({url,opt});return Promise.resolve({ok:true,json:()=>Promise.resolve(data)})},
    gtag(...args){events.push(args)}
  };
  const document={querySelector(sel){if(sel==='form[data-mate-direct-listing="true"]')return form;
    if(sel==='[data-mate-claim-notice]')return notice;return null}};
  vm.runInNewContext(script,{window,document,URL,console},{timeout:1000});
  return new Promise(resolve=>setImmediate(()=>resolve({company,site,notice,events,requests})));
}
test('PLAY public references contain 115 explicitly unapproved entries with safe identifiers',()=>{
  assert.equal(records.length,115);
  for(const x of records){
    assert.match(x.id,/^editorial-[a-z0-9_-]{2,80}$/);
    assert.equal(x.editorial,true);
    assert.equal(x.approved,false);
    assert.match(x.url,/^https:\/\//);
    assert.ok(x.name.length>0);
    assert.deepEqual(Object.keys(x).sort(),['approved','editorial','id','name','region','url'].sort());
  }
});
test('PLAY hash prefills only blank name and website from same-origin dataset',async()=>{
  const x=await simulate();
  assert.equal(x.company.value,records[0].name);
  assert.equal(x.site.value,records[0].url);
  assert.equal(x.notice.hidden,false);
  assert.match(x.notice.textContent,/本人確認や掲載承認ではありません/);
  assert.equal(x.requests.length,1);
  assert.equal(x.requests[0].url,'editorial-play.json');
  assert.equal(x.requests[0].opt.credentials,'same-origin');
  assert.equal(x.events.length,1);
  assert.equal(x.events[0][1],'mate_editorial_claim_prefill');
  assert.equal(x.events[0][2].service,'PLAY');
  assert.equal(JSON.stringify(x.events).includes(records[0].name),false);
});
test('PLAY prefill never overwrites operator input or pretends to approve',async()=>{
  const x=await simulate({preEdited:true});
  assert.equal(x.company.value,'申請者が入力した名称');
  assert.equal(x.site.value,'https://applicant.example.jp/');
  const y=await simulate({approved:true});
  assert.equal(y.company.value,'');
  assert.equal(y.site.value,'');
  assert.equal(y.notice.hidden,true);
});
test('Invalid or absent claims never cause network fetch, submission or approval',async()=>{
  for(const hash of ['#claim=../../', '#claim=editorial-unknown','#foo=editorial-muumuu','']){
    const x=await simulate({hash});
    assert.equal(x.company.value,'');
    assert.equal(x.notice.hidden,true);
    if(hash==='#claim=../../'||hash==='#foo=editorial-muumuu'||hash==='')assert.equal(x.requests.length,0);
  }
  for(const unsafe of ['form.submit(','.click(', 'GmailApp.', 'sendEmail(','fetch(website'])
    assert.ok(!script.includes(unsafe),unsafe);
});
