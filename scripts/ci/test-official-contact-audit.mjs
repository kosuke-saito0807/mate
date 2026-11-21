import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const script = readFileSync('scripts/mate_auto_ops_v4.gs', 'utf8');
const context = vm.createContext({ console });
vm.runInContext(script, context, { timeout: 4000, filename: 'mate_auto_ops_v4.gs' });
const contact = (markup, base) => context.mateV4ContactLink_(markup, base);

test('prefer a first-party business contact over a general customer support link', () => {
  const html = [
    '<a href="/support/contact/">一般のお客様向けお問い合わせ</a>',
    '<a href="https://other.example.org/partner/contact">他社の協業窓口</a>',
    '<a href="/corporate/partners/contact/">法人向け事業提携・お問い合わせ</a>'
  ].join('');
  assert.equal(contact(html, 'https://example.co.jp/service/'),
    'https://example.co.jp/corporate/partners/contact/');
});

test('general same-host contact is still used when partnership page absent', () => {
  const html = '<a href="/info">会社案内</a><a href="/contact/">お問い合わせ</a>';
  assert.equal(contact(html, 'https://example.co.jp/service/'),
    'https://example.co.jp/contact/');
});

test('reject emails, external hosts, anchors and non-https addresses', () => {
  const html = [
    '<a href="mailto:info@example.co.jp">法人お問い合わせ</a>',
    '<a href="https://external.test/contact">外部問い合わせ</a>',
    '<a href="#contact">お問い合わせ</a>',
    '<a href="//example.co.jp/contact">Protocol relative contact</a>',
    '<a href="http://example.co.jp/contact">Old HTTP</a>'
  ].join('');
  assert.equal(contact(html, 'https://example.co.jp/'), '');
});

test('consider linked first-party page when link text says inquiries', () => {
  const html = '<a href="./form/?type=corporate">お問い合わせ</a>';
  assert.equal(contact(html, 'https://example.co.jp/'),
    'https://example.co.jp/form/?type=corporate');
});

test('public contact parser does not infer sales permission or send email', () => {
  assert.ok(!/GmailApp\.sendEmail|MailApp\.sendEmail/.test(
    script.slice(script.indexOf('function mateV4ContactLink_('),
      script.indexOf('/** Find an official company/about page'))));
  const email = context.mateV4PublishedEmails_(
    '<a href="mailto:info@example.co.jp">公開会社窓口</a>');
  assert.equal(email.length, 1);
  assert.equal(email[0], 'info@example.co.jp');
});
