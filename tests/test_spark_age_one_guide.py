"""Ground the public 1-year-old SPARK guide in crawlable, safe, real navigation."""
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit
from xml.etree import ElementTree as ET
import json
import re
import unittest

ROOT = Path(__file__).resolve().parents[1]
SPARK = ROOT / "spark"
PAGE = SPARK / "guide-lessons-age-one.html"
URL = "https://spark.kosodatemate.jp/guide-lessons-age-one.html"

class _Tags(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links = []
        self.h1 = 0
        self.canonicals = []
        self.meta = {}
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "a":
            self.links.append(attrs.get("href", ""))
        if tag == "h1":
            self.h1 += 1
        if tag == "link" and attrs.get("rel") == "canonical":
            self.canonicals.append(attrs.get("href"))
        if tag == "meta" and "name" in attrs:
            self.meta[attrs["name"]] = attrs.get("content", "")

class AgeOneGuideContract(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.html = PAGE.read_text(encoding="utf-8")
        cls.tags = _Tags()
        cls.tags.feed(cls.html)

    def test_unique_search_metadata_and_article_schema(self):
        self.assertEqual(self.tags.h1, 1)
        self.assertEqual(self.tags.canonicals, [URL])
        self.assertIn("index,follow", self.tags.meta.get("robots", ""))
        self.assertIn("1歳", self.tags.meta.get("description", ""))
        self.assertGreater(len(self.html), 6500)
        match = re.search(r'<script type="application/ld\\+json">(.*?)</script>', self.html, re.S)
        self.assertIsNotNone(match)
        graph = json.loads(match.group(1))["@graph"]
        self.assertEqual({item["@type"] for item in graph}, {"Article", "BreadcrumbList"})
        article = next(item for item in graph if item["@type"] == "Article")
        self.assertEqual(article["mainEntityOfPage"], URL)
        self.assertEqual(article["author"]["name"], "NextEdu")
        self.assertNotIn("Course", {item["@type"] for item in graph})
        self.assertNotIn("Event", {item["@type"] for item in graph})

    def test_external_safety_sources_and_no_fake_approval(self):
        self.assertIn("https://www.cfa.go.jp/policies/child-safety-actions/handbook/content-1/", self.tags.links)
        self.assertIn("https://www.meti.go.jp/product_safety/kodomo/kodomopsc.html", self.tags.links)
        self.assertIn("https://www.cfa.go.jp/policies/hoiku/hello_mirai/try/1", self.tags.links)
        self.assertIn("事業者未承認・非提携", self.html)
        self.assertIn("予約や参加を保証しません", self.html)
        self.assertIn("親子教室", self.html)
        self.assertIn("おむつ替え", self.html)
        self.assertIn("誤飲", self.html)
        self.assertNotIn("#claim=editorial-", self.html)
        self.assertNotIn("正式掲載を申請する", self.html)
        self.assertNotIn("<form", self.html)

    def test_sitemap_and_internal_discovery_paths(self):
        root = ET.parse(SPARK / "sitemap.xml").getroot()
        urls = [n.text for n in root.iter() if n.tag.endswith("loc")]
        self.assertEqual(urls.count(URL), 1)
        for p in ("index.html", "guide-lessons-age-two.html", "guide-lesson-age-fit.html", "llms.txt"):
            self.assertIn("guide-lessons-age-one.html", (SPARK / p).read_text(encoding="utf-8"))
        self.assertIn(URL, (SPARK / "llms.txt").read_text(encoding="utf-8"))
        for link in self.tags.links:
            if not link or link.startswith(("#", "/", "mailto:")):
                continue
            parsed = urlsplit(link)
            if parsed.scheme:
                self.assertEqual(parsed.scheme, "https")
                continue
            self.assertTrue((SPARK / parsed.path).is_file(), f"Missing internal target {link}")

    def test_conversion_is_consultation_not_booking(self):
        self.assertIn("https://care.kosodatemate.jp/consult.html?service=SPARK&amp;inquiry=age-one", self.html)
        self.assertIn("相談は予約・入会・事業者への自動取次ぎではありません", self.html)
        self.assertIn("https://play.kosodatemate.jp/guide-baby-first-experience", self.html)
        self.assertIn("G-CHXY0DC2WP", self.html)

if __name__ == "__main__":
    unittest.main()
