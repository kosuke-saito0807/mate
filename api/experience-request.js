'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const MAX_BYTES = 12000;
const MAX_SCHOOLS = 5;
function respond(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(data));
}
function stringValue(value, max) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, max);
}
function safeEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
}
function cleanHeader(value) {
  return String(value || '').replace(/[\r\n\t]/g, ' ').slice(0, 160);
}
async function sendMail({ to, subject, text }) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + process.env.RESEND_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: process.env.REQUEST_FROM_EMAIL,
      to,
      subject,
      text
    }),
    signal: AbortSignal.timeout(10000)
  });
  if (!response.ok) throw new Error('Mail provider rejected request with status ' + response.status);
}
async function captchaOk(token, ip) {
  const data = new URLSearchParams({
    secret: process.env.TURNSTILE_SECRET_KEY,
    response: token
  });
  if (ip) data.set('remoteip', ip);
  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body: data,
    signal: AbortSignal.timeout(8000)
  });
  if (!response.ok) return false;
  const result = await response.json();
  return result.success === true;
}
module.exports = async function handler(req, res) {
  const allowed = String(process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  const origin = String(req.headers.origin || '');
  if (!origin || !allowed.includes(origin)) return respond(res, 403, { error: '許可されていないアクセス元です。' });
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return respond(res, 204, {});
  if (req.method !== 'POST') return respond(res, 405, { error: 'POSTのみ対応しています。' });
  const required = ['RESEND_API_KEY', 'REQUEST_FROM_EMAIL', 'REQUEST_TO_EMAIL', 'TURNSTILE_SECRET_KEY'];
  if (required.some(k => !process.env[k])) return respond(res, 503, { error: '申込受付は準備中です。' });
  const size = Number(req.headers['content-length'] || 0);
  if (size > MAX_BYTES) return respond(res, 413, { error: '申込内容が長すぎます。' });
  let form;
  try {
    form = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    if (!form || typeof form !== 'object' || Array.isArray(form) || JSON.stringify(form).length > MAX_BYTES) throw Error('Invalid body');
  } catch {
    return respond(res, 400, { error: '入力形式を確認してください。' });
  }
  if (form.website) return respond(res, 200, { accepted: true });
  const name = stringValue(form.guardianName, 80);
  const email = stringValue(form.email, 254);
  const phone = stringValue(form.phone, 30);
  const grade = stringValue(form.grade, 40);
  const message = stringValue(form.message, 500);
  const ids = Array.isArray(form.schoolIds) ? form.schoolIds.filter(s => typeof s === 'string') : [];
  const token = stringValue(form.turnstileToken, 2048);
  if (!name || !safeEmail(email) || !grade || !Array.isArray(ids) ||
      !ids.length || ids.length > MAX_SCHOOLS || new Set(ids).size !== ids.length ||
      form.agreed !== true || !token) {
    return respond(res, 400, { error: '必須項目、選択教室、同意の内容をご確認ください。' });
  }
  // Recheck the server-side allowlist; never trust school names/emails supplied by a browser.
  let schools;
  try {
    schools = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'spark', 'schools.json'), 'utf8'));
  } catch {
    return respond(res, 503, { error: '掲載データを確認できません。' });
  }
  const approved = schools.filter(s => s.approved === true && s.acceptsTrial === true);
  const selected = ids.map(id => approved.find(s => s.id === id));
  if (selected.some(s => !s)) return respond(res, 400, { error: '体験受付可能な教室のみ選択してください。' });
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  let validCaptcha = false;
  try { validCaptcha = await captchaOk(token, ip); } catch {}
  if (!validCaptcha) return respond(res, 400, { error: 'セキュリティ認証をやり直してください。' });
  const ticket = crypto.randomUUID();
  const stamp = new Date().toISOString();
  const names = selected.map(s => cleanHeader(s.name));
  const content = [
    'MATE SPARK 体験相談受付', '受付番号: ' + ticket, '受付日時: ' + stamp,
    '保護者: ' + name, 'メール: ' + email,
    '電話（任意）: ' + (phone || '記入なし'), '対象学年: ' + grade,
    '選択教室: ' + names.join(' / '), '相談事項: ' + (message || '記入なし'),
    '申込者が選択先への情報提供に同意: はい'
  ].join('\n');
  try {
    await sendMail({
      to: [process.env.REQUEST_TO_EMAIL],
      subject: '[MATE SPARK] 体験相談 ' + ticket.slice(0, 8),
      text: content
    });
  } catch (error) {
    console.error('operator mail failed', error.message);
    return respond(res, 502, { error: '申込処理に失敗しました。時間をおいてお試しください。' });
  }
  // Provider notifications are opt-in at the service/operator level and are
  // routed using private environment variables, never browser-supplied addresses.
  // Failures remain in the operator mailbox for manual follow-up.
  let providerStatus = 'manual';
  if (process.env.PROVIDER_NOTIFICATIONS_ENABLED === 'true') {
    let routing = {};
    try { routing = JSON.parse(process.env.SCHOOL_NOTIFICATION_ROUTING || '{}'); } catch {}
    const targets = selected.map(s => ({ school: s, address: routing[s.id] }));
    if (targets.every(t => safeEmail(String(t.address || '')))) {
      const results = await Promise.allSettled(targets.map(({ school, address }) => sendMail({
        to: [address],
        subject: '[MATE SPARK] ' + cleanHeader(school.name) + ' 体験相談 ' + ticket.slice(0, 8),
        text: [
          'MATE SPARKより体験相談がありました。', '受付番号: ' + ticket,
          '対象教室: ' + cleanHeader(school.name),
          '保護者: ' + name, 'メール: ' + email,
          '電話: ' + (phone || '記入なし'), '対象学年: ' + grade,
          '相談事項: ' + (message || '記入なし'),
          '貴教室以外への申込内容はお知らせしていません。'
        ].join('\n')
      })));
      providerStatus = results.every(r => r.status === 'fulfilled') ? 'sent' : 'partial';
      if (providerStatus === 'partial') console.error('provider mail partial failure', ticket);
    }
  }
  return respond(res, 202, { accepted: true, reference: ticket.slice(0, 8), providerStatus });
};