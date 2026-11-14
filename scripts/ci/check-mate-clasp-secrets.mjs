import fs from 'node:fs';

// Read credential files silently: never print tokens, script IDs, or their contents.
const [authPath, projectPath] = process.argv.slice(2);
if (!authPath || !projectPath) {
  console.error('Missing clasp credential and project config paths.');
  process.exit(1);
}
function parse(name, file) {
  let value;
  try { value = JSON.parse(fs.readFileSync(file, 'utf8').trim()); }
  catch (_) {
    console.error(`::error::${name} is not valid JSON. Open GitHub Settings > Secrets and variables > Actions and replace only ${name} with its JSON contents. Do not paste the word JSON, Markdown code fences, a path, or a placeholder.`);
    process.exitCode = 1;
    return null;
  }
  if (!value || Array.isArray(value) || typeof value !== 'object') {
    console.error(`::error::${name} must be a JSON object.`);
    process.exitCode = 1;
    return null;
  }
  return value;
}
const auth = parse('CLASPRC_JSON', authPath);
const project = parse('CLASP_JSON', projectPath);
if (auth && !Object.keys(auth).length) {
  console.error('::error::CLASPRC_JSON cannot be an empty JSON object.');
  process.exitCode = 1;
}
if (project && (typeof project.scriptId !== 'string' ||
    project.scriptId.trim().length < 15 || /ここに|実際の|placeholder/i.test(project.scriptId))) {
  console.error('::error::CLASP_JSON must be {"scriptId":"your actual GAS script ID"}. Use the script ID of the project containing mateAutoOpsV4Cycle, not the spreadsheet ID.');
  process.exitCode = 1;
}
if (!process.exitCode) console.log('Both clasp settings are valid JSON; credentials and script ID were not printed.');
