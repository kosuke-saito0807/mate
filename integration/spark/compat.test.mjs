import test from "node:test";
import assert from "node:assert/strict";
import { CURRENT_FAVORITES_KEY,LEGACY_REACT_FAVORITES_KEY,COMPARISON_LIMIT,migrateFavorites,normalizeApprovedSchool,buildApprovedPreview } from "./compat.mjs";
function storage(values={}) {
  const data=new Map(Object.entries(values));
  return { getItem:k=>data.has(k)?data.get(k):null,setItem:(k,v)=>data.set(k,v),data };
}
test("preserves the five-school comparison limit",()=>assert.equal(COMPARISON_LIMIT,5));
test("merges both favorite keys without loss",()=>{
  const s=storage({[CURRENT_FAVORITES_KEY]:'["A","B"]',[LEGACY_REACT_FAVORITES_KEY]:'["B","C"]'});
  assert.deepEqual(migrateFavorites(s).ids,["A","B","C"]);
  assert.equal(s.getItem(CURRENT_FAVORITES_KEY),'["A","B","C"]');
  assert.equal(s.getItem(LEGACY_REACT_FAVORITES_KEY),'["B","C"]');
});
test("dryRun never writes",()=>{
  const s=storage({[LEGACY_REACT_FAVORITES_KEY]:'["A"]'});
  assert.equal(migrateFavorites(s,{dryRun:true}).changed,true);
  assert.equal(s.getItem(CURRENT_FAVORITES_KEY),null);
});
test("invalid legacy values cannot overwrite existing data",()=>{
  const s=storage({[CURRENT_FAVORITES_KEY]:'["A"]',[LEGACY_REACT_FAVORITES_KEY]:'{bad'});
  assert.deepEqual(migrateFavorites(s).ids,["A"]);
});
test("storage errors fail closed",()=>assert.equal(migrateFavorites({getItem(){throw Error("blocked")}}).ok,false));
test("approved nationwide data retained without inventing fees or leaking private columns",()=>{
  const rec=normalizeApprovedSchool({id:"x",name:"X",region:"北海道",approved:true,contactEmail:"private@example.com"});
  assert.equal(rec.prefecture,"北海道");
  assert.equal(rec.monthlyFee,null);
  assert.equal("contactEmail" in rec,false);
});
test("unapproved and demo data never enter the public set",()=>{
  assert.equal(normalizeApprovedSchool({id:"x",name:"X",region:"東京都",approved:false}),null);
  assert.equal(normalizeApprovedSchool({id:"demo-1",name:"X",region:"東京都",approved:true,demo:true}),null);
});
test("duplicate IDs are rejected",()=>{
  assert.throws(()=>buildApprovedPreview([{id:"x",name:"X",region:"大阪府",approved:true},{id:"x",name:"Y",region:"大阪府",approved:true}]),/Duplicate/);
});
