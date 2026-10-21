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

    const spark = await checkPage(browser,'/spark/');
    await spark.waitForFunction(() => document.querySelectorAll('#cards article.card').length===12);
    assert.ok((await spark.locator('#demoBanner').innerText()).includes('架空'));
    assert.equal(await spark.locator('#trial').isDisabled(),true);
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

    for (const pathname of ['/','/contact.html','/spark/','/spark/partners.html']) {
      const page=await checkPage(browser,pathname,true);
      if(pathname==='/spark/'){
        await page.waitForFunction(()=>document.querySelectorAll('#cards article.card').length===12);
        assert.equal(await page.locator('#trial').isDisabled(),true);
      }
      await page.close();
    }
    process.stdout.write('PASS: CARE/SPARK navigation, assets, filtering, favorites, comparison, mobile layouts, static intake safety.\n');
  } finally {
    await browser.close();
  }
}
main().catch(err => { console.error(err); process.exitCode=1; });
