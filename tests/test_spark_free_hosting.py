import json
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SPARK = ROOT / "spark"

class FreeHostingTests(unittest.TestCase):
    def test_hosting_config(self):
        settings = json.loads((ROOT / "firebase.json").read_text(encoding="utf-8"))
        self.assertEqual(settings["hosting"]["public"], "spark")
        self.assertIn('publish = "spark"', (ROOT / "netlify.toml").read_text(encoding="utf-8"))

    def test_listing_intake_checks(self):
        html = (SPARK / "partners.html").read_text(encoding="utf-8")
        self.assertIn('id="partnerForm" data-mate-direct-listing="true" hidden', html)
        self.assertIn("previewEnabled", html)
        self.assertIn("assets/mate-direct-intake-config.js", html)
        self.assertIn("assets/mate-direct-intake.js", html)
        self.assertNotIn("form.action='https://formsubmit.co/", html)
        self.assertIn("firebaseapp.com", html)
        self.assertIn("netlify.app", html)
        self.assertIn('name="_honey"', html)
        self.assertIn('type="checkbox"', html)
        self.assertNotIn('name="_captcha" value="false"', html)

    def test_custom_production_hostname_shows_verified_listing_form(self):
        html = (SPARK / "partners.html").read_text(encoding="utf-8")
        self.assertIn("host==='spark.kosodatemate.jp'", html)
        self.assertIn("if(previewEnabled){form.hidden=false", html)
        config = (SPARK / "assets/mate-direct-intake-config.js").read_text(encoding="utf-8")
        self.assertIn("enabled: true", config)
        self.assertIn("https://script.google.com/macros/s/", config)
        self.assertIn("siteKey:", config)

    def test_partner_form_grid_alignment_on_desktop_and_mobile(self):
        html = (SPARK / "partners.html").read_text(encoding="utf-8")
        # Every field caption is a single accessible label child, including required stars.
        self.assertEqual(html.count('class="fieldName"'), 20)
        self.assertIn("grid-template-columns:repeat(2,minmax(0,1fr))", html)
        self.assertIn("grid-template-columns:minmax(0,1fr);gap:16px", html)
        self.assertIn(".formGrid .consent{display:grid;grid-template-columns:20px minmax(0,1fr)", html)
        self.assertIn(".formGrid .full{grid-column:1/-1;min-width:0}", html)
        self.assertIn(".formGrid input:not([type=checkbox]),.formGrid select{min-height:48px}", html)
        self.assertIn(".cta.send{display:block;width:100%", html)
        for field in ("company", "name", "email", "website", "region", "city", "category",
                      "ages", "description", "listing_content_checked_at"):
            self.assertRegex(html, r'class="fieldName"[^<]*.*?name="' + field + '"')

    def test_thank_you_no_claim_of_confirmed_delivery(self):
        html = (SPARK / "thanks.html").read_text(encoding="utf-8")
        self.assertIn("フォーム送信サービスでの処理が完了した場合", html)

    def test_real_trial_intake_remains_off(self):
        config = json.loads((SPARK / "config.json").read_text(encoding="utf-8"))
        self.assertFalse(config["applyEnabled"])

if __name__ == "__main__":
    unittest.main()
