/* A true browser-script contract with zero network, emails, form submission or user data. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync('consult.html', 'utf8');
const scriptMatch = html.match(/<script>\s*(\(\(\)=>\{[\s\S]*?\}\)\(\);)\s*<\/script>/);
assert.ok(scriptMatch, 'consultation's inline application code exists');
const script = scriptMatch[1];

function open(query) {
  const fields = new Map(
    ['service', 'inquiryType', 'message', 'referral_interest', 'submission_id']
      .map(name => [name, { name, value: '', checked: false }])
  );
  const form = { elements: { namedItem: name => fields.get(name) }, submitted: false };
  const ids = new Map([
    ['brand', { href: '', querySelector: () => ({ textContent: '' }) }],
    ['browse', { href: '', textContent: '' }],
    ['heading', { textContent: '' }], ['lead', { textContent: '' }],
    ['consultForm', form],
    ['formStatus', { hidden: true, textContent: '' }],
    ['submitBtn', { disabled: false, textContent: '' }],
    ['consultCaptcha', { setAttribute() {} }],
  ]);
  const dom = {
    body: { classList: { add() {} } },
    head: { appendChild() {} },
    getElementById: id => ids.get(id),
    querySelector: () => ({ textContent: '' }),
    createElement: () => ({ async: false, defer: false }),
  };
  vm.runInNewContext(script, {
    document: dom, location: { search: query }, URLSearchParams,
    window: { MATE_DIRECT_INTAKE: { enabled: false } },
  }, { timeout: 1000 });
  return { fields, lead: ids.get('lead').textContent, form };
}
const baby = open('?service=PLAY&inquiry=baby-first&childName=SECRET_NAME&email=SECRET_EMAIL');
assert.equal(baby.fields.get('service').value, 'PLAY');
assert.equal(baby.fields.get('inquiryType').value, '体験・利用相談');
assert.match(baby.fields.get('message').value, /0歳の赤ちゃんと参加できる親子体験/);
assert.match(baby.fields.get('message').value, /ベビーカーや授乳/);
assert.match(baby.lead, /お子さまの氏名・病歴・住所の詳細は不要/);
assert.equal(baby.fields.get('referral_interest').checked, false);
assert.ok(!baby.fields.get('message').value.includes('SECRET_NAME'));
assert.ok(!baby.fields.get('message').value.includes('SECRET_EMAIL'));
assert.equal(baby.form.submitted, false);
for (const search of ['?service=CARE&inquiry=baby-first', '?service=SPARK&inquiry=baby-first',
  '?service=PLAY&inquiry=other', '?service=PLAY']) {
  const notEligible = open(search);
  assert.equal(notEligible.fields.get('message').value, '');
}
console.log('PASS fixed guide consultation prefill, no visitor data or submission');
