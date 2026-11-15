import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const verify=path.resolve(import.meta.dirname,'verify-mate-gas-remote.mjs');
const source=`/** MATE AutoOps V4 */
const MATE_V4=Object.freeze({version:'v1'});
function mateAutoOpsV4Cycle(){}
`;
function fixture(remoteSource=source){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mate-verify-'));
  const pull=path.join(dir,'gas');fs.mkdirSync(pull);
  const committed=path.join(dir,'committed.gs');fs.writeFileSync(committed,source);
  fs.writeFileSync(path.join(pull,'mate_auto_ops_v4.js'),remoteSource);
  return {dir,pull,committed};
}
test('readback succeeds when exactly the same V4 module is present',()=>{
  const f=fixture();
  try{
    const r=spawnSync(process.execPath,[verify,f.pull,f.committed],{encoding:'utf8'});
    assert.equal(r.status,0,r.stderr);
    const value=JSON.parse(r.stdout.trim());
    assert.equal(value.remoteHeadMatchesCommit,true);
    assert.equal(value.version,'v1');
  }finally{fs.rmSync(f.dir,{force:true,recursive:true})}
});
test('readback rejects remotely stale source',()=>{
  const f=fixture(source.replace("version:'v1'","version:'v0'"));
  try{
    const r=spawnSync(process.execPath,[verify,f.pull,f.committed],{encoding:'utf8'});
    assert.notEqual(r.status,0);
    assert.match(r.stderr,/Remote GAS HEAD differs/);
  }finally{fs.rmSync(f.dir,{force:true,recursive:true})}
});
test('readback rejects missing V4 module',()=>{
  const f=fixture('function unrelated(){}');
  try{
    const r=spawnSync(process.execPath,[verify,f.pull,f.committed],{encoding:'utf8'});
    assert.notEqual(r.status,0);
  }finally{fs.rmSync(f.dir,{force:true,recursive:true})}
});
