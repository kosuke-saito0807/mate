/** MATE: opt-in private inquiry ledger sync. No email sends, no body/PII copied. */
const MATE_INTAKE = Object.freeze({
  sheetId: '1CLJeXuznctRtH8Y3AMZ2XyOu3dQedmh9obBDrPlIEuQ',
  tabName: '問い合わせ管理',
  inbox: 'kosodatemate@gmail.com',
  windowDays: 30,
  maxThreads: 150
});

function recordMATEInquiries() {
  // IMPORTANT: run as the kosodatemate@gmail.com inbox owner, or a delegate with access.
  // Do not automatically activate this on a personal Gmail account.
  const operatorEmail = Session.getEffectiveUser().getEmail();
  if (operatorEmail.toLowerCase() !== MATE_INTAKE.inbox) {
    throw new Error('This script must run in the dedicated MATE inquiry Gmail account.');
  }
  const doc = SpreadsheetApp.openById(MATE_INTAKE.sheetId);
  const sh = doc.getSheetByName(MATE_INTAKE.tabName);
  if (!sh) throw new Error('Missing private MATE inquiry log tab.');
  const end = sh.getLastRow();
  const existing = new Set(end > 1
    ? sh.getRange(2, 7, end - 1, 1).getDisplayValues().map(v => String(v[0]).trim()).filter(Boolean)
    : []);
  // Subject-only matching is a triage filter. It never establishes real consent.
  const query = 'in:anywhere -in:trash -in:spam newer_than:' + MATE_INTAKE.windowDays + 'd to:' + MATE_INTAKE.inbox;
  const threads = GmailApp.search(query, 0, MATE_INTAKE.maxThreads);
  const pending = [];
  for (const thread of threads) {
    for (const msg of thread.getMessages()) {
      const id = String(msg.getId());
      if (existing.has(id)) continue;
      // The matching conversation can include our outgoing replies. Do not register those.
      if (!String(msg.getTo() || '').toLowerCase().includes(MATE_INTAKE.inbox)) continue;
      const subject = String(msg.getSubject() || '');
      const match = subject.match(/\bMATE[\s　]*(CARE|SPARK|PLAY)\b/i);
      if (!match) continue;
      const service = match[1].toUpperCase();
      const kind = /体験|送客|利用相談/.test(subject) ? '体験相談'
        : /掲載|教室/.test(subject) ? '掲載相談' : 'その他';
      const timestamp = Utilities.formatDate(msg.getDate(), 'Asia/Tokyo', 'yyyy-MM-dd HH:mm:ss');
      pending.push([
        'MATE-' + id, timestamp, service, kind, '', '',
        id, '', '受付', '未確認', '未確認', '未確認',
        '', '', '', '', '', '自動仮登録。メール原文・許諾・宛先は担当者が要確認'
      ]);
      existing.add(id);
    }
  }
  if (pending.length) {
    // Only write status metadata. Sender address/body/child information remain in Gmail.
    sh.getRange(sh.getLastRow() + 1, 1, pending.length, 18).setValues(pending);
  }
  return pending.length;
}
