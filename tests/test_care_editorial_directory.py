"""Regression checks for crawlable CARE editorial directory and provider source data."""
import json
import re
import unittest
from pathlib import Path
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]

class CareEditorialDirectoryTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.providers = json.loads((ROOT / "editorial-care.json").read_text(encoding="utf-8"))
        cls.directory = (ROOT / "sitter-directory.html").read_text(encoding="utf-8")
        cls.index = (ROOT / "index.html").read_text(encoding="utf-8")
        cls.llms = (ROOT / "llms.txt").read_text(encoding="utf-8")

    def test_unapproved_references_have_unique_ids_and_sources(self):
        ids = [p["id"] for p in self.providers]
        self.assertEqual(len(ids), len(set(ids)))
        for p in self.providers:
            with self.subTest(provider=p["id"]):
                self.assertIs(p["editorial"], True)
                self.assertIs(p["approved"], False)
                self.assertTrue(p["url"].startswith("https://"))

    def test_all_references_have_crawlable_html_cards(self):
        cards = re.findall(r'<article class="provider" id="([^"]+)"', self.directory)
        self.assertEqual(set(cards), {p["id"] for p in self.providers})
        self.assertEqual(len(cards), len(self.providers))
        self.assertEqual(self.directory.count('class="directory-thumb"'), len(self.providers))
        for p in self.providers:
            with self.subTest(thumbnail=p["id"]):
                self.assertIn('assets/editorial-thumbnails/care/'+p["id"]+'.webp', self.directory)

    def test_json_ld_matches_source_count(self):
        match = re.search(r'<script type="application/ld\+json">([\s\S]*?)</script>', self.directory)
        self.assertIsNotNone(match)
        graph = json.loads(match.group(1))["@graph"]
        item_list = next(x for x in graph if x["@type"] == "ItemList")
        self.assertEqual(item_list["numberOfItems"], len(self.providers))
        self.assertEqual(len(item_list["itemListElement"]), len(self.providers))
        self.assertEqual([x["position"] for x in item_list["itemListElement"]], list(range(1, len(self.providers)+1)))

    def test_findable_from_home_and_ai_guide(self):
        self.assertIn('href="sitter-directory.html"', self.index)
        self.assertIn("sitter-directory.html", self.llms)
        urls = [el.text for el in ET.parse(ROOT / "sitemap.xml").findall(".//{http://www.sitemaps.org/schemas/sitemap/0.9}loc")]
        self.assertIn("https://care.kosodatemate.jp/sitter-directory.html", urls)
        self.assertIn("事業者未承認の参考紹介", self.directory)

if __name__ == "__main__":
    unittest.main()
