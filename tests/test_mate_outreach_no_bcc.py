"""Guard against reintroducing recipient-wasting monitoring BCC or weakening send safeguards."""
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
SRC = (ROOT/"scripts/mate_auto_ops_v4.gs").read_text(encoding="utf-8")

class OutreachNoBccTests(unittest.TestCase):
    def test_sending_has_no_owner_bcc_and_diagnostics_explain_scope(self):
        send = SRC.split("function mateV4SendOutreach(){", 1)[1].split("\nfunction ",1)[0]
        self.assertIn("GmailApp.sendEmail(email,subject,body,{name:sender,replyTo:MATE_V4.account})",send)
        self.assertNotIn("bcc:ownerCopy",send)
        self.assertNotIn("MATE_OWNER_COPY_EMAIL",send)
        self.assertIn("MailApp.getRemainingDailyQuota()<1",send)
        self.assertIn("blocked.has(email)",send)
        self.assertIn("allRecipients.has(email)",send)
        self.assertIn("attempted.has(key)",send)
        self.assertIn("MATE_AUTO_SEND_LEGAL_REVIEWED",send)
        self.assertIn("bccCodePolicy:'DISABLED_IN_THIS_SOURCE_ONLY'",SRC)
        self.assertIn("otherProjectsNotInspected:true",SRC)
    def test_official_contact_discovery_retries_without_relaxing_send_checks(self):
        audit = SRC.split("function mateV4AuditOfficialContacts(){",1)[1].split("function previewMateOutreachReadinessV4(){",1)[0]
        self.assertIn("const retryDays=/取得不可|取得失敗|確認できず/.test(note)?2:14",audit)
        self.assertIn("mateV4ContactLink_(home.html,home.url)",audit)
        self.assertIn("mateV4PublicHtml_(contact)",audit)
        self.assertIn("mateV4SalesRefusal_(z.html)",audit)
        self.assertIn("stopped.has(email)",audit)
        self.assertIn("mateV4OwnerBlocked_(x)",audit)
        self.assertIn("mateV4PublicMailOperatorReview_(audited)",audit)
        self.assertNotIn("GmailApp.sendEmail(",audit)
        self.assertIn("possible.includes(old)",audit)
        self.assertIn("possible.length===1?possible[0]",audit)
        self.assertIn("x['営業拒否']==='未確認'",audit)
        self.assertIn("tab.getRange(x._row,13).setValue('FALSE')",audit)
        self.assertIn("if(x['営業拒否']==='TRUE'",audit)
        self.assertIn("if(refused)",audit)


if __name__ == "__main__":
    unittest.main()
