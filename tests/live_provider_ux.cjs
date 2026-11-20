/* MATE production UX regression checks: GET/navigation and safe compare only.
 * Never sends a consultation, booking, form, or partner submission.
 */
'use strict';
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ROOT='artifacts/live-audit';
fs.mkdirSync(ROOT,{recursive:true});
const failures=[];
function check(label,actual,expected){
  assert.deepEqual(actual,expected,label);
  console.log('PASS MATE_PUBLIC_UX '+label+' '+JSON.stringify({actual}));
}
async function pageAt(browser,url,mobile=false){
  const page=await browser.newPage({
    viewport:mobile?{width:390,height:844}:{width:1366,height:820},
    isMobile:mobile,hasTouch:mobile,locale:'ja-JP'
  });
  await page.route(/https?:\/\/(?:www\.)?googletagmanager\.com\/.*/,r=>r.abort());
  await page.route(/https?:\/\/(?:www\.)?google-analytics\.com\/.*/,r=>r.abort());
  let response;
  for(let n=0;n<3;n++){
    response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:25000});
    if(response&&response.status()<500)break;
    if(n<2)await page.waitForTimeout(1800*(n+1));
  }
  check('page HTTP '+url,response?.status()??0,200);
  return page;
}
async function care(browser,mobile){
  const view=mobile?'mobile':'desktop';
  const url='https://care.kosodatemate.jp/provider.html?id=mate_care_3a29e1c1eb6f4f1b';
  const page=await pageAt(browser,url,mobile);
  try{
    await page.locator('#detail').waitFor({state:'visible',timeout:16000});
    await page.waitForFunction(()=>{
      const first=document.querySelector('#gallery img.photo-slide');
      return first&&first.complete&&first.naturalWidth>0;
    },undefined,{timeout:16000});
    const info=await page.evaluate(()=>{
      const photos=[...document.querySelectorAll('#gallery img.photo-slide')];
      const first=photos[0],facts=document.querySelector('#facts'),
        official=document.querySelector('#official');
      const frame=document.querySelector('#gallery').getBoundingClientRect();
      return {
        count:photos.length,name:document.querySelector('#name')?.textContent,
        firstWidth:first?.naturalWidth||0,
        firstVisible:!!first&&!first.hidden,
        objectFit:first?getComputedStyle(first).objectFit:'',
        galleryHeight:Math.round(frame.height),
        afterFacts:!!facts&&!!official&&Boolean(facts.compareDocumentPosition(official)&Node.DOCUMENT_POSITION_FOLLOWING),
        official:official?.href||'',
        extraSidebar:document.querySelectorAll('.detail>aside.panel').length,
        brandHidden:document.querySelector('#brand')?.hidden===true,
        horizontalOverflow:document.documentElement.scrollWidth>innerWidth+5
      };
    });
    check('CARE '+view+' Poppins four photos',info.count,4);
    assert.match(info.name||'',/ポピンズ/);
    assert.ok(info.firstWidth>0&&info.firstVisible,'Poppins lead photo loaded and visible');
    check('CARE '+view+' detail photos fit without head cropping',info.objectFit,'contain');
    assert.ok(info.galleryHeight>190,'Poppins gallery frame too short');
    check('CARE '+view+' official site after facts',info.afterFacts,true);
    check('CARE '+view+' official URL',info.official,'https://smartsitter.jp/');
    check('CARE '+view+' no right sidebar',info.extraSidebar,0);
    check('CARE '+view+' brand placeholder hidden',info.brandHidden,true);
    check('CARE '+view+' no overflow',info.horizontalOverflow,false);
    await page.locator('#next').click();
    await page.waitForFunction(()=>{
      const img=[...document.querySelectorAll('#gallery img.photo-slide')].find(x=>!x.hidden);
      return img&&img.alt.includes('2枚目')&&img.complete&&img.naturalWidth>0;
    },undefined,{timeout:14000});
    console.log('PASS MATE_PUBLIC_UX CARE '+view+' second Poppins photo loaded');
    await page.screenshot({path:path.join(ROOT,'poppins-provider-'+view+'.png'),fullPage:true,timeout:14000});
  }finally{await page.close();}
}
async function spark(browser){
  const op=await pageAt(browser,'https://spark.kosodatemate.jp/operator.html');
  try{
    await op.locator('h1').waitFor();
    assert.match(await op.locator('main').innerText(),/MATE SPARK/);
    check('SPARK operator canonical stays local',await op.locator('link[rel="canonical"]').getAttribute('href'),'https://spark.kosodatemate.jp/operator.html');
    assert.ok((await op.locator('main').innerText()).includes('NextEdu'),'SPARK local NextEdu operator information');
    check('SPARK operator home points to same site',await op.locator('a.operator-home').getAttribute('href'),'./');
    await op.locator('a.operator-home').click();
    check('SPARK home stays on SPARK domain',new URL(op.url()).origin,'https://spark.kosodatemate.jp');
    await op.locator('#cards .card').first().waitFor({state:'visible',timeout:17000});
    const listing=await op.evaluate(()=>{
      const total=Number((document.querySelector('#status')?.textContent||'').match(/^(\d+)/)?.[1]||0);
      return {total,shown:document.querySelectorAll('#cards .card').length,
        pager:!!document.querySelector('#sparkPager')&&!document.querySelector('#sparkPager').hidden};
    });
    assert.ok(listing.total>0,'SPARK listings did not load');
    check('SPARK initial page size',listing.shown,Math.min(24,listing.total));
    check('SPARK pagination when over 24',listing.pager,listing.total>24);
    await op.locator('#cards [data-pick]').first().click();
    await op.locator('#compare').click();
    check('SPARK compare dialog opens',await op.locator('#compareDialog').evaluate(el=>el.open),true);
    check('SPARK comparison consultation CTA available',await op.locator('#compareConsult').isEnabled(),true);
    assert.match(await op.locator('#compareConsult').innerText(),/まとめて無料相談/);
    await op.screenshot({path:path.join(ROOT,'spark-compare-dialog.png'),fullPage:true,timeout:14000});
  }finally{await op.close();}
}
async function play(browser){
  const op=await pageAt(browser,'https://play.kosodatemate.jp/operator');
  try{
    await op.locator('.operator-page h1').waitFor({state:'visible',timeout:17000});
    assert.match(await op.locator('.operator-page h1').innerText(),/MATE PLAY/);
    check('PLAY operator page stays local',new URL(op.url()).origin,'https://play.kosodatemate.jp');
    check('PLAY operator home is local',await op.locator('.operator-page-nav a').getAttribute('href'),'/');
    await op.locator('.operator-page-nav a').click();
    check('PLAY home origin',new URL(op.url()).origin,'https://play.kosodatemate.jp');
    await op.locator('.school-grid .school-card').first().waitFor({state:'visible',timeout:17000});
    const listing=await op.evaluate(()=>{
      const total=Number((document.querySelector('.results-heading strong')?.textContent||'').trim());
      return {total,shown:document.querySelectorAll('.school-grid .school-card').length,
        pager:!!document.querySelector('.play-list-pager')};
    });
    assert.ok(listing.total>0,'PLAY listings did not load');
    check('PLAY initial page size',listing.shown,Math.min(24,listing.total));
    check('PLAY pagination when over 24',listing.pager,listing.total>24);
    await op.screenshot({path:path.join(ROOT,'play-24-cards.png'),fullPage:true,timeout:14000});
  }finally{await op.close();}
}
(async()=>{
  const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  for(const [label,fn] of [
    ['CARE desktop',()=>care(browser,false)],
    ['CARE mobile',()=>care(browser,true)],
    ['SPARK',()=>spark(browser)],
    ['PLAY',()=>play(browser)]
  ]){
    try{await fn();}
    catch(e){const message=label+': '+String(e.message||e).slice(0,350);
      failures.push(message);console.error('FAIL MATE_PUBLIC_UX '+message);}
  }
  await browser.close();
  console.log('MATE_PUBLIC_UX_SUMMARY '+JSON.stringify({checked:4,pass:4-failures.length,fail:failures.length,failures}));
  if(failures.length)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1});
