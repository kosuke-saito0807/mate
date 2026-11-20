import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createContext,runInContext} from 'node:vm';
import test from 'node:test';

const fixture=[
  {service:'CARE',script:'assets/mate-gallery.js',data:'data.json',
   link:'provider.html?id=mate_care_3a29e1c1eb6f4f1b',count:4},
  {service:'SPARK',script:'spark/assets/mate-gallery.js',data:'spark/schools.json',
   link:'school-detail.html?id=mate_spark_48444d9917e44fd9',count:5},
];
for (const entry of fixture){
  test(entry.service+' approved owner photos link internally and carousel arrows wrap',()=>{
    const data=JSON.parse(readFileSync(entry.data,'utf8'))[0];
    assert.equal(data.images.length,entry.count,'approved user photos must match signed media ledger');
    const handlers=new Map();
    const mockDocument={addEventListener:(type,cb)=>handlers.set(type,cb)};
    const browser={document:mockDocument,URL,window:null,HTMLImageElement:class{}};
    browser.window=browser;
    const context=createContext(browser);
    runInContext(readFileSync(entry.script,'utf8'),context);
    const html=browser.MATEGallery.render(data,entry.service,entry.link);
    assert.ok(html.includes('href="'+entry.link+'"'), 'images navigate to owner profile');
    assert.ok(html.includes('aria-label="'+data.name+'のMATE掲載詳細を見る"'));
    assert.equal((html.match(/class="mate-real-photo"/g)||[]).length,entry.count);
    assert.ok(html.includes('>1 / '+entry.count+'</span>'));
    assert.ok(!html.includes('href="'+(data.official_url||data.url)+'"'),
      'do not send users straight from thumbnail to provider website');
    const gallery={dataset:{photoIndex:'0'},querySelectorAll:()=>images,
      querySelector:(key)=>key==='.mate-photo-count'?count:null};
    const images=Array.from({length:entry.count},(_,i)=>({hidden:i!==0}));
    const count={textContent:'1 / '+entry.count};
    const button={dataset:{photoMove:'1'},closest:(sel)=>sel==='[data-mate-gallery]'?gallery:null};
    const event={target:{closest:(sel)=>sel==='[data-photo-move]'?button:null},
      preventDefault(){},stopPropagation(){}};
    handlers.get('click')(event);
    assert.equal(gallery.dataset.photoIndex,'1');assert.equal(count.textContent,'2 / '+entry.count);
    assert.equal(images[1].hidden,false);assert.equal(images[0].hidden,true);
    button.dataset.photoMove='-1';handlers.get('click')(event);
    assert.equal(gallery.dataset.photoIndex,'0');
    handlers.get('click')(event);
    assert.equal(gallery.dataset.photoIndex,String(entry.count-1));
    assert.equal(count.textContent,entry.count+' / '+entry.count);
    const malicious=browser.MATEGallery.render(data,entry.service,'https://evil.example/x');
    assert.ok(!malicious.includes('href="https://evil.example/x"'));
  });
}
