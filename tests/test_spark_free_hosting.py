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
        self.assertNotIn('form.action=\'https://formsubmit.co/kosodatemate@gmail.com\'', html)
        self.assertIn("previewEnabled", html)
        self.assertIn('mate-direct-intake.js', html)
        cfg = (SPARK / "assets/mate-direct-intake-config.js").read_text(encoding="utf-8")
        self.assertIn("enabled: false", cfg)
        self.assertIn("firebaseapp.com", html)
        self.assertIn("netlify.app", html)
        self.assertIn('name="_honey"', html)
        self.assertIn('type="checkbox"', html)
        self.assertNotIn('name="_captcha" value="false"', html)

    def test_thank_you_no_claim_of_confirmed_delivery(self):
        html = (SPARK / "thanks.html").read_text(encoding="utf-8")
        self.assertIn("フォーム送信サービスでの処理が完了した場合", html)

    def test_real_trial_intake_remains_off(self):
        config = json.loads((SPARK / "config.json").read_text(encoding="utf-8"))
        self.assertFalse(config["applyEnabled"])

if __name__ == "__main__":
    unittest.main()
