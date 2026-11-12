"""Owner-requested hard stop on CodeCamp/CodeCampKIDS unsolicited outreach."""
from pathlib import Path
import unittest

SRC=(Path(__file__).resolve().parents[1]/"scripts/mate_auto_ops_v4.gs").read_text(encoding="utf-8")

class OwnerBrandSuppressionTests(unittest.TestCase):
    def test_suppression_is_enforced_in_all_outreach_paths(self):
        self.assertIn("function mateV4OwnerBlocked_(lead)",SRC)
        self.assertIn("コード",SRC)
        for start in [
            "function mateV4BalancedQueue_",
            "function mateV4SeedExistingCRM",
            "function mateV4SeedSectorDirectories",
            "function mateV4AuditOfficialContacts",
            "function mateV4PrepareReviewDrafts",
            "function mateV4SendOutreach",
            "function previewMateOutreachReadinessV4"
        ]:
            with self.subTest(start=start):
                block=SRC.split(start,1)[1].split("\nfunction ",1)[0]
                self.assertIn("mateV4OwnerBlocked_(",block)
    def test_email_send_remains_bcc_free_and_optout_protected(self):
        block=SRC.split("function mateV4SendOutreach(){",1)[1].split("\nfunction ",1)[0]
        self.assertIn("GmailApp.sendEmail(email,subject,body,{name:sender,replyTo:MATE_V4.account})",block)
        self.assertNotIn("bcc:ownerCopy",block)
        self.assertIn("blocked.has(email)",block)
        self.assertIn("attempted.has(key)",block)

if __name__=="__main__":unittest.main()
