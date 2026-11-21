"""Regression checks for factual, crawlable MATE non-brand discovery guides."""
from pathlib import Path
from xml.etree import ElementTree as ET
import json
import re
import unittest

ROOT = Path(__file__).resolve().parents[1]

class NonbrandGuideTests(unittest.TestCase):
    CASES = (
        ("guide-sitter-vs-daycare.html", "sitemap.xml", "index.html", "https://care.kosodatemate.jp/guide-sitter-vs-daycare.html"),
        ("spark/guide-programming-class-choice.html", "spark/sitemap.xml", "spark/index.html", "https://spark.kosodatemate.jp/guide-programming-class-choice.html"),
        ("guide-tokyo-babysitter-choice.html", "sitemap.xml", "index.html", "https://care.kosodatemate.jp/guide-tokyo-babysitter-choice.html"),
        ("spark/guide-tokyo-kids-classes.html", "spark/sitemap.xml", "spark/index.html", "https://spark.kosodatemate.jp/guide-tokyo-kids-classes.html"),
    )
    def test_guides_have_indexable_source_and_real_navigation(self):
        hub = (ROOT / "guides.html").read_text(encoding="utf-8")
        for page, sitemap, home, url in self.CASES:
            with self.subTest(page=page):
                source = (ROOT / page).read_text(encoding="utf-8")
                self.assertIn('<meta name="robots" content="index,follow', source)
                self.assertIn(f'<link rel="canonical" href="{url}">', source)
                self.assertIn("<h1>", source)
                self.assertIn("公式", source)
                self.assertIn('<script type="application/ld+json">', source)
                raw_json = source.split('<script type="application/ld+json">', 1)[1].split('</script>', 1)[0]
                data = json.loads(raw_json)
                self.assertEqual(data["@type"], "Article")
                self.assertEqual(data["mainEntityOfPage"], url)
                urls = [loc.text for loc in ET.parse(ROOT / sitemap).iter() if loc.tag.endswith("}loc")]
                self.assertIn(url, urls)
                self.assertIn(Path(page).name, (ROOT / home).read_text(encoding="utf-8"))
                self.assertIn(Path(page).name, hub)
                llms = ROOT / ('spark/llms.txt' if page.startswith('spark/') else 'llms.txt')
                self.assertIn(url, llms.read_text(encoding='utf-8'))
    def test_tokyo_examples_match_public_unapproved_editorial_sources(self):
        cases = (
            ("guide-tokyo-babysitter-choice.html", "editorial-care.json",
             ("https://akamon-mammy.com", "https://byojihoiku.florence.or.jp", "https://smartsitter.jp")),
            ("spark/guide-tokyo-kids-classes.html", "spark/editorial-schools.json",
             ("https://arschool.co.jp/", "https://gajyuku.com/", "https://www.rox.co.jp/kids_education/")),
        )
        for page, source, urls in cases:
            with self.subTest(page=page):
                html = (ROOT / page).read_text(encoding="utf-8")
                records = json.loads((ROOT / source).read_text(encoding="utf-8"))
                by_url = {str(row.get("url", "")).rstrip("/"): row for row in records}
                for url in urls:
                    self.assertIn(url, html)
                    row = by_url.get(url.rstrip("/"))
                    self.assertIsNotNone(row, url)
                    self.assertEqual(row["region"], "東京都")
                    self.assertIs(row["editorial"], True)
                    self.assertIs(row["approved"], False)
                self.assertIn("事業者による掲載承認", html) if page.startswith("guide-") else self.assertIn("事業者による掲載承認", html)

if __name__ == "__main__":
    unittest.main()
