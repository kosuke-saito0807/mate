/**
 * Verify post-push Apps Script HEAD source after a fresh `clasp pull`.
 * Reading only: no mutating operations or printing sensitive code.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const [pullDir,sourceFile]=process.argv.slice(2);
if(!pullDir||!sourceFile)throw Error('Expected pulled GAS project dir and GitHub V4 source');
const expected=fs.readFileSync(sourceFile,'utf8').replace(/^\uFEFF/,'').replace(/\r\n/g,'\n').trimEnd();
const dir=fs.realpathSync(pullDir);
const names=fs.readdirSync(dir).filter(name=>/\.(?:gs|js)$/.test(name));
const marker='function mateAutoOpsV4Cycle()';
const matches=names.filter(name=>{
  const s=fs.readFileSync(path.join(dir,name),'utf8');
  return s.includes(marker)&&s.includes('const MATE_V4=Object.freeze(');
});
if(matches.length!==1)throw Error('Remote GAS HEAD does not contain exactly one dedicated V4 module');
const target=matches[0];
const actual=fs.readFileSync(path.join(dir,target),'utf8').replace(/^\uFEFF/,'').replace(/\r\n/g,'\n').trimEnd();
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
if(hash(actual)!==hash(expected)){
  const version=s=>s.match(/version:'([^']+)'/)?.[1]||'unknown';
  throw Error('Remote GAS HEAD differs from committed V4 source; expected '+version(expected)+', remote '+version(actual));
}
const version=expected.match(/version:'([^']+)'/)?.[1]||'unknown';
console.log(JSON.stringify({remoteHeadMatchesCommit:true,version,remoteSourceFile:target,
  sha256:hash(actual),verifiedAt:new Date().toISOString(),webAppDeploymentUntouched:true}));
