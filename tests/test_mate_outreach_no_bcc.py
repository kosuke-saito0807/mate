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

if __name__ == "__main__":
    unittest.main()
