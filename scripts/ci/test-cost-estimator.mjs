import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

function build(service, file, rawInputs) {
  const script = readFileSync(file, 'utf8');
  const fields = Object.fromEntries(Object.entries(rawInputs).map(([key, value]) => [
    key, { value: value == null ? '' : String(value) }
  ]));
  const result = { textContent: '' };
  const reset = { listeners: {}, addEventListener(event, fn) { this.listeners[event] = fn; } };
  const root = {
    listeners: {},
    getAttribute(key) { return key === 'data-mate-cost-estimator' ? service : null; },
    querySelector(selector) {
      if (selector === '[data-cost-result]') return result;
      if (selector === '[data-cost-reset]') return reset;
      const match = selector.match(/^input\[data-cost-key="([A-Za-z]+)"\]$/);
      return match ? (fields[match[1]] || null) : null;
    },
    querySelectorAll(selector) {
      return selector === 'input[data-cost-key]' ? Object.values(fields) : [];
    },
    addEventListener(event, fn) { this.listeners[event] = fn; }
  };
  const metrics = [];
  const sandbox = {
    document: { querySelector(selector) { return selector === '[data-mate-cost-estimator]' ? root : null; } },
    window: { gtag(...args) { metrics.push(JSON.parse(JSON.stringify(args))); } },
    Intl
  };
  vm.runInNewContext(script, sandbox, { filename: file, timeout: 1200 });
  return {
    result, metrics, fields,
    input(key, value) {
      fields[key].value = String(value);
      root.listeners.input();
    },
    reset() { reset.listeners.click(); }
  };
}

test('CARE calculator uses only given hourly/visit inputs and sends no financial values', () => {
  const x = build('CARE', 'assets/mate-cost-estimator.js', {
    hourly: '2500', hours: '3', visits: '2', transport: '500', surcharge: '0'
  });
  assert.equal(x.result.textContent, '');
  x.input('hours', '3');
  assert.match(x.result.textContent, /16,000円/);
  assert.equal(x.metrics.length, 1);
  assert.deepEqual(x.metrics[0], [
    'event', 'mate_cost_estimator_used', { service: 'CARE', estimator_type: 'sitter_total' }
  ]);
  x.input('transport', '1000');
  assert.match(x.result.textContent, /17,000円/);
  assert.equal(x.metrics.length, 1, 'only one anonymous usage event per page load');
  x.reset();
  assert.match(x.result.textContent, /時給・利用時間・利用回数/);
  assert.equal(x.fields.hourly.value, '');
});

test('SPARK calculator uses user-entered monthly and enrollment/other costs', () => {
  const x = build('SPARK', 'spark/assets/mate-cost-estimator.js', {
    monthly: '9000', months: '12', enrollment: '10000', materials: '3000', other: '2000'
  });
  x.input('monthly', '9000');
  assert.match(x.result.textContent, /123,000円/);
  assert.equal(x.metrics[0][2].service, 'SPARK');
  assert.equal(x.metrics[0][2].estimator_type, 'lesson_total');
});

test('Invalid, missing or out-of-range inputs do not report a successful estimate', () => {
  const x = build('CARE', 'assets/mate-cost-estimator.js', {
    hourly: '', hours: '', visits: '', transport: '', surcharge: ''
  });
  x.input('hourly', '2000');
  assert.equal(x.metrics.length, 0);
  x.input('hours', '-1');
  x.input('visits', '2');
  assert.equal(x.metrics.length, 0);
  x.input('hours', '4');
  assert.match(x.result.textContent, /16,000円/);
  assert.equal(x.metrics.length, 1);
});

test('No input names, amounts, URLs or personal identifiers are sent to analytics', () => {
  const contents = readFileSync('assets/mate-cost-estimator.js', 'utf8');
  assert.equal(contents, readFileSync('spark/assets/mate-cost-estimator.js', 'utf8'));
  assert.ok(!/fetch\(|sendBeacon|localStorage|sessionStorage|XMLHttpRequest/.test(contents));
  assert.ok(!/gtag\(.*(?:hourly|monthly|amount\()/.test(contents));
});
