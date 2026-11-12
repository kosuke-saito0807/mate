"""Static regression checks for public MATE discovery and safe inquiry intake.

No network calls, form submission, publication, or sales messages.
"""
import json
import re
import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]

class MateAiReleaseTests(unittest.TestCase):
    def test_llms_guide_is_publicly_packaged_and_links_to_real_pages(self):
        workflow=(ROOT/".github/workflows/pages.yml").read_text(encoding="utf-8")
        self.assertRegex(workflow,r"cp [^\n]*llms\.txt [^\n]*_site/")
        for rel, domain in (
            ("llms.txt","care.kosodatemate.jp"),
            ("spark/llms.txt","spark.kosodatemate.jp"),
        ):
            text=(ROOT/rel).read_text(encoding="utf-8")
            self.assertIn(domain,text)
            self.assertIn("https://",text)
            self.assertNotIn("個人メール",text)

    def test_application_and_consultation_pages_have_factual_structured_data(self):
        pages={
            "contact.html":("WebPage","https://care.kosodatemate.jp/contact.html"),
            "spark/partners.html":("WebPage","https://spark.kosodatemate.jp/partners.html"),
            "play-listing.html":("WebPage","https://care.kosodatemate.jp/play-listing.html"),
            "consult.html":("ContactPage","https://care.kosodatemate.jp/consult.html"),
        }
        for rel,(kind,canonical) in pages.items():
            with self.subTest(path=rel):
                html=(ROOT/rel).read_text(encoding="utf-8")
                self.assertIn('rel="canonical" href="'+canonical+'"',html)
                blocks=re.findall(r'<script type="application/ld\+json">(.*?)</script>',html,re.S)
                self.assertEqual(len(blocks),1)
                payload=json.loads(blocks[0])
                self.assertEqual(payload["@type"],kind)
                self.assertEqual(payload["url"],canonical)
                self.assertEqual(payload["publisher"]["name"],"NextEdu")
                self.assertNotIn('"AggregateRating"',blocks[0])
                self.assertNotIn('"Review"',blocks[0])

    def test_listing_forms_remain_review_gated(self):
        for rel,service in (
            ("contact.html","CARE"),
            ("spark/partners.html","SPARK"),
            ("play-listing.html","PLAY"),
        ):
            with self.subTest(service=service):
                html=(ROOT/rel).read_text(encoding="utf-8")
                self.assertIn('name="service" value="'+service+'"',html)
                self.assertIn('data-mate-direct-listing="true"',html)
                self.assertIn('name="listing_permission"',html)

if __name__=="__main__":unittest.main()
