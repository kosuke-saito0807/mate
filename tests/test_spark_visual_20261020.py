"""Validate SPARK's custom hero, accessible listing, links and SEO documents."""
import re
import subprocess
import unittest
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / "spark"


class SparkVisualOctoberTests(unittest.TestCase):
    def test_hero_is_accessible_local_asset(self):
        page = (SITE / "index.html").read_text(encoding="utf-8")
        self.assertIn('src="hero-family-robot.svg"', page)
        self.assertIn('class="hero-visual"', page)
        self.assertIn("子どもが大人二人と一緒にロボットづくり", page)
        svg = ET.parse(SITE / "hero-family-robot.svg").getroot()
        self.assertTrue(svg.tag.endswith("svg"))
        self.assertIn("viewBox", svg.attrib)

    def test_search_and_comparison_details(self):
        page = (SITE / "index.html").read_text(encoding="utf-8")
        for s in ("対象：", "体験料金：要確認", "開催曜日：", 'aria-pressed',
                  "s.tags||[]", 'id="detailDialog"', 'id="trialDialog"',
                  "demoMode", "体験料金が安い順", "体験日が近い順"):
            with self.subTest(s=s):
                self.assertIn(s, page)
        js = re.search(r"<script>([\s\S]*?)</script>", page).group(1)
        check = subprocess.run(["node", "--check"], text=True, input=js, capture_output=True)
        self.assertEqual(check.returncode, 0, check.stderr)

    def test_marketing_meta_and_sitemap(self):
        page = (SITE / "index.html").read_text(encoding="utf-8")
        self.assertIn('<link rel="canonical" href="https://mate-spark.web.app/">', page)
        sitemap = ET.parse(SITE / "sitemap.xml").getroot()
        locations = [x.text for x in sitemap.iter() if x.tag.endswith("loc")]
        self.assertIn("https://mate-spark.web.app/", locations)
        robots = (SITE / "robots.txt").read_text(encoding="utf-8")
        self.assertIn("Sitemap: https://mate-spark.web.app/sitemap.xml", robots)
        self.assertIn("Disallow: /demo-schools.json", robots)
        self.assertIn('id="inquiry"', (SITE / "operator.html").read_text(encoding="utf-8"))

    def test_sample_is_not_represented_as_real(self):
        page = (SITE / "index.html").read_text(encoding="utf-8")
        self.assertIn("架空サンプル", page)
        self.assertIn("s.approved===true&&s.acceptsTrial===true", page)
        self.assertIn("!demoMode", page)


if __name__ == "__main__":
    unittest.main()
