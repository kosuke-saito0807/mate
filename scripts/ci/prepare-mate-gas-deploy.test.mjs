import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '../..');
const source = path.join(root, 'scripts/mate_auto_ops_v4.gs');
const runner = path.join(root, 'scripts/ci/prepare-mate-gas-deploy.mjs');
const remoteV4 = 