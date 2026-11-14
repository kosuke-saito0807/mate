import fs from 'node:fs';

// Never print credential values, script IDs, raw input, or parser exceptions.
const [authPath, projectPath] = process.argv.slice(2);
if (!authPath || !projectPath) {
  console.error('::error::Missing clasp credential and project config paths.');
  process.exit(1);
}
function parseAuth(file) {
  try {
    const obj = JSON.parse(fs.readFileSync(file, 'utf8').trim());
    if (!obj || Array.isArray(obj) || typeof obj !== 'object' || !Object.keys(obj).length) throw Error();
    return obj;
  } catch {
    console.error('::error::CLASPRC_JSON is not a valid clasp OAuth JSON object. Copy ~/.clasprc.json into this GitHub Secret. Never share the contents in chat.');
    process.exitCode = 1;
    return null;
  }
}
function parseProject(file) {
  let raw = fs.readFileSync(file, 'utf8').trim();
  // Accept a raw Apps Script ID, normal JSON, or fenced JSON pasted from documentation.
  raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  let parsed;
  try { parsed = JSON.parse(raw); } catch { /* legacy non-JSON input */ }
  if (parsed === undefined && /^JSON\s*\{/i.test(raw)) {
    try { parsed = JSON.parse(raw.replace(/^JSON\s*/i, '')); } catch {}
  }
  if (parsed === undefined && /^[A-Za-z0-9_-]{20,}$/.test(raw)) parsed = {scriptId:raw};
  if (typeof parsed === 'string') parsed = {scriptId:parsed};
  const scriptId = parsed?.scriptId;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) ||
      typeof scriptId !== 'string' || !/^[A-Za-z0-9_-]{20,}$/.test(scriptId) ||
      /placeholder|scriptid|スクリプト|ここに|実際の/i.test(scriptId)) {
    console.error('::error::CLASP_JSON must contain only the actual GAS Script ID (plain text is now supported). Edit this GitHub Secret and paste the Script ID copied from the project containing mateAutoOpsV4Cycle. Do not paste a URL, label or placeholder.');
    process.exitCode = 1;
    return null;
  }
  fs.writeFileSync(file, JSON.stringify({scriptId}), {mode:0o600});
  return {scriptId};
}
parseAuth(authPath);
const project = parseProject(projectPath);
if (project && !process.exitCode) console.log('clasp configuration validated; neither OAuth credentials nor script ID were printed.');
