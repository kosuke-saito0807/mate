"""CARE / SPARK self-service applicant flow is complete, safe and no-login."""
import re
import subprocess
import unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]

class OwnerSelfServiceTest(unittest.TestCase):
    def test_owner_self_registers_without_accounts(self):
        for path,svc in (("contact.html","CARE"),("spark/partners.html","SPARK"),("play-listing.html","PLAY")):
            html=(ROOT/path).read_text(encoding="utf-8")
            with self.subTest(service=svc):
                self.assertIn('name="service" value="'+svc+'"',html)
                for field in ("company","website","name","email","region","city","category",
                              "description","listing_content_checked_at","listing_permission",
                              "trial_referral_consent","listing_payload_b64"):
                    self.assertRegex(html,r'name="'+field+r'"')
                self.assertIn("会員登録不要",html)
                self.assertIn('name="description"',html)
                self.assertIn('minlength="25"',html)
                self.assertIn('name="listing_permission"',html)
                self.assertIn('name="trial_referral_consent"',html)

    def test_no_customer_pii_in_business_registration_payload(self):
        for path in ("assets/mate-self-service.js","spark/assets/mate-self-service.js"):
            text=(ROOT/path).read_text(encoding="utf-8")
            self.assertIn("MATE_LISTING_V1__",text)
            for banned in ('"email"','"phone"','"guardianName"','"name"'):
                self.assertNotIn(banned,text)
            self.assertIn("listing_permission",text)
            r=subprocess.run(["node","--check"],input=text,text=True,capture_output=True)
            self.assertEqual(r.returncode,0,r.stderr)

    def test_invalid_age_and_dates_rejected_before_submitting(self):
        for filename in ("assets/mate-self-service.js","spark/assets/mate-self-service.js"):
            content=(ROOT/filename).read_text(encoding="utf-8")
            self.assertIn('Number(data.ageMin)>Number(data.ageMax)',content)
            self.assertIn('data.nextTrialDate<data.listing_content_checked_at',content)
            self.assertIn('data.listing_content_checked_at>new Date()',content)
            check=subprocess.run(["node","--check"],input=content,text=True,capture_output=True)
            self.assertEqual(check.returncode,0,check.stderr)

    def test_registrations_require_human_approval(self):
        gs=(ROOT/"scripts/mate_self_service.gs").read_text(encoding="utf-8")
        for token in ("syncMateSelfServiceApplications","publishReviewedMateApplications",
                      'a[24]!=="承認"','a[25]!=="確認済み"',
                      '"状態":"未契約"','"体験受付許諾":"未確認"'):
            self.assertIn(token,gs)
        self.assertNotIn("GmailApp.sendEmail",gs)
        self.assertNotIn("GmailApp.createDraft",gs)
        self.assertNotIn("メールアドレス",gs)
        r=subprocess.run(["node","--check"],input=gs,text=True,capture_output=True)
        self.assertEqual(r.returncode,0,r.stderr)

    def test_care_publishes_preverified_business_details_only(self):
        script=(ROOT/"scripts/sync_google_sheets_public.py").read_text(encoding="utf-8")
        for field in ("掲載紹介文","サービス区分","料金メモ","対応時間","特徴タグ"):
            self.assertIn(field,script)
        search=(ROOT/"assets/provider-search.js").read_text(encoding="utf-8")
        self.assertIn("p.description",search)
        self.assertIn("p.pricingNotes",search)
        self.assertIn("escapeHtml",search)

    def test_privacy_first_visitor(self):
        html=(ROOT/"spark/index.html").read_text(encoding="utf-8")
        self.assertIn("会員登録不要",html)
        self.assertIn('name="guardianName"',html)
        self.assertNotIn('name="guardianName" maxlength="80" autocomplete="name" required',html)
        self.assertNotIn('name="grade" required',html)
        self.assertIn('name="email" type="email" maxlength="254" autocomplete="email" required',html)
        self.assertIn('name="agreed" value="yes" required',html)

if __name__=="__main__":
    unittest.main()
