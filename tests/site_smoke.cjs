/* Headless smoke QA. Local static hosting only. Absolutely no form submissions. */
const { chromium } = require('playwright');
const fs = require('node:fs');
const assert = require('node:assert/strict');

const BASE = 'http://127.0.0.1:8765';
const SAVE = 'artifacts/site-smoke';
fs.mkdirSync(SAVE, {recursive: true});

async function checkPage(browser, pathname, mobile=false) {
  const page = await browser.newPage({
    viewport: mobile ? {width: 390, height: 844} : {width: 1366, height: 820},
    deviceScaleFactor: 1,
    isMobile: mobile
  });
  // Never deliver real mail or transmit test data outside localhost.
  await page.route(/https?:\/\/(?:www\.)?formsubmit\.co\/.*/, route => route.abort());
  await page.route(/https?:\/\/www\.googletagmanager\.com\/.*/, route => route.abort());
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));
  const response = await page.goto(BASE + pathname, {waitUntil: 'networkidle'});
  assert.equal(response.status(), 200, pathname + ' should load');
  const maxWidth = await page.evaluate(() => ({
    width: innerWidth,
    scroll: document.documentElement.scrollWidth,
    body: document.body.scrollWidth
  }));
  assert.ok(maxWidth.scroll <= maxWidth.width + 4,
    pathname + (mobile ? ' mobile' : ' desktop') + ' horizontal overflow: ' + JSON.stringify(maxWidth));
  await page.screenshot({path: SAVE + '/' + pathname.replaceAll('/','_').replace(/_$/,'home') + (mobile?'-mobile':'-desktop') + '.png',fullPage:true});
  assert.deepEqual(errors,[],pathname+' runtime page errors');
  return page;
}
async function main() {
  const browser = await chromium.launch({headless:true, args:['--no-sandbox']});
  try {
    let care = await checkPage(browser,'/');
    await care.locator('#results-count').waitFor();
    assert.equal(await care.locator('#results article.result').count(),0);
    assert.ok((await care.locator('#care-data-status').innerText()).includes('掲載'));
    assert.ok((await care.locator('a[href="https://mate-spark.web.app/"]').count())>0);
    await care.locator('#q').fill('存在しないシッター');
    await care.locator('#sort').selectOption('name');
    await care.close();

    care = await checkPage(browser,'/contact.html');
    assert.ok((await care.locator('#listing-contact').count())===1);
    assert.equal(await care.locator('#listing-contact [name=company]').count(),1);
    await care.close();

    let spark = await checkPage(browser,'/spark/');
    await spark.waitForFunction(() => document.querySelector('#status')?.textContent.includes('掲載準備中'));
    assert.equal(await spark.locator('#cards article.card').count(),0);
    assert.ok((await spark.locator('#demoBanner').innerText()).includes('掲載準備中'));
    assert.ok(await spark.locator('a[href="?demo=1#discover"]').count()>0);
    await spark.close();
    spark = await checkPage(browser,'/spark/?demo=1');
    await spark.waitForFunction(() => document.querySelectorAll('#cards article.card').length===12);
    assert.ok((await spark.locator('#demoBanner').innerText()).includes('架空'));
    assert.equal(await spark.locator('#trial').isDisabled(),true);
    assert.equal(await spark.locator('#selectionBar').isHidden(),true);
    await spark.locator('#region').selectOption('東京都');
    assert.equal(await spark.locator('#cards article.card').count(),3);
    await spark.locator('#reset').click();
    assert.equal(await spark.locator('#cards article.card').count(),12);
    await spark.locator('#cards [data-detail]').first().click();
    assert.equal(await spark.locator('#detailDialog').evaluate(x=>x.open),true);
    await spark.locator('#closeDetail').click();
    await spark.locator('#cards [data-fav]').first().click();
    await spark.locator('#favoriteOnly').click();
    assert.equal(await spark.locator('#cards article.card').count(),1);
    await spark.locator('#favoriteOnly').click();
    await spark.locator('#cards [data-pick]').first().click();
    assert.equal(await spark.locator('#selectionBar').isVisible(),true);
    assert.equal(await spark.locator('#compare').isEnabled(),true);
    await spark.locator('#compare').click();
    assert.equal(await spark.locator('#compareDialog').evaluate(x=>x.open),true);
    await spark.locator('#closeCompare').click();
    assert.equal(await spark.locator('#trial').isDisabled(),true);
    await spark.close();

    const partner = await checkPage(browser,'/spark/partners.html');
    // Free production-only form remains hidden on localhost / GitHub Pages.
    assert.equal(await partner.locator('#partnerForm').isHidden(),true);
    await partner.close();

    for (const pathname of ['/spark/privacy.html','/spark/terms.html','/spark/disclaimer.html','/spark/operator.html','/operator.html','/privacy.html']) {
      const page = await checkPage(browser,pathname);
      await page.close();
    }

    const old = await browser.newPage();
    await old.goto(BASE + '/spark/compare.html');
    await old.waitForURL(/\/spark\/$/, {timeout:10000});
    await old.close();

    // Simulate the production origin and approved data WITHOUT contacting Firebase
    // or delivering a form. Tests both closed and operator-enabled trial states.
    async function simulatedProduction(trialEnabled) {
      const p=await browser.newPage({viewport:{width:1366,height:768}});
      await p.route('https://formsubmit.co/**', route => route.abort());
      const fakeSchool={
        id:'fake-approved-test-only', name:'QA掲載許諾済みダミー教室', region:'東京都',
        area:'文京区', station:'千石駅', category:'プログラミング',
        ages:['小学生'], ageMin:6, ageMax:12, monthlyPrice:8000,
        weekdays:['火','土'], description:'QA用の架空データ（本番公開しない）',
        url:'https://example.org/', approved:true, acceptsTrial:true,
        demo:false
      };
      await p.route('https://mate-spark.web.app/**', async route=>{
        const req=route.request();
        if(req.method()!=='GET') return route.abort();
        const u=new URL(req.url());
        if(u.pathname==='/schools.json')return route.fulfill({
          contentType:'application/json',body:JSON.stringify([fakeSchool])
        });
        if(u.pathname==='/config.json')return route.fulfill({
          contentType:'application/json',body:JSON.stringify({
            applyEnabled:false,trialIntakeEnabled:trialEnabled
          })
        });
        const path=require('node:path');
        let name=decodeURIComponent(u.pathname);
        if(name==='/')name='/index.html';
        const file=path.resolve('spark', '.'+name);
        if(!file.startsWith(path.resolve('spark')+path.sep)||!fs.existsSync(file)){
          return route.fulfill({status:404,body:'Not found'});
        }
        return route.fulfill({
          contentType:name.endsWith('.svg')?'image/svg+xml':'text/html',
          body:fs.readFileSync(file)
        });
      });
      const pageResponse=await p.goto('https://mate-spark.web.app/',{waitUntil:'networkidle'});
      assert.equal(pageResponse.status(),200);
      await p.waitForFunction(()=>document.querySelectorAll('#cards article.card').length===1);
      await p.locator('[data-pick]').first().click();
      assert.equal(await p.locator('#trial').isEnabled(),trialEnabled,
        'Trial gate must require explicit owner acceptance');
      if(trialEnabled){
        await p.locator('#trial').click();
        assert.equal(await p.locator('#trialDialog').evaluate(x=>x.open),true);
        assert.equal(await p.locator('#trialForm').isHidden(),false);
        assert.ok((await p.locator('#trialForm').getAttribute('action')).includes('formsubmit.co'));
        await p.locator('#cancelTrial').click();
      }
      // The school-owner listing intake should appear on approved Firebase hosts.
      await p.goto('https://mate-spark.web.app/partners.html',{waitUntil:'networkidle'});
      assert.equal(await p.locator('#partnerForm').isHidden(),false);
      assert.ok((await p.locator('#partnerForm').getAttribute('action')).includes('formsubmit.co'));
      assert.equal(await p.locator('#partnerForm').evaluate(x=>x.checkValidity()),false);
      // Never submit any form. The mailbox has not been verified.
      await p.close();
    }
    await simulatedProduction(false);
    await simulatedProduction(true);

    for (const pathname of ['/','/contact.html','/spark/','/spark/partners.html']) {
      const page=await checkPage(browser,pathname,true);
      if(pathname==='/spark/'){
        await page.waitForFunction(()=>document.querySelectorAll('#cards article.card').length===12);
        assert.equal(await page.locator('#trial').isDisabled(),true);
        assert.equal(await page.locator('#selectionBar').isHidden(),true);
        assert.equal(await page.locator('.nav a[href="#mission"]').isVisible(),true);
      }
      await page.close();
    }
    // Public-site read-only probes. Sources outside this repo may block automation.
    // Navigation and screenshots only; never submit forms or send emails.
    const liveSites=[
      ['care-live','https://kosuke-saito0807.github.io/mate/'],
      ['spark-live','https://mate-spark.web.app/'],
      ['spark-original','https://naraico.kosuke-saito0807.chatgpt.site/'],
      ['play-original','https://mate-play.kosuke-saito0807.chatgpt.site/']
    ];
    for (const [name,url] of liveSites) {
      const p=await browser.newPage({viewport:{width:1366,height:820}});
      await p.route(/https?:\/\/(?:www\.)?formsubmit\.co\/.*/,route=>route.abort());
      try{
        const resp=await p.goto(url,{waitUntil:'domcontentloaded',timeout:22000});
        await p.waitForTimeout(2100);
        const details={
          label:name,status:resp?.status()??0,actual:p.url(),
          title:(await p.title()).slice(0,100),
          text:(await p.locator('body').innerText()).slice(0,300).replace(/\n/g,' ')
        };
        await p.screenshot({path:SAVE+'/live-'+name+'.png',fullPage:true,timeout:12000});
        console.log('LIVE_AUDIT '+JSON.stringify(details));
        if(name==='spark-original'||name==='play-original'){
          const media=await p.evaluate(()=>{
            const safeSrc=(s)=>{try{const u=new URL(s,location.href);return u.origin+u.pathname}catch{return String(s).slice(0,150)}};
            const imgs=[...document.images].map(x=>({
              alt:(x.alt||'').slice(0,90),width:x.naturalWidth,height:x.naturalHeight,
              url:safeSrc(x.currentSrc||x.src)
            })).filter(x=>x.width>70&&x.height>50).slice(0,25);
            const backs=[...document.querySelectorAll('section,header,div')].map(x=>{
              const bg=getComputedStyle(x).backgroundImage;
              if(!bg||bg==='none'||x.clientWidth<290||x.clientHeight<110)return null;
              return {className:String(x.className).slice(0,65),id:x.id,
                width:x.clientWidth,height:x.clientHeight,
                background:bg.replace(/url\(["']?(.*?)["']?\)/g,(all,url)=>'url('+safeSrc(url)+')').slice(0,350)};
            }).filter(Boolean).slice(0,18);
            return {images:imgs,backgrounds:backs};
          });
          console.log('MEDIA_AUDIT '+name+' '+JSON.stringify(media).slice(0,8000));
        }
      }catch(e){
        console.log('LIVE_AUDIT_FAILED '+name+' '+String(e.message).slice(0,250));
      }finally{await p.close();}
    }
    process.stdout.write('PASS: CARE/SPARK navigation, assets, filtering, favorites, comparison, mobile layouts, static intake safety.\n');
  } finally {
    await browser.close();
  }
}
main().catch(err => { console.error(err); process.exitCode=1; });
