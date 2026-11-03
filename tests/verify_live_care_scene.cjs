const { chromium } = require('playwright');
const fs = require('fs');
const assert = require('node:assert/strict');
(async()=>{
  fs.mkdirSync('artifacts/live-care-scene',{recursive:true});
  const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  try{
    for(const [label,width,height,cols] of [['desktop',1366,900,4],['tablet',820,1000,2],['mobile',390,844,2]]){
      const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1});
      const response=await page.goto('https://care.kosodatemate.jp/?care_scene_check=20261103-reference-v14',{waitUntil:'networkidle',timeout:60000});
      assert.equal(response.status(),200,label+' HTTP');
      await page.locator('#scene').scrollIntoViewIfNeeded();
      await page.waitForFunction(()=>[...document.querySelectorAll('#scene .cards .pic img')].length===4 &&
        [...document.querySelectorAll('#scene .cards .pic img')].every(i=>i.complete&&i.naturalWidth>0),null,{timeout:20000});
      const report=await page.evaluate(()=>{
        const scene=document.querySelector('#scene');
        const grid=scene.querySelector('.cards');
        const items=[...scene.querySelectorAll('.card')];
        return {
          styleSheet:[...document.styleSheets].map(s=>s.href).filter(Boolean).filter(s=>s.includes('mate-brand-alignment')),
          grid:getComputedStyle(grid).gridTemplateColumns,gridWidth:grid.getBoundingClientRect().width,
          cards:items.map((el)=>{const b=el.getBoundingClientRect(),p=el.querySelector('.pic'),img=p.querySelector('img'),pic=p.getBoundingClientRect(),im=img.getBoundingClientRect(),st=getComputedStyle(img);
            return {top:Math.round(b.top),left:Math.round(b.left),width:Math.round(b.width),photoFrameRatio:pic.width/pic.height,
              photoWidth:im.width,photoHeight:im.height,imageNaturalWidth:img.naturalWidth,imageNaturalHeight:img.naturalHeight,
              objectFit:st.objectFit,imgLoaded:img.complete&&img.naturalWidth>0,src:img.currentSrc};
          })
        };
      });
      const cardTops=[...new Set(report.cards.map(c=>c.top))];
      for(const idx of [0,1,3]){
        assert.ok(report.cards[idx].src.includes('-v2.webp'),label+' uses new coherent photographic scene for card '+idx);
        assert.equal(report.cards[idx].imageNaturalWidth,422,label+' published revised photographic crop '+idx);
        assert.equal(report.cards[idx].imageNaturalHeight,282,label+' true 3:2 image without stretching '+idx);
      }
      assert.equal(report.cards.length,4,label+' exactly four cards');
      assert.equal(cardTops.length,cols===4?1:2,label+' rows match responsive reference');
      for(let i=0;i<report.cards.length;i++){
        const card=report.cards[i];
        assert.ok(card.imgLoaded,label+' photo '+i+' not loaded');
        assert.ok(Math.abs(card.photoFrameRatio-1.5)<.015,label+' photo '+i+' frame ratio');
        assert.equal(card.objectFit,'cover',label+' photo '+i+' must crop without stretching');
        assert.ok(Math.abs(card.photoWidth/card.photoHeight-1.5)<.02,label+' photo '+i+' visible geometry');
      }
      await page.locator('#scene').screenshot({path:'artifacts/live-care-scene/scene-'+label+'.png',animations:'disabled'});
      console.log('LIVE_CARE_SCENE_AUDIT '+JSON.stringify({view:label,status:'PASS',...report}));
      await page.close();
    }
  }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
