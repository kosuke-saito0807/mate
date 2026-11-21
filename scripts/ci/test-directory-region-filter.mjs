import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const file = readFileSync('assets/mate-directory-region-filter.js','utf8');
assert.equal(file,readFileSync('spark/assets/mate-directory-region-filter.js','utf8'));

function page(service='CARE',search='?region=%E6%9D%B1%E4%BA%AC%E9%83%BD') {
  const data=[
    ['東京A','東京都','病児保育 東京'],
    ['神奈川B','神奈川県','送迎 神奈川'],
    ['東京神奈川C','東京都・神奈川県・千葉県','シッター'],
    ['全国D','全国（対象地域は公式確認）','学習支援'],
  ];
  const items=data.map(([id,region,description])=>({
    getAttribute(k){ return k==='data-region'?region:null; },
    textContent:id+' '+region+' '+description,
    hidden:false,
  }));
  const section={hidden:false,querySelectorAll(sel){assert.equal(sel,'.provider');return items.slice(0,2)}};
  const otherSection={hidden:false,querySelectorAll(sel){return items.slice(2)}};
  const select={
    value:'',options:[],listeners:{},
    appendChild(opt){this.options.push(opt)},
    addEventListener(type,cb){this.listeners[type]=cb}
  };
  const input={value:'',listeners:{},addEventListener(type,cb){this.listeners[type]=cb}};
  const output={textContent:''};
  const empty={hidden:false};
  const opts={document:{
    getElementById(id){return ({
      'directory-region':select,filter:service==='CARE'?input:null,
      'directory-filter':service==='SPARK'?input:null,
      'directory-filter-result':output,empty,
    })[id]??null},
    querySelectorAll(selector){
      if(selector==='.provider[data-region]')return items;
      if(selector==='#directory-content .group')return service==='SPARK'?[section,otherSection]:[];
      throw Error(selector)
    },
    createElement(tag){assert.equal(tag,'option');return{value:'',textContent:''}}
  },
  window:{
    location:{href:'https://'+(service==='CARE'?'care':'spark')+'.kosodatemate.jp/'+
      (service==='CARE'?'sitter-directory.html':'school-directory.html')+search},
    history:{replaceState(_a,_b,url){opts.window.location.href=url}}
  },URL};
  vm.runInNewContext(file,vm.createContext(opts),{timeout:1800});
  return{items,select,input,output,empty,section,otherSection,window:opts.window};
}
function displayed(x){return x.items.map((c,i)=>!c.hidden?i:-1).filter(i=>i>=0)}
test('CARE: Tokyo guide deep link filters by listed prefecture without assuming nationwide coverage',()=>{
  const x=page();
  assert.deepEqual(displayed(x),[0,2]);
  assert.equal(x.select.value,'東京都');
  assert.match(x.output.textContent,/2件を表示（全4件）/);
  assert.match(x.output.textContent,/実際の提供地域/);
  assert.equal(x.select.options.some(o=>o.value==='東京都'),true);
  assert.equal(x.select.options.some(o=>o.value==='全国'),true);
  assert.equal(x.select.options.some(o=>o.value==='沖縄県'),false);
});
test('SPARK: combine regional picker and keyword search while hiding empty groups',()=>{
  const x=page('SPARK','');
  assert.deepEqual(displayed(x),[0,1,2,3]);
  x.select.value='神奈川県';x.select.listeners.change();
  assert.deepEqual(displayed(x),[1,2]);
  assert.match(decodeURI(x.window.location.href),/region=神奈川県/);
  x.input.value='送迎';x.input.listeners.input();
  assert.deepEqual(displayed(x),[1]);
  assert.equal(x.otherSection.hidden,true);
  x.input.value='ない文字列';x.input.listeners.input();
  assert.equal(x.empty.hidden,false);
});
test('Unknown region in URL falls back to all records, no network or storage',()=>{
  const x=page('CARE','?region=%E6%9E%B6%E7%A9%BA');
  assert.equal(x.select.value,'');
  assert.deepEqual(displayed(x),[0,1,2,3]);
  for(const unsafe of ['fetch(', 'XMLHttpRequest', 'localStorage','sessionStorage','sendBeacon','gtag('])
    assert.equal(file.includes(unsafe),false,unsafe);
});
test('Resetting dropdown preserves text filter and removes only region URL parameter',()=>{
  const x=page('CARE','?region=%E6%9D%B1%E4%BA%AC%E9%83%BD&utm_source=organic');
  x.input.value='シッター';x.input.listeners.input();
  assert.deepEqual(displayed(x),[2]);
  x.select.value='';x.select.listeners.change();
  assert.deepEqual(displayed(x),[2]);
  assert.match(x.window.location.href,/utm_source=organic/);
  assert.ok(!x.window.location.href.includes('region='));
});
