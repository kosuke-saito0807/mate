/* Read-only public QA for all three published MATE services.
   Run with Playwright; deliberately never submit forms or log personal data.
*/
const {chromium}=require('playwright');
const fs=require('node:fs');
const assert=require('node:assert/strict');
const path=require('node:path');
const ORIGINS={
  CARE:'https://care.kosodatemate.jp/',
  SPARK:'https://spark.kosodatemate.jp/',
  PLAY:'https://play.kosodatemate.jp/'
};
// The original ChatGPT Sites PLAY remains live for legacy features; this audit must
// examine the separate production Firebase release and must NOT switch user links.
const LEGACY_PLAY_ORIGIN='https://mate-play.kosuke-saito0807.chatgpt.site/';
// PLAY intentionally links to the shared CARE-hosted intake while its own CMS is migrated.
// This exact allowlist prevents silently accepting other cross-domain destinations.
const SHARED_PLAY_LISTING='https://care.kosodatemate.jp/play-listing.html';
const EXPECTED_TITLES={
  CARE:'ベビーシッター・訪問保育を探す｜MATE CARE',
  SPARK:'子どもの習い事・教室を探す｜MATE SPARK',
  PLAY:'親子のお出かけ・体験を探す｜MATE PLAY'
};
const PREFECTURES='北海道 青森県 岩手県 宮城県 秋田県 山形県 福島県 茨城県 栃木県 群馬県 埼玉県 千葉県 東京都 神奈川県 新潟県 富山県 石川県 福井県 山梨県 長野県 岐阜県 静岡県 愛知県 三重県 滋賀県 京都府 大阪府 兵庫県 奈良県 和歌山県 鳥取県 島根県 岡山県 広島県 山口県 徳島県 香川県 愛媛県 高知県 福岡県 佐賀県 長崎県 熊本県 大分県 宮崎県 鹿児島県 沖縄県'.split(' ');
const TARGET='artifacts/live-audit';fs.mkdirSync(TARGET,{recursive:true});
const results=[];
async function audit(browser,service,mobile){
  const view=mobile?'mobile':'desktop';
  const page=await browser.newPage({viewport:mobile?{width:390,height:844}:{width:1366,height:820},deviceScaleFactor:1,isMobile:mobile,locale:'ja-JP'});
  const errors=[];
  const insecureRequests=[];
  page.on('pageerror',e=>errors.push(String(e.message).slice(0,130)));
  page.on('request',req=>{if(req.url().startsWith('http://'))insecureRequests.push(req.url().slice(0,180));});
  await page.route(/https?:\/\/(?:www\.)?formsubmit\.co\/.*/,route=>route.abort());
  await page.route(/https?:\/\/(?:www\.)?googletagmanager\.com\/.*/,route=>route.abort());
  await page.route(/https?:\/\/(?:www\.)?google-analytics\.com\/.*/,route=>route.abort());
  let result={service,view,ok:false,failures:[],warnings:[]};
  try{
    const response=await page.goto(ORIGINS[service],{waitUntil:'domcontentloaded',timeout:25000});
    result.http=response?.status()??0;result.url=page.url();result.title=(await page.title()).slice(0,120);
    result.secureContext=await page.evaluate(()=>window.isSecureContext);
    if(!result.secureContext)result.failures.push('Browser is not in a secure context');
    if(result.http!==200)result.failures.push('HTTP '+result.http);
    if(new URL(result.url).origin!==new URL(ORIGINS[service]).origin)
      result.failures.push('Unexpected redirect origin: '+new URL(result.url).origin);
    if(result.title!==EXPECTED_TITLES[service])
      result.failures.push('Homepage title mismatch: '+result.title);
    await page.waitForTimeout(2300);
    await page.screenshot({path:path.join(TARGET,service.toLowerCase()+'-'+view+'.png'),fullPage:true,timeout:14000});
    const data=await page.evaluate((prefs)=>{
      const t=(document.body?.innerText||'').slice(0,20000);
      const selects=[...document.querySelectorAll('select')].map(s=>({
        id:s.id,name:s.name,options:[...s.options].map(x=>x.textContent.trim()).slice(0,85),
        visible:!!(s.offsetWidth||s.offsetHeight||s.getClientRects().length)
      }));
      const allOptionText=selects.flatMap(x=>x.options);
      const matching=prefs.filter(p=>allOptionText.includes(p));
      const brokenImages=[...document.images].filter(im=>im.complete && im.naturalWidth===0)
        .map(im=>(im.getAttribute('alt')||im.getAttribute('src')||'').slice(0,90)).slice(0,12);
      const sameOriginLinks=[...document.querySelectorAll('a[href]')].map(a=>a.href)
        .filter(x=>{try{return new URL(x).origin===location.origin}catch{return false}})
        .filter(x=>!x.includes('#')&&!x.startsWith('javascript:')).slice(0,8);
      const forms=[...document.querySelectorAll('form')].map(f=>({id:f.id,action:f.getAttribute('action')||'',hidden:!f.getClientRects().length}));
      return {width:window.innerWidth,scrollWidth:document.documentElement.scrollWidth,
        images:document.images.length,brokenImages,formCount:forms.length,forms,
        selects:selects.map(x=>({id:x.id,name:x.name,options:x.options.length,visible:x.visible})),
        prefOptions:matching.length,hasNationwideText:t.includes('全国47都道府県'),
        obsoleteText:t.includes('1都3県'),
        nextEdu:t.includes('NextEdu'),contact:t.includes('kosodatemate@gmail.com'),
        legalLinks:[...document.querySelectorAll('a[href]')].map(a=>(a.innerText||'').trim())
          .filter(s=>/個人情報|プライバシー|利用規約|運営者情報|掲載条件/.test(s)).slice(0,15),
        sameOriginLinks:[...new Set(sameOriginLinks)],
        interactiveControls:document.querySelectorAll('button,select,input').length};
    },PREFECTURES);
    Object.assign(result,data);
    // Every service footer must use the custom-domain destination for the other two.
    const mateLinks=await page.evaluate(()=>[...document.querySelectorAll('footer a[href]')]
      .map(a=>({text:(a.textContent||'').trim(),href:a.href}))
      .filter(a=>/^MATE (?:CARE|SPARK|PLAY)/.test(a.text)));
    for(const [peer,origin] of Object.entries(ORIGINS)){
      if(peer===service)continue;
      if(!mateLinks.some(a=>a.text.startsWith('MATE '+peer)&&a.href.startsWith(origin)))
        result.failures.push('Old/missing footer link to '+peer+' on '+service);
    }
    if(data.scrollWidth>data.width+5)result.failures.push('横スクロール（'+data.scrollWidth+' > '+data.width+'）');
    if(data.brokenImages.length)result.failures.push('読み込み失敗画像 '+data.brokenImages.join(','));
    if(insecureRequests.length)result.failures.push('HTTP mixed-content requests '+insecureRequests.slice(0,5).join(','));
    if(errors.length)result.failures.push('JS例外 '+errors.join(' | '));
    if(data.obsoleteText)result.warnings.push('旧1都3県表記あり');
    // SPARK explicitly offers a 47-prefecture select. CARE/PLAY may use a
    // different search UI and should not be warned about missing footer copy.
    if(service==='SPARK'&&data.prefOptions!==47)
      result.warnings.push('SPARKの都道府県選択肢 '+data.prefOptions+'件（想定47）');
    if(!data.nextEdu||!data.contact)result.warnings.push('運営NextEdu・共通問合せの一部がトップ画面に見つからない');
    if(!data.legalLinks.length)result.warnings.push('プライバシー等への文字リンクなし');

    // Check listing CTA destination via GET only. This does not submit anything.
    const partner=await page.evaluate(()=>{
      const link=[...document.querySelectorAll('a[href]')].find(a=>
        /(?:教室|体験|施設|事業者)を掲載|掲載相談フォーム/.test((a.innerText||'').trim()));
      return link?{text:(link.innerText||'').trim().slice(0,60),url:link.href}:null;
    });
    if(partner){
      result.partnerLink=partner.text;
      try{
        const target=new URL(partner.url);
        const isOwnOrigin=target.origin===new URL(ORIGINS[service]).origin;
        const isApprovedPlayIntake=service==='PLAY'&&partner.url===SHARED_PLAY_LISTING;
        if(isOwnOrigin||isApprovedPlayIntake){
          const formPage=await browser.newPage({viewport:mobile?{width:390,height:844}:{width:1366,height:820},isMobile:mobile});
          await formPage.route(/https?:\/\/(?:www\.)?formsubmit\.co\/.*/,route=>route.abort());
          await formPage.route(/https?:\/\/(?:www\.)?googletagmanager\.com\/.*/,route=>route.abort());
          try{
            let r;
            for(let attempt=0;attempt<3;attempt++){
              r=await formPage.goto(partner.url,{waitUntil:'domcontentloaded',timeout:20000});
              if((r?.status()||0)<500)break;
              if(attempt<2)await formPage.waitForTimeout(1000*(attempt+1));
            }
            await formPage.waitForTimeout(1100);
            result.partnerPage={http:r?.status()||0,sharedPlayIntake:isApprovedPlayIntake,forms:await formPage.locator('form').count(),
              fields:await formPage.evaluate(()=>[...document.querySelectorAll('input[name],textarea[name],select[name]')]
                .map(e=>e.name).filter(n=>n && !n.startsWith('_')).slice(0,28)),
              analyticsConfigured:await formPage.evaluate(()=>document.documentElement.innerHTML.includes('G-CHXY0DC2WP'))};
            await formPage.screenshot({path:path.join(TARGET,service.toLowerCase()+'-partner-'+view+'.png'),fullPage:true,timeout:14000});
            if((r?.status()||0)>=400)result.failures.push('掲載フォームページ HTTP '+r.status());
            if(result.partnerPage.forms===0)result.warnings.push('掲載先画面にフォーム未検出（専用CMS/認証の可能性）');
            if(isApprovedPlayIntake){
              const names=result.partnerPage.fields;
              for(const required of ['service','company','name','email','listing_permission','listing_content_checked_at','privacy_agree']){
                if(!names.includes(required))result.failures.push('PLAY共通掲載フォームに必須項目なし: '+required);
              }
            }
          }finally{await formPage.close();}
        }else if(service==='PLAY'){result.failures.push('PLAY掲載CTAが旧ドメイン/未承認の外部URL: '+target.origin);}
        else{result.warnings.push('未承認の外部掲載CTA: '+target.origin);}
      }catch(e){result.warnings.push('掲載CTA検証失敗: '+String(e.message).split('\n')[0].slice(0,110));}
    }else result.warnings.push('掲載申込CTAがトップのa要素から未検出');

    // Safe reads only; never click CTAs that can send or mutate.
    for(const href of data.sameOriginLinks.slice(0,5)){
      const u=new URL(href);
      if(!/^\/(?:mate\/)?(?:partners|contact|privacy|terms|disclaimer|operator)(?:\.html)?\/?$/.test(u.pathname)&&
         !/\/(?:privacy|terms|operator|partners|disclaimer|contact)(?:\/|\.html)/.test(u.pathname))continue;
      try{
        const res=await page.request.get(href,{timeout:8500,failOnStatusCode:false});
        if(res.status()>=400)result.failures.push('内部リンク HTTP '+res.status()+': '+u.pathname.slice(0,100));
      }catch(e){result.warnings.push('内部リンク検査不可: '+u.pathname.slice(0,100));}
    }
    result.ok=result.failures.length===0;
  }catch(e){result.failures.push(String(e.message).split('\n')[0].slice(0,220));}
  finally{
    await page.close();
    const headline={service:result.service,view:result.view,ok:result.ok,http:result.http,
      width:result.width,scrollWidth:result.scrollWidth,secureContext:result.secureContext,brokenImages:result.brokenImages,
      prefOptions:result.prefOptions,hasNationwideText:result.hasNationwideText,
      forms:result.forms,partnerPage:result.partnerPage,issues:result.failures,warnings:result.warnings,title:result.title};
    console.log('MATE_LIVE_QA '+JSON.stringify(headline));
    results.push(headline);
  }
}
(async()=>{
  const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  try{for(const service of Object.keys(ORIGINS)){
    for(const mobile of [false,true])await audit(browser,service,mobile);
  }
  // Check public family inquiry UX in both CARE and PLAY modes.
  // This does not submit a message or transmit any contact details.
  for(const service of ['CARE','PLAY']){
    const p=await browser.newPage({viewport:{width:390,height:844},isMobile:true});
    await p.route('https://formsubmit.co/**',route=>route.abort());
    try{
      const url=ORIGINS.CARE+'consult.html?service='+service;
      const resp=await p.goto(url,{waitUntil:'domcontentloaded',timeout:25000});
      const form=p.locator('#consultForm');
      const required=await p.locator('#consultForm [required]').evaluateAll(els=>els.map(e=>e.name).sort());
      const verdict={service,view:'family-consult-mobile',http:resp?.status()||0,
        required,ok:resp?.status()===200&&JSON.stringify(required)===JSON.stringify(['email','privacy_agree'])};
      console.log('MATE_FAMILY_QA '+JSON.stringify(verdict));
      if(!verdict.ok)process.exitCode=1;
      await p.screenshot({path:path.join(TARGET,'consult-'+service.toLowerCase()+'-mobile.png'),fullPage:true});
    }catch(e){console.log('MATE_FAMILY_QA_FAILED '+service+' '+String(e.message).slice(0,220));process.exitCode=1}
    finally{await p.close();}
  }
  }finally{await browser.close();}
  fs.writeFileSync(path.join(TARGET,'read-only-report.json'),JSON.stringify({auditedAt:new Date().toISOString(),results},null,2));
  const failures=results.filter(x=>!x.ok);
  console.log('MATE_AUDIT_SUMMARY '+JSON.stringify({
    checked:results.length, pass:results.length-failures.length, fail:failures.length,
    warnings:results.reduce((n,x)=>n+x.warnings.length,0),
    auditedProductionPlay:ORIGINS.PLAY,
    legacyPlayNotCutOver:LEGACY_PLAY_ORIGIN
  }));
  if(failures.length)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1});
