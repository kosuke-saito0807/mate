"""Check GA4 tags identify each MATE service without leaking URL query strings."""
from pathlib import Path
import re
import unittest

ROOT=Path(__file__).resolve().parents[1]
MEASUREMENT_ID="G-CHXY0DC2WP"
PUBLIC={
 "index.html":"CARE", "contact.html":"CARE", "consult.html":"CARE/SPARK/PLAY",
 "guide-sitter-choice.html":"CARE", "play-listing.html":"PLAY",
 "spark/index.html":"SPARK", "spark/partners.html":"SPARK",
 "spark/guide-lessons-choice.html":"SPARK",
}
class GA4ReleaseTests(unittest.TestCase):
    def test_all_key_pages_have_a_single_tag_and_sanitized_url(self):
        for path,service in PUBLIC.items():
            with self.subTest(path=path):
                src=(ROOT/path).read_text(encoding="utf-8")
                self.assertIn("https://www.googletagmanager.com/gtag/js?id="+MEASUREMENT_ID,src)
                self.assertEqual(len(re.findall(r"gtag\((?:['\"])(?:config)(?:['\"])",src)),1)
                self.assertIn("page_location:location.origin+location.pathname",src)
                self.assertIn("page_referrer:document.referrer.split(/[?#]/)[0]",src)
                self.assertIn("allow_google_signals:false",src)
                self.assertIn("allow_ad_personalization_signals:false",src)
                self.assertNotIn("page_location:location.href",src)
                if service=="CARE/SPARK/PLAY":
                    self.assertIn("['CARE','SPARK','PLAY'].includes(new URLSearchParams(location.search).get('service'))",src)
                else:
                    self.assertIn("service:'"+service+"'",src)
    def test_no_pii_sourced_from_search_or_form_values(self):
        for path in PUBLIC:
            src=(ROOT/path).read_text(encoding="utf-8")
            self.assertNotIn("page_location:location.href",src)
            self.assertNotIn("page_location:document.URL",src)
    def test_search_guides_linked_from_home(self):
        self.assertIn('guide-sitter-choice.html',(ROOT/"index.html").read_text(encoding="utf-8"))
        self.assertIn('guide-lessons-choice.html',(ROOT/"spark/index.html").read_text(encoding="utf-8"))
if __name__=="__main__":unittest.main()
