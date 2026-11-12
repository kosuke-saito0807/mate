"""Guardrails for SEO release: avoid fictional listing claims and broken sitemap paths."""
import json
import re
import unittest
import xml.etree.ElementTree as ET
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]

class SeoLaunchTests(unittest.TestCase):
    def test_founder_search_identity_and_cross_service_links(self):
        operator=(ROOT/"operator.html").read_text(encoding="utf-8")
        self.assertIn("斎藤幸輔",operator)
        self.assertIn("Kosuke Saito",operator)
        self.assertIn("<title>斎藤幸輔",operator)
        self.assertIn('<link rel="canonical" href="https://care.kosodatemate.jp/operator.html">',operator)
        blocks=re.findall(r'<script type="application/ld\+json">(.*?)</script>',operator,re.S)
        self.assertEqual(len(blocks),1)
        data=json.loads(blocks[0])
        self.assertEqual(data["@type"],"ProfilePage")
        self.assertEqual(data["mainEntity"]["name"],"斎藤幸輔")
        self.assertEqual(data["mainEntity"]["url"],"https://care.kosodatemate.jp/operator.html")
        for path in ("index.html","spark/index.html","spark/operator.html"):
            html=(ROOT/path).read_text(encoding="utf-8")
            self.assertIn("斎藤幸輔",html,path)
            self.assertIn("operator.html",html,path)
        llms=(ROOT/"llms.txt").read_text(encoding="utf-8")
        self.assertIn("斎藤幸輔",llms)

    def test_home_canonicals_and_structured_data(self):
        for rel, url in [
            ("index.html", "https://care.kosodatemate.jp/"),
            ("spark/index.html", "https://spark.kosodatemate.jp/"),
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

    def test_business_application_pages_are_searchable_and_interlinked(self):
        pages = {
            "contact.html": ("https://care.kosodatemate.jp/contact.html", "MATE CARE", "name=\"service\" value=\"CARE\""),
            "partners.html": ("https://care.kosodatemate.jp/partners.html", "MATE CARE", "掲載条件・料金"),
            "spark/partners.html": ("https://spark.kosodatemate.jp/partners.html", "MATE SPARK", "name=\"service\" value=\"SPARK\""),
            "play-listing.html": ("https://care.kosodatemate.jp/play-listing.html", "MATE PLAY", "name=\"service\" value=\"PLAY\""),
        }
        for path, (canonical, service, marker) in pages.items():
            with self.subTest(page=path):
                html = (ROOT / path).read_text(encoding="utf-8")
                self.assertIn('<link rel="canonical" href="' + canonical + '">', html)
                self.assertEqual(html.count('rel="canonical"'), 1)
                self.assertIn('<meta name="description" content="', html)
                self.assertIn('<meta name="robots" content="index,follow,max-image-preview:large">', html)
                self.assertIn('<meta property="og:url" content="' + canonical + '">', html)
                self.assertIn('<meta property="og:site_name" content="' + service + '">', html)
                self.assertIn('<meta name="twitter:card" content="summary_large_image">', html)
                self.assertIn(marker, html)
                self.assertNotIn('http://spark.kosodatemate.jp', html)
        for path in ("contact.html", "spark/partners.html", "play-listing.html"):
            html = (ROOT / path).read_text(encoding="utf-8")
            self.assertIn("他のサービスへの掲載申請" if path == "spark/partners.html" else "MATEサービスと運営情報", html)
            self.assertIn("https://care.kosodatemate.jp/contact.html", html)
            self.assertIn("https://spark.kosodatemate.jp/partners.html", html)
            self.assertIn("https://care.kosodatemate.jp/play-listing.html", html)

    def test_shared_play_application_is_in_its_actual_host_sitemap(self):
        xml = (ROOT / "sitemap.xml").read_text(encoding="utf-8")
        self.assertIn("<loc>https://care.kosodatemate.jp/play-listing.html</loc>", xml)
        self.assertNotIn("<loc>https://play.kosodatemate.jp/play-listing.html</loc>", xml)
        # PLAY's production site is maintained in a separate, manually released
        # Firebase project; this shared form must not be mistaken for that SPA.
        self.assertNotIn("https://play.kosodatemate.jp/", xml)

    def test_sitemaps_only_include_real_public_pages(self):
        for rel, base, directory in [
            ("sitemap.xml", "https://care.kosodatemate.jp/", ROOT),
            ("spark/sitemap.xml", "https://spark.kosodatemate.jp/", ROOT / "spark"),
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

    def test_new_family_guides_are_published_safely(self):
        additions={
            "guide-sitter-first-visit.html":"https://care.kosodatemate.jp/",
            "guide-baby-outing-prep.html":"https://care.kosodatemate.jp/",
            "spark/guide-lesson-trial-review.html":"https://spark.kosodatemate.jp/",
            "guide-sitter-fees-check.html":"https://care.kosodatemate.jp/",
            "guide-weekend-family-event.html":"https://care.kosodatemate.jp/",
            "spark/guide-lesson-age-fit.html":"https://spark.kosodatemate.jp/",
        }
        index=(ROOT/"guides.html").read_text(encoding="utf-8")
        care_map=(ROOT/"sitemap.xml").read_text(encoding="utf-8")
        spark_map=(ROOT/"spark/sitemap.xml").read_text(encoding="utf-8")
        for rel,base in additions.items():
            with self.subTest(path=rel):
                text=(ROOT/rel).read_text(encoding="utf-8")
                url=base+rel.removeprefix("spark/")
                self.assertIn('<link rel="canonical" href="'+url+'">',text)
                self.assertIn('<meta name="robots" content="index,follow,max-image-preview:large">',text)
                self.assertIn('application/ld+json',text)
                self.assertIn('G-CHXY0DC2WP',text)
                self.assertIn("<h1>",text)
                self.assertIn("<loc>"+url+"</loc>",spark_map if rel.startswith("spark/") else care_map)
                self.assertIn(rel.removeprefix("spark/"),index)
                self.assertNotIn("架空の掲載実績",text)

    def test_internal_qa_pages_do_not_index(self):
        for name in ("direct-intake-test-20261025.html", "play-direct-intake-test-20261025.html"):
            self.assertIn('content="noindex,nofollow,noarchive"', (ROOT / name).read_text(encoding="utf-8"))

    def test_deploy_bundles_care_sitemap(self):
        workflow = (ROOT / ".github/workflows/pages.yml").read_text(encoding="utf-8")
        # Match the required public files without locking the test to the exact
        # command text; llms.txt can be added without breaking deployment.
        self.assertIn("cp *.html data.json robots.txt sitemap.xml ", workflow)
        self.assertIn("llms.txt", workflow)
        robots=(ROOT / "robots.txt").read_text(encoding="utf-8")
        self.assertIn("Sitemap: https://care.kosodatemate.jp/sitemap.xml", robots)
        self.assertNotIn("Disallow: /\\n",robots)

if __name__ == "__main__":
    unittest.main()
