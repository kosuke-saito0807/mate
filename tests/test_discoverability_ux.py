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
  for path in ("guide-sitter-choice.html","guide-family-outing.html","https://spark.kosodatemate.jp/guide-lessons-choice.html"):
   self.assertIn(path,hub)
  for sitemap,prefix in (("sitemap.xml","https://care.kosodatemate.jp/"),("spark/sitemap.xml","https://spark.kosodatemate.jp/")):
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
 def test_release_freshness_and_static_hosting_cache(self):
  care=src("index.html")
  spark=src("spark/index.html")
  self.assertIn("mate-brand-alignment.css?v=20261103-sales-ready-v16",care)
  self.assertIn("mate-brand-alignment.css?v=20261103-sales-ready-v16",spark)
  config=json.loads(src("firebase.json"))
  cache={x["source"]:x["headers"][0]["value"] for x in config["hosting"]["headers"] if x["headers"] and x["headers"][0]["key"]=="Cache-Control"}
  self.assertEqual(cache["/release.json"],"no-store, max-age=0")
  self.assertIn("must-revalidate",cache["**/*.html"])
  self.assertIn("_site/release.json",src(".github/workflows/pages.yml"))
  self.assertIn("spark/release.json",src(".github/workflows/firebase-spark-live.yml"))
  self.assertIn("MATE_FIREBASE_AUTO_DEPLOY_ENABLED",src(".github/workflows/firebase-spark-live.yml"))
  self.assertTrue((ROOT/"scripts/check_mate_live_sites.py").is_file())

 def test_mate_shared_visual_system(self):
  care=src("assets/mate-brand-alignment.css")
  spark=src("spark/mate-brand-alignment.css")
  for css in (care,spark):
   self.assertIn("MATE shared visual system v1",css)
   self.assertIn("--mate-ink:#073661",css)
   self.assertIn("--mate-blue:#0878ea",css)
   self.assertIn("--mate-radius:18px",css)
   self.assertIn("font-family:var(--mate-font)",css)
   self.assertIn("font-size:clamp(25px,2.25vw,30px)",css)
  self.assertIn("grid-template-columns: repeat(4,minmax(0,1fr))",care)
  self.assertIn("aspect-ratio:3/2",spark)
  self.assertIn("object-fit: cover",care)
  self.assertIn("object-fit:cover",spark)

 def test_sales_readiness_faq_and_cross_service_links(self):
  for page in ("index.html","spark/index.html"):
   html=src(page)
   self.assertIn('id="faq"',html)
   self.assertIn('aria-labelledby="mate-faq-heading"',html)
   self.assertEqual(html.count('class="mate-help-question"'),4)
   self.assertIn("MATEの3つのサービス",html)
   self.assertIn('data-mate-cta="listing"',html)
   for domain in ("care.kosodatemate.jp","spark.kosodatemate.jp","play.kosodatemate.jp"):
    self.assertIn('href="https://'+domain+'/"',html)
   self.assertIn("承認後に公開",html)
   self.assertNotIn("予約が確定します。",html)
  self.assertIn('href="contact.html" data-mate-cta="listing"',src("index.html"))
  self.assertIn('href="partners.html" data-mate-cta="listing"',src("spark/index.html"))
  for style in ("assets/mate-brand-alignment.css","spark/mate-brand-alignment.css"):
   self.assertIn("MATE sales-readiness UI",src(style))
   self.assertIn(".mate-help-question summary",src(style))
   self.assertIn("@media(max-width:800px)",src(style))

 def test_requested_layout_form_and_https_regressions(self):
  care_css=src("assets/mate-brand-alignment.css")
  spark_css=src("spark/mate-brand-alignment.css")
  care_form=src("contact.html")
  consult=src("consult.html")
  play_form=src("play-listing.html")
  self.assertIn("grid-template-columns:repeat(2,minmax(0,1fr))",care_css)
  self.assertIn("grid-template-columns:repeat(2,minmax(0,1fr))",spark_css)
  self.assertIn("aspect-ratio: 3 / 2",care_css)
  self.assertIn("object-fit: cover",care_css)
  self.assertIn("object-fit:contain;object-position:center center",spark_css)
  self.assertNotIn("SELF-SERVICE LISTING",care_form)
  self.assertNotIn("掲載内容をここで登録できます",care_form)
  self.assertIn('class="selfService" aria-labelledby="careListingDetails"',care_form)
  self.assertIn("grid-column:1/-1",care_form)
  self.assertIn('class="lead lead-contact"',care_form)
  self.assertNotIn("会員登録なし・無料・メールアドレスのみ必須",consult)
  self.assertNotIn("このフォームは予約を確約するものではなく",consult)
  self.assertIn('name="privacy_agree"',consult)
  self.assertIn('class="cf-turnstile"',consult)
  self.assertIn("<h1>親子の楽しい体験を<em>登録</em></h1>",play_form)
  config=json.loads(src("firebase.json"))
  tls=next(x["headers"] for x in config["hosting"]["headers"] if x["source"]=="**")
  self.assertIn({"key":"Strict-Transport-Security","value":"max-age=604800"},tls)
  self.assertIn({"key":"Content-Security-Policy","value":"upgrade-insecure-requests"},tls)

 def test_care_scene_native_photo_ratio_and_spark_hero_reset(self):
  care=src("assets/mate-brand-alignment.css")
  spark=src("spark/mate-brand-alignment.css")
  home=src("index.html")
  spark_home=src("spark/index.html")
  # CARE photos all use a reference-matched 3:2 frame; images are never stretched.
  self.assertIn("aspect-ratio: 3 / 2",care)
  self.assertIn("grid-template-columns: repeat(4,minmax(0,1fr))",care)
  self.assertIn(".scene .cards .card .pic img",care)
  self.assertIn("object-fit: cover",care)
  for name in ("mate-care-scene-urgent-v2.webp","mate-care-scene-pickup-v2.webp","mate-care-scene-sick-v2.webp"):
   self.assertIn(name,home)
  # Old full-bleed CSS left offsets and translateX that must be neutralized.
  for token in ("inset:auto","transform:none","grid-column:2","grid-column:1"):
   self.assertIn(token,spark)
  self.assertIn('sales-ready-v16',home)
  self.assertIn('sales-ready-v16',spark_home)
  self.assertIn('hero-parity.css?v=20261103-copy-position-v3',spark_home)
  parity=src("spark/hero-parity.css")
  self.assertIn("height:clamp(560px, 43vw, 720px)",parity)
  self.assertIn("object-position:right center",parity)
  self.assertIn("linear-gradient",parity)
  self.assertIn("width:min(1280px,calc(100% - 56px))",parity)
  self.assertIn("transform:translateY(-22px)",parity)
  self.assertNotIn("package_care_photos.py",src(".github/workflows/pages.yml"))
  self.assertNotIn("images.pexels.com",home)
  self.assertNotIn("data-published-asset",home)

if __name__=="__main__":unittest.main()
