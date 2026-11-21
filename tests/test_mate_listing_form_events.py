"""Protect anonymous partner application funnel instrumentation."""
from pathlib import Path
import shutil
import subprocess
import unittest

ROOT = Path(__file__).resolve().parents[1]

class ListingFormFunnelTests(unittest.TestCase):
    def test_all_three_forms_load_the_local_tracker(self):
        for path in ("contact.html", "spark/partners.html", "play-listing.html"):
            with self.subTest(path=path):
                html = (ROOT / path).read_text(encoding="utf-8")
                self.assertIn('data-mate-direct-listing="true"', html)
                self.assertIn('src="assets/mate-listing-form-events.js"', html)
                self.assertTrue((ROOT / path).parent.joinpath("assets/mate-listing-form-events.js").exists())

    def test_anonymous_events_are_not_conversions(self):
        care = (ROOT / "assets/mate-listing-form-events.js").read_text(encoding="utf-8")
        spark = (ROOT / "spark/assets/mate-listing-form-events.js").read_text(encoding="utf-8")
        self.assertEqual(care, spark)
        for name in ("mate_listing_form_start", "mate_listing_validation_block", "mate_listing_submit_attempt"):
            self.assertIn(name, care)
        for forbidden in ("formData", "FormData(", "email:", "phone:", "search_term:", "field.value", "event.target.value"):
            self.assertNotIn(forbidden, care)
        self.assertNotIn("mate_listing_form_success", care)
        if shutil.which("node"):
            for path in ("assets/mate-listing-form-events.js", "spark/assets/mate-listing-form-events.js"):
                subprocess.run(["node", "--check", str(ROOT / path)], check=True, capture_output=True, text=True)

    def test_email_consult_click_has_separate_handler(self):
        content = (ROOT / "business.html").read_text(encoding="utf-8")
        self.assertIn("target.closest('a[data-business-contact]')", content)
        self.assertIn("mate_business_contact_click", content)

if __name__ == "__main__":
    unittest.main()
