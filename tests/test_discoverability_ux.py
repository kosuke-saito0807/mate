"""Public MATE user experience, information architecture and rich content audit."""
from pathlib import Path
from xml.etree import ElementTree as ET
import json,re,unittest
ROOT=Path(__file__).resolve().parents[1]
PAGES={
 "index.html":"CARE","spark/index.html":"SPARK","guide-sitter-choice.html":"CARE",
 "guide-family-outing.html":"PLAY","spark/guide-lessons-choice.html":"SPARK",
 "guides.html":"MATE",
}
GUIDES={"guide-sitter-choice.html","guide-family-outing.html","spark/guide-lessons-choice.html"}
def src(path):return (ROOT/path).read_text(encoding="utf-8")
class DiscoveryQuality(unittest.TestCase):
 def test_ux_baseline_and_keyboard_skip(self):
  for path in PAGES:
   with self.subTest(path=path):
    s=src(path)
    self.assertIn('class="mate-skip"',s)
    self.assertIn('id="main-content"',s)
    self.assertIn('href="#main-content"',s)
    self.assertIn('mate-ux.css',s)
    self.assertEqual(len(re.findall(r'<h1(?:\s|>)',s)),1)
    self.assertIn('rel="canonical"',s)
    self.assertIn('name="description"',s)
 def test_all_guides_have_accurate_og_article_and_links(self):
  for path in GUIDES:
   with self.subTest(path=path):
    s=src(path)
    self.assertIn('class="mate-breadcrumb"',s)
    self.assertIn('class="mate-related"',s)
    self.assertIn('https://care.kosodatemate.jp/guides.html',s)
    matches=re.findall(r'<script type="application/ld\+json">(.+?)</script>',s,re.S)
    self.assertEqual(len(matches),1)
    graph=json.loads(matches[0])
    self.assertEqual({x["@type"] for x in graph},{"Article","BreadcrumbList"})
    self.assertEqual(graph[0]["publisher"]["name"],"NextEdu")
    self.assertIn('datePublished',graph[0])
    self.assertIn('og:image',s)
  play=src("guide-family-outing.html")
  meta=re.search(r'<meta property="og:description" content="([^"]+)">',play)
  self.assertIsNotNone(meta)
  self.assertIn("お出かけ",meta.group(1))
  self.assertNotIn("ベビーシッター",meta.group(1))
 def test_hub_and_sitemaps(self):
  hub=src("guides.html")
  for path in ("guide-sitter-choice.html","guide-family-outing.html","https://mate-spark.web.app/guide-lessons-choice.html"):
   self.assertIn(path,hub)
  for sitemap,prefix in (("sitemap.xml","https://care.kosodatemate.jp/"),("spark/sitemap.xml","https://mate-spark.web.app/")):
   tree=ET.fromstring(src(sitemap))
   urls=[e.text for e in tree.iter() if e.tag.endswith("loc")]
   self.assertEqual(len(urls),len(set(urls)))
   for url in urls:
    self.assertTrue(url.startswith(prefix),url)
    rel=url.removeprefix(prefix)
    self.assertTrue((ROOT/("spark/" if sitemap.startswith("spark") else "")/(rel or "index.html")).is_file(),url)
  self.assertIn("guides.html",src("sitemap.xml"))
 def test_test_pages_and_fake_listings_not_search_targets(self):
  self.assertIn("Disallow: /demo-schools.json",src("spark/robots.txt"))
  self.assertNotIn("demo-schools.json",src("spark/sitemap.xml"))
  self.assertNotIn("mate-play-test.web.app",src("sitemap.xml"))
 def test_same_accessible_focus_and_motion(self):
  for path in ("assets/mate-ux.css","spark/mate-ux.css"):
   s=src(path)
   self.assertIn(":focus-visible",s)
   self.assertIn("prefers-reduced-motion",s)
   self.assertIn("44px",s)
if __name__=="__main__":unittest.main()
