from pathlib import Path
import re
import unittest
from html.parser import HTMLParser

ROOT = Path(__file__).resolve().parent.parent

class PublicGuideTest(unittest.TestCase):
    def test_editorial_guide_is_separate_from_approved_listings(self):
        html = (ROOT / "public-guide.html").read_text(encoding="utf-8")
        for marker in ("事業者未確認", "正式掲載", "MATE編集部", "修正・削除", "kosodatemate@gmail.com"):
            self.assertIn(marker, html)
        self.assertIn('<link rel="canonical" href="https://care.kosodatemate.jp/public-guide.html">', html)
        self.assertIn('"@type":"CollectionPage"', html)
        self.assertNotIn('"@type":"LocalBusiness"', html)
        self.assertNotIn('"@type":"Review"', html)
        self.assertNotIn('"@type":"AggregateRating"', html)
        self.assertNotIn("<img ", html)
        self.assertNotIn("approved:true", html)
        self.assertEqual(html.count('公式情報参考・事業者未確認'), 16)
        for official in ("https://www.marypoppins.co.jp/", "https://arschool.co.jp/", "https://muumuu.jp/"):
            self.assertIn(official, html)
        self.assertIn("事業者が申請・承認した", html)
        self.assertIn("現在16事業者の公式情報", html)
        for anchor in ("honeyclover", "joysitter", "ikuji119", "teno", "codinglab", "bitschool", "gajyuku", "akiba-programming", "arihana", "sorai", "mugenan", "casane", "shirokane"):
            self.assertIn(f'<article id="{anchor}">', html)
        self.assertIn("提携・許諾・保証・推薦を意味せず", html)

    def test_discovery_and_correction_navigation(self):
        self.assertIn("public-guide.html", (ROOT / "sitemap.xml").read_text(encoding="utf-8"))
        for filename in ("index.html", "spark/index.html", "business.html"):
            self.assertIn("public-guide.html", (ROOT / filename).read_text(encoding="utf-8"))
        self.assertIn("business.html", (ROOT / "public-guide.html").read_text(encoding="utf-8"))

if __name__ == "__main__":
    unittest.main()
