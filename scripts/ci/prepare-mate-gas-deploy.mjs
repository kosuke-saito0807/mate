/**
 * Safe MATE GAS CI staging.
 * A clasp push replaces the full remote project. We therefore pull that
 * project first, replace ONLY its dedicated V4 file, and keep everything else.
 * Fail closed if the remote structure is ambiguous or has changed unexpectedly.
 *
 * Usage: node scripts/ci/prepare-mate-gas-deploy.mjs <pulled-dir> <source.gs>
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const [pulledDir, sourcePath] = process.argv.slice(2);
if (!pulledDir || !sourcePath) throw new Error('Expected pulled GAS directory and source file');
const dir = fs.realpathSync(pulledDir);
const source = fs.readFileSync(sourcePath, 'utf8');
const marker = 'function mateAutoOpsV4Cycle()';
if (!source.includes(marker) || !source.includes('const MATE_V4=Object.freeze(') ||
    !source.includes('function mateV4SendOutreach()')) {
  throw new Error('GitHub source is not the expected standalone MATE AutoOps V4 file');
}
const manifest = path.join(dir, 'appsscript.json');
if (!fs.existsSync(manifest)) throw new Error('Missing pulled appsscript.json; refusing destructive push');

const all = fs.readdirSync(dir, { withFileTypes: true });
const files = all.filter(e => e.isFile() && /\.(?:js|gs)$/i.test(e.name));
if (files.length < 1) {
  throw new Error('No GAS source files were pulled; refusing push');
}
const matches = files.filter(e => {
  const contents = fs.readFileSync(path.join(dir, e.name), 'utf8');
  return contents.includes(marker) && contents.includes('const MATE_V4=Object.freeze(');
});
if (matches.length !== 1) {
  throw new Error('Expected exactly one remote V4 file; found ' + matches.length + '. Refusing push');
}
const target = matches[0].name;
const original = fs.readFileSync(path.join(dir, target), 'utf8');
if (!/MATE AutoOps V4/i.test(original.slice(0, 900))) {
  throw new Error('Target file does not have the dedicated V4 header; refusing to overwrite mixed-purpose code');
}
const required = ['function mateV4Book_()', 'function mateV4SendOutreach()', marker];
if (!required.every(x => original.includes(x))) {
  throw new Error('Remote file lacks required V4 functions; refusing push');
}
// A single-file project is legitimate, but only if it contains the dedicated
// MATE V4 module. Never overwrite one monolithic file that also owns unrelated
// intake, approval, notification, or publication functions.
if (files.length === 1) {
  const functionNames = code =>
    [...code.matchAll(/\bfunction\s+([A-Za-z_$][\w$]*)\s*\(/g)].map(m => m[1]);
  const expected = new Set(functionNames(source));
  const extras = functionNames(original).filter(name => !expected.has(name));
  if (extras.length) {
    throw new Error('Single-file GAS project contains ' + extras.length +
      ' functions not present in the dedicated V4 source; refusing to overwrite mixed-purpose code');
  }
}
const previous = Object.fromEntries(
  all.filter(e => e.isFile() && /\.(?:js|gs|json)$/i.test(e.name) && e.name !== '.clasp.json')
    .map(e => [e.name, crypto.createHash('sha256').update(fs.readFileSync(path.join(dir, e.name))).digest('hex')])
);
fs.writeFileSync(path.join(dir, target), source, { mode: 0o600 });
for (const [filename, digest] of Object.entries(previous)) {
  if (filename === target) continue;
  const now = crypto.createHash('sha256').update(fs.readFileSync(path.join(dir, filename))).digest('hex');
  if (now !== digest) throw new Error('Unrelated GAS file unexpectedly changed: ' + filename);
}
const stat = fs.statSync(path.join(dir, target));
if (stat.size < 30000) throw new Error('Replacement V4 source unexpectedly short');
const version = source.match(/version:'([^']+)'/)?.[1] ?? 'unspecified';
console.log(JSON.stringify({
  mode: 'GAS_FULL_PROJECT_PULL_THEN_ONE_FILE_REPLACE',
  target,
  sourceVersion: version,
  remoteSourceFiles: files.length,
  unrelatedFilesPreserved: Object.keys(previous).filter(x => x !== target).length,
  sourceBytes: stat.size,
  doesNotChangeTriggers: true,
  doesNotChangeScriptProperties: true,
  doesNotDeployWebApps: true
}));
