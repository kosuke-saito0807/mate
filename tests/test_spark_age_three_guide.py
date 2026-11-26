"""Regression checks for the original 3-year-old SPARK parent guide."""
import json
import re
import unittest
from pathlib import Path
from xml.etree import ElementTree

ROOT = Path(__file__).resolve().parents[1]
GUIDE = ROOT / "spark/guide-lessons-age-three.html"
URL = "https://spark.kosodatemate.jp/guide-lessons-age-three.html"


class SparkAgeThreeGuideTests(unittest.TestCase):
    def test_indexable_canonical_article_and_attribution(self):
        html = GUIDE.read_text(encoding="utf-8")
        self.assertIn('<html lang="ja">', html)
        self.assertIn('<meta name="robots" content="index,follow,max-image-preview:large">', html)
        self.assertEqual(html.count('<link rel="canonical" href="' + URL + '">'), 1)
        self.assertIn("<title>3歳から習い事を始める？", html)
        self.assertIn('<meta name="description"', html)
        self.assertIn("<h1>3歳から習い事を始める？", html)
        match = re.search(r'<script type="application/ld\+json">([^<]+)</script>', html)
        self.assertIsNotNone(match)
        data = json.loads(match.group(1))
        article = next(entry for entry in data["@graph"] if entry["@type"] == "Article")
        self.assertEqual(article["mainEntityOfPage"], URL)
        self.assertEqual(article["publisher"]["name"], "NextEdu")
        self.assertEqual(article["datePublished"], "2026-11-25")

    def test_parent_value_and_no_false_reservation_promises(self):
        html = GUIDE.read_text(encoding="utf-8")
        for item in ("親子分離", "振替", "年間費用", "初回体験", "公式サイト", "同伴", "講師との相性"):
            self.assertIn(item, html)
        self.assertIn('href="/#discover"', html)
        self.assertIn('href="https://care.kosodatemate.jp/consult.html?service=SPARK&amp;inquiry=age-three"', html)
        self.assertIn("相談は入会・予約の確定ではありません", html)
        self.assertIn("主催者が承認した掲載ではなく", html)
        self.assertNotIn("必ず効果があります", html)

    def test_home_and_related_article_link_to_public_guide(self):
        home = (ROOT / "spark/index.html").read_text(encoding="utf-8")
        two = (ROOT / "spark/guide-lessons-age-two.html").read_text(encoding="utf-8")
        self.assertIn('href="guide-lessons-age-three.html"', home)
        self.assertIn('href="guide-lessons-age-three.html"', two)
        hub = (ROOT / "guides.html").read_text(encoding="utf-8")
        llms = (ROOT / "llms.txt").read_text(encoding="utf-8")
        self.assertEqual(hub.count('href="' + URL + '"'), 1)
        self.assertIn("3歳の習い事を始める？", hub)
        self.assertIn("年間費用", hub)
        self.assertIn("各教室の公式条件", hub)
        self.assertEqual(llms.count("](" + URL + ")"), 1)
        self.assertIn("相談は予約・入会ではない", llms)
        self.assertIn('href="guide-lessons-age-two.html"', GUIDE.read_text(encoding="utf-8"))
        sitemap = ElementTree.parse(ROOT / "spark/sitemap.xml")
        locs = [v.text for v in sitemap.iter() if v.tag.endswith("loc")]
        self.assertIn(URL, locs)
        self.assertEqual(locs.count(URL), 1)


if __name__ == "__main__":
    unittest.main()
