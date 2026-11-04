"""Static regression checks for the MATE three-service listing consent gate.
These tests never send requests to GAS or contact real applicants.
"""
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parents[1]

class ListingTermsGateTest(unittest.TestCase):
    def test_three_form_consents_are_explicit(self):
        for rel in ("contact.html", "spark/partners.html", "play-listing.html"):
            with self.subTest(page=rel):
                source = (ROOT / rel).read_text(encoding="utf-8")
                self.assertRegex(source, r'<input[^>]+name="listing_terms_agree"[^>]+required')
                self.assertIn('name="agreement_version" value="2026-11-04-v1"', source)
                self.assertIn('listing-terms.html', source)
                self.assertIn('data-mate-direct-listing="true"', source)
                self.assertIn('name="listing_permission"', source)
    def test_free_terms_are_not_auto_paid(self):
        s=(ROOT / "listing-terms.html").read_text(encoding="utf-8")
        self.assertIn("無料掲載", s)
        self.assertIn("自動で有料へ移行しません", s)
        self.assertIn("申込みの不承諾", s)

if __name__ == "__main__":
    unittest.main()
