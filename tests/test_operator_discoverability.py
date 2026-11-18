"""Checks that CARE's public operator identity remains crawlable and grounded."""
import json
import re
import unittest
from pathlib import Path
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]

class OperatorDiscoverabilityTests(unittest.TestCase):
    def test_profile_and_homepage_identity_links(self):
        page = (ROOT / "operator.html").read_text(encoding="utf-8")
        home = (ROOT / "index.html").read_text(encoding="utf-8")
        self.assertIn("<h1>斎藤幸輔", page)
        self.assertIn("斎藤幸輔（Kosuke Saito）", page)
        self.assertIn('rel="canonical" href="https://care.kosodatemate.jp/operator.html"', page)
        self.assertIn("斎藤幸輔（Kosuke Saito）のプロフィール", home)
        self.assertIn('href="operator.html"', home)
        self.assertIn("index,follow", page)

    def test_schema_links_to_grounded_public_coverage(self):
        page = (ROOT / "operator.html").read_text(encoding="utf-8")
        match = re.search(r'<script type="application/ld\+json">([\s\S]*?)</script>', page)
        self.assertIsNotNone(match)
        schema = json.loads(match.group(1))
        self.assertEqual(schema["@type"], "ProfilePage")
        self.assertEqual(schema["mainEntity"]["name"], "斎藤幸輔")
        self.assertEqual(schema["mainEntity"]["@id"], "https://care.kosodatemate.jp/operator.html#founder")
        self.assertGreaterEqual(len(schema["mainEntity"]["subjectOf"]), 3)

    def test_operator_page_in_sitemap(self):
        urls = [x.text for x in ET.parse(ROOT / "sitemap.xml").findall(".//{http://www.sitemaps.org/schemas/sitemap/0.9}loc")]
        self.assertIn("https://care.kosodatemate.jp/operator.html", urls)

if __name__ == "__main__":
    unittest.main()
