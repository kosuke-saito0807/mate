"""Regression guards for accepted listing intake, operator notices and form recovery.
Personal-inbox notification is delivered by a separate GAS project and must be
verified against Gmail receipt evidence rather than claimed by this source.
"""
from pathlib import Path
import unittest

ROOT=Path(__file__).resolve().parents[1]

class IntakeNotificationSafetyTests(unittest.TestCase):
    def test_listing_receipt_is_durable_and_notice_is_operator_only(self):
        src=(ROOT/"scripts/mate_direct_intake.gs").read_text(encoding="utf-8")
        self.assertIn("MATE_DIRECT.owner",src)
        self.assertIn('subject:"【MATE掲載申請】"',src)
        self.assertIn("mateDirectReviewLink_",src)
        self.assertIn("mateDirectExists_(apps,1,aid)",src)
        self.assertIn("duplicate:true",src)
        self.assertIn("公開完了メールは本番反映を検証してから送信します。",src)
    def test_turnstile_expiry_has_non_destructive_recovery(self):
        for path in ["assets/mate-direct-intake.js","spark/assets/mate-direct-intake.js"]:
            with self.subTest(path=path):
                src=(ROOT/path).read_text(encoding="utf-8")
                self.assertIn("turnstile.isExpired()",src)
                self.assertIn("turnstile.reset()",src)
                self.assertIn("HTMLFormElement.prototype.submit.call(form)",src)
                self.assertIn("listing_inquiry_submit_attempt",src)
                self.assertIn('name="privacy_agree"',src)
                self.assertIn("申請番号が表示されます",src)

if __name__=="__main__":unittest.main()
