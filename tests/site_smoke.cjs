/* Headless smoke QA. External form POSTs intercepted and simulated locally; never send to external services. */
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
  // Real Turnstile rejects localhost (110200). Stub external JavaScript for
  // local rendering QA only; the live hostname enforces actual CAPTCHA.
  await page.route('https://challenges.cloudflare.com/turnstile/v0/api.js',
    route=>route.fulfill({status:200,contentType:'text/javascript',body:'/* local QA; no real Turnstile token */'}));
  await page.route('https://script.google.com/macros/s/**',route=>route.abort());
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
  await page.screenshot({path: SAVE + '/' + pathname.replaceAll('/','_').replace(/_$/,'home').replace(/[^a-zA-Z0-9_\-]/g,'_') + (mobile?'-mobile':'-desktop') + '.png',fullPage:true});
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
    assert.equal(await care.locator('#listing-contact').getAttribute('data-mate-direct-listing'),'true');
    assert.equal(await care.locator('#listing-contact button[type=submit]').isEnabled(),true);
    assert.match(await care.locator('#listing-contact').getAttribute('action'),/^https:\/\/script\.google\.com\/macros\/s\/.+\/exec$/);
    assert.equal(await care.locator('#listing-contact [name=privacy_agree]').count(),1);
    assert.equal(await care.locator('#listing-contact .cf-turnstile').count(),1);
    assert.equal(await care.locator('#listing-contact [name=company]').count(),1);
    // Business self-registration; never submit email from the browser test.
    await care.locator('#listing-contact [name=company]').fill('QA用の事業者');
    await care.locator('#listing-contact [name=website]').fill('https://example.org/');
    await care.locator('#listing-contact [name=region]').selectOption('北海道');
    await care.locator('#listing-contact [name=city]').fill('札幌市中央区');
    await care.locator('#listing-contact [name=category]').selectOption('ベビーシッター');
    await care.locator('#listing-contact [name=description]').fill('QA専用に作成した架空の事業者紹介文です。実際の掲載や送信は行いません。');
    await care.locator('#listing-contact [name=listing_content_checked_at]').fill('2026-10-23');
    await care.locator('#listing-contact [name=listing_permission]').check();
    const carePayload=await care.evaluate(()=>{
      const f=document.querySelector('#listing-contact');
      const ok=window.MATESelfService.populate(f);
      return {ok,payload:f.querySelector('[name=listing_payload_b64]').value};
    });
    assert.equal(carePayload.ok,true);
    const careData=JSON.parse(Buffer.from(carePayload.payload.split('__')[1],'base64').toString('utf8'));
    assert.equal(careData.service,'CARE');
    assert.equal(careData.region,'北海道');
    assert.equal(careData.description.includes('QA専用'),true);
    assert.equal(Object.hasOwn(careData,'email'),false);
    await care.close();

    // Only the unlinked internal QA page uses direct GAS while public forms
    // remain unchanged. Intercept BOTH CAPTCHA script and POST within Playwright:
    // no application, mail, external Sheet data or real challenge is sent.
    for(const service of ['CARE','PLAY']){
      const p=await browser.newPage({viewport:{width:390,height:844}});
      let captured=null;
      // Production QA page remains disabled; only a mocked, locally fulfilled
      // HTML copy is enabled inside this browser test. Never touch live GAS.
      await p.route(BASE+'/direct-intake-test-20261025.html', route=>{
        const html=fs.readFileSync('direct-intake-test-20261025.html','utf8');
        assert.ok(html.includes('Object.freeze({enabled:false,'),'Public QA must remain closed');
        return route.fulfill({status:200,contentType:'text/html',
          body:html.replace('Object.freeze({enabled:false,','Object.freeze({enabled:true,')});
      });
      await p.route('https://challenges.cloudflare.com/turnstile/v0/api.js',route=>
        route.fulfill({status:200,contentType:'text/javascript',
          body:'document.querySelector("#mateDirectQaForm").insertAdjacentHTML("beforeend",\'<input type="hidden" name="cf-turnstile-response" value="qa-mocked-token-value-0000000000000">\');'}));
      await p.route('https://script.google.com/macros/s/**',async route=>{
        assert.equal(route.request().method(),'POST');
        captured=Object.fromEntries(new URLSearchParams(route.request().postData()));
        await route.fulfill({status:200,contentType:'text/html',body:'<h1>Mock GAS accepted: local-only</h1>'});
      });
      const response=await p.goto(BASE+'/direct-intake-test-20261025.html',{waitUntil:'networkidle'});
      assert.equal(response.status(),200);
      await p.locator('[name=service]').selectOption(service);
      await p.locator('[name=listing_permission]').check();
      await p.locator('[name=privacy_agree]').check();
      await p.locator('[name="cf-turnstile-response"]').waitFor({state:'attached'});
      assert.equal(await p.locator('#mateDirectQaForm').evaluate(el=>el.checkValidity()),true);
      await p.locator('button[type=submit]').click();
      await p.getByText('Mock GAS accepted: local-only').waitFor();
      assert.ok(captured,'POST should have been intercepted');
      assert.equal(captured.service,service);
      assert.equal(captured.privacy_agree,'同意する');
      assert.ok(captured.submission_id.match(/^[a-f0-9-]{36}$/));
      assert.equal(captured['cf-turnstile-response'],'qa-mocked-token-value-0000000000000');
      assert.equal(captured.listing_permission,'内部テスト（一般公開・掲載承認は禁止）');
      assert.equal(captured.trial_referral_consent,undefined);
      assert.ok(captured.listing_payload_b64.startsWith('MATE_LISTING_V1__'));
      assert.ok(captured.description.includes('接続確認専用'));
      await p.close();
    }

    // Privacy-first CARE/PLAY family consultation: validate real browser input,
    // intercept POST inside the test process, never send to external FormSubmit.
    for (const service of ['CARE','PLAY']) {
      const uri=service==='PLAY'?'/consult.html?service=PLAY':'/consult.html?service=CARE';
      const family=await checkPage(browser,uri,true);
      const input=family.locator('#consultForm');
      assert.equal(await input.evaluate(f=>f.checkValidity()),false,'missing required email/consent');
      assert.equal(await family.locator('[name=guardianName]').getAttribute('required'),null);
      assert.equal(await family.locator('[name=phone]').getAttribute('required'),null);
      let captured=null;
      await family.route('https://formsubmit.co/ajax/kosodatemate@gmail.com', async route=>{
        captured=route.request().postDataJSON();
        await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({success:'true'})});
      });
      await family.locator('[name=email]').fill('qa@example.invalid');
      await family.locator('[name=privacy_agree]').check();
      assert.equal(await input.evaluate(f=>f.checkValidity()),true);
      await family.locator('#submitBtn').click();
      await family.locator('#formStatus.success').waitFor();
      assert.equal(captured.service,service);
      assert.equal(captured.email,'qa@example.invalid');
      assert.ok(!captured.guardianName && !captured.phone,'optional personal fields remain empty');
      assert.equal(captured.referral_interest,undefined,'no automatic referral permission');
      assert.ok((await family.locator('#formStatus').innerText()).includes('受け付けました'));
      await family.close();
    }

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

    // PLAY's public CMS remains separate, but owners can self-register through MATE.
    const play=await checkPage(browser,'/play-listing.html');
    assert.equal(await play.locator('#listing-contact [name=service]').inputValue(),'PLAY');
    assert.equal(await play.locator('#listing-contact').getAttribute('data-mate-direct-listing'),'true');
    assert.equal(await play.locator('#listing-contact button[type=submit]').isEnabled(),true);
    assert.match(await play.locator('#listing-contact').getAttribute('action'),/^https:\/\/script\.google\.com\/macros\/s\/.+\/exec$/);
    assert.equal(await play.locator('#listing-contact [name=privacy_agree]').count(),1);
    assert.equal(await play.locator('#listing-contact .cf-turnstile').count(),1);
    await play.locator('#listing-contact [name=company]').fill('QA親子体験');
    await play.locator('#listing-contact [name=website]').fill('https://example.org/');
    await play.locator('#listing-contact [name=region]').selectOption('福岡県');
    await play.locator('#listing-contact [name=city]').fill('福岡市博多区');
    await play.locator('#listing-contact [name=category]').selectOption('科学・学び');
    await play.locator('#listing-contact [name=ages]').selectOption('小学生');
    await play.locator('#listing-contact [name=description]').fill('QA専用の家族向け体験プログラムです。実際の送信・公開は行われないテストです。');
    await play.locator('#listing-contact [name=listing_content_checked_at]').fill('2026-10-23');
    await play.locator('#listing-contact [name=listing_permission]').check();
    const playPayload=await play.evaluate(()=>{
      const f=document.querySelector('#listing-contact');
      return {ok:window.MATESelfService.populate(f),payload:f.querySelector('[name=listing_payload_b64]').value};
    });
    assert.equal(playPayload.ok,true);
    assert.equal(JSON.parse(Buffer.from(playPayload.payload.split('__')[1],'base64').toString('utf8')).service,'PLAY');
    assert.equal(await play.locator('#listing-contact').getAttribute('data-thanks'),null, 'GAS shows its own receipt instead of FormSubmit redirect');
    await play.close();

    const old = await browser.newPage();
    await old.goto(BASE + '/spark/compare.html');
    await old.waitForURL(/\/spark\/$/, {timeout:10000});
    await old.close();

    // Simulate the production origin and approved data WITHOUT contacting Firebase
    // or delivering a form. Tests both closed and operator-enabled trial states.
    async function simulatedProduction(trialEnabled) {
      const p=await browser.newPage({viewport:{width:1366,height:768}});
      await p.route('https://formsubmit.co/**', route => route.abort());
      // Prevent a real challenge from rendering inside the simulated Firebase
      // origin. The server-side CAPTCHA is validated by GAS separately.
      await p.route('https://challenges.cloudflare.com/turnstile/v0/api.js',
        route=>route.fulfill({status:200,contentType:'text/javascript',body:'/* SPARK browser mock: no external Turnstile challenge */'}));
      await p.route('https://script.google.com/macros/s/**',route=>route.abort());
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
          contentType:name.endsWith('.svg')?'image/svg+xml':name.endsWith('.js')?'text/javascript':name.endsWith('.png')?'image/png':'text/html',
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
      assert.match(await p.locator('#partnerForm').getAttribute('action'),/^https:\/\/script\.google\.com\/macros\/s\/.+\/exec$/);
      assert.equal(await p.locator('#partnerForm').getAttribute('data-mate-direct-listing'),'true');
      assert.equal(await p.locator('#partnerForm button[type=submit]').isEnabled(),true);
      assert.equal(await p.locator('#partnerForm .cf-turnstile').count(),1);
      assert.equal(await p.locator('#partnerForm [name=privacy_agree]').count(),1);
      assert.equal(await p.locator('#partnerForm').evaluate(x=>x.checkValidity()),false);
      // Test independent SPARK self-service data generation on the simulated Firebase host.
      await p.locator('#partnerForm [name=company]').fill('QA架空教室');
      await p.locator('#partnerForm [name=website]').fill('https://example.org/');
      await p.locator('#partnerForm [name=region]').selectOption('大阪府');
      await p.locator('#partnerForm [name=city]').fill('大阪市北区');
      await p.locator('#partnerForm [name=category]').selectOption('音楽');
      await p.locator('#partnerForm [name=ages]').selectOption('小学生');
      await p.locator('#partnerForm [name=description]').fill('子どもの興味を深めることを目指す、QA専用の架空の教室紹介文です。');
      await p.locator('#partnerForm [name=listing_content_checked_at]').fill('2026-10-23');
      await p.locator('#partnerForm [name=listing_permission]').check();
      const pPayload=await p.evaluate(()=>{
        const f=document.querySelector('#partnerForm');
        return {ok:window.MATESelfService.populate(f),payload:f.querySelector('[name=listing_payload_b64]').value};
      });
      assert.equal(pPayload.ok,true);
      assert.equal(JSON.parse(Buffer.from(pPayload.payload.split('__')[1],'base64').toString('utf8')).region,'大阪府');
      // Never submit any form. The mailbox has not been verified.
      await p.close();
    }
    await simulatedProduction(false);
    await simulatedProduction(true);

    for (const pathname of ['/','/contact.html','/spark/','/spark/partners.html']) {
      const page=await checkPage(browser,pathname,true);
      if(pathname==='/spark/'){
        await page.waitForFunction(()=>document.querySelector('#status')?.textContent.includes('掲載準備中'));
        assert.equal(await page.locator('#cards article.card').count(),0);
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
