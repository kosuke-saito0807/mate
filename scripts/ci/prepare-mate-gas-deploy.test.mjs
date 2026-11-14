import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '../..');
const source = path.join(root, 'scripts/mate_auto_ops_v4.gs');
const runner = path.join(root, 'scripts/ci/prepare-mate-gas-deploy.mjs');
const remoteV4 = [
  '/** MATE AutoOps V4 dedicated module */',
  'const MATE_V4=Object.freeze({});',
  'function mateV4Book_(){}',
  'function mateV4SendOutreach(){}',
  'function mateAutoOpsV4Cycle(){}',
  ''
].join('\n');

function withMockProject(options, cb) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mate-gas-fixture-'));
  try {
    fs.writeFileSync(path.join(dir, 'appsscript.json'), '{"timeZone":"Asia/Tokyo"}\n');
    fs.writeFileSync(path.join(dir, 'mate_auto_ops_v4.js'), options.v4 ?? remoteV4);
    if (options.other !== false) {
      fs.writeFileSync(path.join(dir, 'mate_owner_notifications.js'), 'function ownerNotifications(){}\n');
    }
    if (options.duplicate) fs.writeFileSync(path.join(dir, 'duplicate_v4.js'), remoteV4);
    return cb(dir);
  } finally { fs.rmSync(dir, { force:true, recursive:true }); }
}
const run = dir => spawnSync(process.execPath, [runner, dir, source], {encoding:'utf8'});

test('replaces only the dedicated V4 source and preserves other code and manifest', () => {
  withMockProject({}, dir => {
    const otherBefore = fs.readFileSync(path.join(dir, 'mate_owner_notifications.js'), 'utf8');
    const manifestBefore = fs.readFileSync(path.join(dir, 'appsscript.json'), 'utf8');
    const result = run(dir);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(fs.readFileSync(path.join(dir, 'mate_auto_ops_v4.js'), 'utf8'), fs.readFileSync(source, 'utf8'));
    assert.equal(fs.readFileSync(path.join(dir, 'mate_owner_notifications.js'), 'utf8'), otherBefore);
    assert.equal(fs.readFileSync(path.join(dir, 'appsscript.json'), 'utf8'), manifestBefore);
    assert.match(result.stdout, /GAS_FULL_PROJECT_PULL_THEN_ONE_FILE_REPLACE/);
  });
});

test('fails closed on multiple matching V4 files', () => {
  withMockProject({duplicate:true}, dir => {
    const result = run(dir);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /exactly one remote V4 file/);
    assert.equal(fs.readFileSync(path.join(dir, 'mate_auto_ops_v4.js'), 'utf8'), remoteV4);
  });
});

test('supports an existing dedicated single-source GAS project', () => {
  withMockProject({other:false}, dir => {
    const manifestBefore = fs.readFileSync(path.join(dir, 'appsscript.json'), 'utf8');
    const result = run(dir);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(fs.readFileSync(path.join(dir, 'mate_auto_ops_v4.js'), 'utf8'),
      fs.readFileSync(source, 'utf8'));
    assert.equal(fs.readFileSync(path.join(dir, 'appsscript.json'), 'utf8'), manifestBefore);
  });
});

test('rejects a single-file project with unrelated application functions', () => {
  withMockProject({other:false, v4:remoteV4 + '\nfunction publishReviewedMateApplications(){}\n'}, dir => {
    const result = run(dir);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /mixed-purpose code/);
    assert.match(fs.readFileSync(path.join(dir, 'mate_auto_ops_v4.js'), 'utf8'),
      /publishReviewedMateApplications/);
  });
});

test('fails closed when code appears to share a mixed-purpose file', () => {
  withMockProject({v4:remoteV4.replace('MATE AutoOps V4 dedicated module', 'Miscellaneous handlers')}, dir => {
    const result = run(dir);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /dedicated V4 header/);
  });
});
