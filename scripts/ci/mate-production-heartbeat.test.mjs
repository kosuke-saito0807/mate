import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';
const source=fs.readFileSync(path.resolve(import.meta.dirname,'../mate_auto_ops_v4.gs'),'utf8');
const start=source.indexOf('function mateV4ProductionHeartbeat_(');
const end=source.indexOf('function mateAutoOpsV4Cycle(){',start);
assert.ok(start>0&&end>start,'heartbeat must be separate function');
const code=source.slice(start,end);
test('live heartbeat records execution version and zero-send OSM outcome without recipient identities',()=>{
 const rows=[],leads=[{'サービス':'CARE'},{'サービス':'SPARK'},{'サービス':'PLAY'}];
 const deps={
   mateV4Book_:()=>({}),mateV4Tab_:(_book,name)=>name,
   MATE_V4:{leads:'leads',version:'TEST-FROM-LIVE-GAS'},
   mateV4Rows_:sheet=>sheet==='leads'?leads:[],
   mateV4Jst_:()=> '2026-11-15 12:00:00'
 };
 const fn=new Function(...Object.keys(deps),
   code.replace("const sheet=mateV4Tab_(book,'GAS本番稼働監視V4');",
   "const sheet={getRange:()=>({setValues:v=>rows.push(v)})};")+
   '\nreturn mateV4ProductionHeartbeat_;')(...Object.values(deps));
 const result=fn({freeOsmDiscovery:{added:2},generalWebDiscovery:'NO_KEY',outreach:0,collected:0});
 assert.equal(result.codeRunning,true);
 assert.equal(rows[0][0][1],'TEST-FROM-LIVE-GAS');
 assert.equal(rows[0][0][2],3);
 assert.equal(rows[0][0][8],0);
 assert.equal(rows[0][0][10],'CYCLE_COMPLETED');
});
