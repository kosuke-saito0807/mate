"""Guardrails for SEO release: avoid fictional listing claims and broken sitemap paths."""
import json
import re
import unittest
import xml.etree.ElementTree as ET
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]

class SeoLaunchTests(unittest.TestCase):
    def test_home_canonicals_and_structured_data(self):
        for rel, url in [
            ("index.html", "https://kosuke-saito0807.github.io/mate/"),
            ("spark/index.html", "https://mate-spark.web.app/"),
        ]:
            with self.subTest(path=rel):
                html = (ROOT / rel).read_text(encoding="utf-8")
                self.assertIn('<link rel="canonical" href="' + url + '">', html)
                self.assertIn('<meta property="og:url" content="' + url + '">', html)
                self.assertIn('<meta name="robots" content="index,follow,max-image-preview:large">', html)
                matches = re.findall(r'<script type="application/ld\+json">(.*?)</script>', html, re.S)
                self.assertEqual(len(matches), 1)
                obj = json.loads(matches[0])
                self.assertEqual(obj["@type"], "WebSite")
                self.assertEqual(obj["url"], url)
                self.assertEqual(obj["publisher"]["name"], "NextEdu")
                self.assertNotIn('"Review"', matches[0])
                self.assertNotIn('"LocalBusiness"', matches[0])

    def test_sitemaps_only_include_real_public_pages(self):
        for rel, base, directory in [
            ("sitemap.xml", "https://kosuke-saito0807.github.io/mate/", ROOT),
            ("spark/sitemap.xml", "https://mate-spark.web.app/", ROOT / "spark"),
        ]:
            with self.subTest(path=rel):
                root = ET.fromstring((ROOT / rel).read_text(encoding="utf-8"))
                ns = {"m": "http://www.sitemaps.org/schemas/sitemap/0.9"}
                urls = [x.text for x in root.findall(".//m:loc", ns)]
                self.assertIn(base, urls)
                self.assertEqual(len(urls), len(set(urls)))
                for url in urls:
                    self.assertTrue(url.startswith(base), url)
                    relpath = url.removeprefix(base) or "index.html"
                    self.assertTrue((directory / relpath).is_file(), url)
                    self.assertNotIn("demo", url)
                    self.assertNotIn("test-", url)
        self.assertIn("guide-sitter-choice.html", (ROOT / "index.html").read_text(encoding="utf-8"))
        self.assertIn("guide-lessons-choice.html", (ROOT / "spark/index.html").read_text(encoding="utf-8"))

    def test_internal_qa_pages_do_not_index(self):
        for name in ("direct-intake-test-20261025.html", "play-direct-intake-test-20261025.html"):
            self.assertIn('content="noindex,nofollow,noarchive"', (ROOT / name).read_text(encoding="utf-8"))

    def test_deploy_bundles_care_sitemap(self):
        workflow = (ROOT / ".github/workflows/pages.yml").read_text(encoding="utf-8")
        self.assertIn("cp *.html data.json robots.txt sitemap.xml favicon.svg favicon.ico _site/", workflow)
        robots=(ROOT / "robots.txt").read_text(encoding="utf-8")
        self.assertIn("Sitemap: https://kosuke-saito0807.github.io/mate/sitemap.xml", robots)
        self.assertNotIn("Disallow: /\\n",robots)

if __name__ == "__main__":
    unittest.main()
