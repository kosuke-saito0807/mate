import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const source=fs.readFileSync(path.resolve(import.meta.dirname,'../mate_auto_ops_v4.gs'),'utf8');
const a=source.indexOf('function mateV4DiscoverLicensedPublicCsvSources(){');
const b=source.indexOf('function mateV4CollectLeads(){',a);
assert.ok(a>0&&b>a,'Expected separate guarded catalog discovery function');
const body=source.slice(a,b);

function fixture(datasets,existing=[],config={}){
  const added=[],properties={},calls=[];
  const props={
    getProperty:key=>properties[key]||'',
    setProperty:(key,val)=>{properties[key]=val;}
  };
  const dependencies={
    MATE_V4:{sources:'収集元設定V1',maxCSVBytes:600000},
    PropertiesService:{getScriptProperties:()=>props},
    mateV4Jst_:()=> '2026-11-15 09:00:00',
    mateV4Book_:()=>({}),
    mateV4Tab_:()=>({}),
    mateV4Rows_:()=>existing.map(x=>({...x})),
    mateV4Append_:(_tab,values)=>added.push(values),
    UrlFetchApp:{fetch:(url,opts)=>{
      calls.push(url);
      assert.ok(url.startsWith('https://data.bodik.jp/api/3/action/package_search?'));
      assert.equal(opts.followRedirects,false);
      return {getResponseCode:()=>200,
        getContentText:()=>JSON.stringify({success:true,result:{results:datasets}})};
    }}
  };
  Object.assign(dependencies,config);
  const args=Object.keys(dependencies);
  const compiled=new Function(...args,body+'\nreturn mateV4DiscoverLicensedPublicCsvSources;');
  return {run:compiled(...Object.values(dependencies)),added,properties,calls};
}

const approved={title:'観光施設一覧',license_id:'cc-by-4.0',
  organization:{title:'板橋区'},
  resources:[{name:'観光施設一覧',format:'CSV',size:3000,
    url:'https://data.bodik.jp/dataset/verified/resource/one/download/tourism.csv'}]};
test('registers only official licensed CSV metadata; never marks a recipient approved',()=>{
  const x=fixture([approved]);
  const result=x.run();
  assert.equal(result.registered,1);
  assert.equal(x.added.length,1);
  assert.deepEqual(x.added[0].slice(0,5),[
    'PLAY','板橋区 観光施設一覧（BODIK CC-BY-4.0）',
    approved.resources[0].url,'確認済み','TRUE']);
  assert.equal(result.autoEmailApproval,false);
  assert.equal(x.run(),'ALREADY_CHECKED');
});
test('ignores unlicensed, non-government, non-CSV, and private records',()=>{
  const clones=[
    {...approved,license_id:'other',title:'観光施設一覧'},
    {...approved,organization:{title:'民間事業者'}},
    {...approved,resources:[{...approved.resources[0],format:'XLSX'}]},
    {...approved,title:'観光施設一覧 個人情報'},
    {...approved,resources:[{...approved.resources[0],url:'https://third-party.example/a.csv'}]}
  ];
  const x=fixture(clones);
  assert.equal(x.run().registered,0);
  assert.equal(x.added.length,0);
});
test('never creates duplicate registrations or imports records in source discovery',()=>{
  const x=fixture([approved],[{'サービス':'PLAY','取得元CSV HTTPS URL':approved.resources[0].url}]);
  assert.equal(x.run().registered,0);
  assert.equal(x.added.length,0);
});
test('discovery can be disabled without calling external services',()=>{
  const x=fixture([approved],[],{PropertiesService:{getScriptProperties:()=>({
    getProperty:key=>key==='MATE_SOURCE_CATALOG_DISCOVERY'?'OFF':'',
    setProperty:()=>{throw Error('should not write');}
  })}});
  assert.equal(x.run(),'OFF');
  assert.equal(x.calls.length,0);
});

test('catalog API outage is rate-limited to one set of calls per JST day',()=>{
  let requests=0;
  const x=fixture([],[],{UrlFetchApp:{fetch:()=>{
    requests++;
    return {getResponseCode:()=>503};
  }}});
  const initial=x.run();
  assert.equal(initial.failures,3);
  assert.equal(requests,3);
  assert.equal(x.run(),'ALREADY_CHECKED');
  assert.equal(requests,3);
});

const queueStart=source.indexOf('function mateV4BalancedSourceQueue_(');
const queueEnd=source.indexOf('function mateV4CollectLeads(){',queueStart);
assert.ok(queueStart>0&&queueEnd>queueStart);
const sourceQueue=new Function('mateV4Https_',
  source.slice(queueStart,queueEnd)+'\nreturn mateV4BalancedSourceQueue_;')(
  u=>String(u).startsWith('https://'));
const src=(service,id,last='')=>({
  'サービス':service,'有効':'TRUE','再利用許諾確認':'確認済み',
  '取得元CSV HTTPS URL':'https://data.bodik.jp/dataset/'+id+'.csv',
  '最終取込日時':last,'id':id
});
test('CSV scheduler processes newly added and least-recent sources, balanced across services',()=>{
  const queue=sourceQueue([
    src('PLAY','play-old','2026-11-01'),
    src('PLAY','play-new'),
    src('SPARK','spark-new'),
    src('CARE','care-old','2026-11-05'),
    src('CARE','care-new'),
    src('PLAY','play-today','2026-11-15 10:00:00')
  ],'2026-11-15');
  assert.deepEqual(queue.map(x=>x.id),[
    'care-new','spark-new','play-new','care-old','play-old']);
});
test('CSV scheduler excludes invalid or already-checked sources',()=>{
  const unlicensed=src('CARE','unlicensed');
  unlicensed['再利用許諾確認']='未確認';
  const disabled=src('SPARK','disabled');
  disabled['有効']='FALSE';
  assert.deepEqual(sourceQueue([unlicensed,disabled,
    src('PLAY','today','2026-11-15 09:00:00')],'2026-11-15'),[]);
});
