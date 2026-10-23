"""Verify launch safeguards and consistent CARE/SPARK lead-generation structures."""
import json
import re
import subprocess
import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
SPARK=ROOT/"spark"
GA4_ID="G-NG57XX4Y5D"


class LaunchPreparationTests(unittest.TestCase):
    def test_real_listings_by_default_demo_requires_explicit_query(self):
        html=(SPARK/"index.html").read_text(encoding="utf-8")
        self.assertIn("demoMode=forceDemo;",html)
        self.assertNotIn("demoMode=forceDemo||real.length===0",html)
        self.assertIn('href="?demo=1#discover"',html)
        self.assertIn("実在教室は掲載準備中です",html)
        self.assertIn("schools=real",html)
        self.assertEqual(json.loads((SPARK/"schools.json").read_text(encoding="utf-8")),[])
        sample=json.loads((SPARK/"demo-schools.json").read_text(encoding="utf-8"))
        self.assertEqual(len(sample),12)
        self.assertTrue(all(s.get("demo") is True and s.get("acceptsTrial") is False for s in sample))
        self.assertFalse(json.loads((SPARK/"config.json").read_text(encoding="utf-8"))["trialIntakeEnabled"])

    def test_both_publication_forms_are_separate_from_trial_consent(self):
        care=(ROOT/"contact.html").read_text(encoding="utf-8")
        spark=(SPARK/"partners.html").read_text(encoding="utf-8")
        for service,html in (("CARE",care),("SPARK",spark)):
            for field in ("company","website","name","email",
                          "listing_content_checked_at","listing_permission","trial_referral_consent"):
                with self.subTest(service=service,field=field):
                    self.assertRegex(html,r'name=["\']'+re.escape(field)+r'["\']')
            self.assertIn('name="service" value="'+service+'"',html)
            self.assertIn('type="date" name="listing_content_checked_at" required',html)
            self.assertIn("kosodatemate@gmail.com",html)
            self.assertIn('name="trial_referral_consent"',html)
        self.assertIn('id="listing-contact"',care)
        self.assertIn('id="partnerForm" hidden',spark)
        self.assertIn('name="掲載相談_個人情報取扱いへの同意"',spark)

    def test_analytics_has_distinct_non_personal_events(self):
        care=(ROOT/"index.html").read_text(encoding="utf-8")
        spark=(SPARK/"index.html").read_text(encoding="utf-8")
        contact=(ROOT/"contact.html").read_text(encoding="utf-8")
        for html in (care,spark,contact):
            self.assertIn(GA4_ID,html)
        self.assertIn("school_detail_view",spark)
        self.assertIn("school_outbound_click",spark)
        self.assertIn("school_compare",spark)
        self.assertIn("trial_inquiry_submit_attempt",spark)
        self.assertIn("listing_inquiry_submit_attempt",(SPARK/"partners.html").read_text(encoding="utf-8"))
        self.assertIn("generate_lead",(ROOT/"assets/contact.js").read_text(encoding="utf-8"))
        self.assertIn("provider_outbound",(ROOT/"assets/provider-search.js").read_text(encoding="utf-8"))

    def test_nexte_du_contacts_and_tracking_disclosures(self):
        for path in (ROOT/"privacy.html",SPARK/"privacy.html",ROOT/"operator.html",SPARK/"operator.html"):
            self.assertIn("NextEdu",path.read_text(encoding="utf-8"))
        self.assertIn("Google Analytics 4",(SPARK/"privacy.html").read_text(encoding="utf-8"))
        for path in (ROOT/"index.html",ROOT/"contact.html",SPARK/"index.html",SPARK/"partners.html"):
            self.assertIn("kosodatemate@gmail.com",(ROOT/"operator.html").read_text(encoding="utf-8"))
        self.assertIn("問い合わせ管理",(ROOT/"MATE_LAUNCH_OPERATIONS_20261023.md").read_text(encoding="utf-8"))

    def test_scripts_syntax(self):
        for p in (ROOT/"assets/provider-search.js",ROOT/"assets/contact.js"):
            r=subprocess.run(["node","--check"],input=p.read_text(encoding="utf-8"),text=True,capture_output=True)
            self.assertEqual(r.returncode,0,r.stderr)

if __name__=="__main__":
    unittest.main()
