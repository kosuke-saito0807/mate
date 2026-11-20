"""Public MATE user experience, information architecture and rich content audit."""
from pathlib import Path
from xml.etree import ElementTree as ET
import json,re,unittest
ROOT=Path(__file__).resolve().parents[1]
PAGES={
 "index.html":"CARE","spark/index.html":"SPARK","guide-sitter-choice.html":"CARE",
 "guide-family-outing.html":"PLAY","spark/guide-lessons-choice.html":"SPARK",
 "guide-sitter-fees-check.html":"CARE","guide-weekend-family-event.html":"PLAY",
 "spark/guide-lesson-age-fit.html":"SPARK",
 "guides.html":"MATE",
}
GUIDES={"guide-sitter-choice.html","guide-family-outing.html","spark/guide-lessons-choice.html","guide-sitter-fees-check.html","guide-weekend-family-event.html","spark/guide-lesson-age-fit.html"}
def src(path):return (ROOT/path).read_text(encoding="utf-8")
class DiscoveryQuality(unittest.TestCase):
 def test_owner_photo_cover_layout_and_full_image_access(self):
  # Approved listing cards should not shrink owner photos into a padded frame.
  # Full detail views retain a separate, noncropping viewer for text/people.
  for path in ("assets/mate-gallery.css","spark/assets/mate-gallery.css"):
   css=src(path)
   self.assertIn(".mate-photo-slides img.mate-real-photo",css)
   self.assertIn("object-fit:cover;object-position:center center;padding:0",css)
   self.assertIn("background:transparent;filter:none",css)
  for path in ("provider.html","spark/school-detail.html"):
   detail=src(path)
   self.assertIn('id="gallery"',detail)
   self.assertIn('id="photo-modal"',detail)
   self.assertIn('id="full-photo"',detail)
   self.assertIn('object-fit:cover;object-position:center',detail)
   self.assertIn('.photo-fullscreen-image{display:block;flex:1;',detail)
   self.assertIn('object-fit:contain;',detail)
   self.assertIn("modal.showModal()",detail)
   self.assertIn("modal.close()",detail)
   self.assertIn("el('photo-modal-prev').onclick=()=>move(-1)",detail)
   self.assertIn("el('photo-modal-next').onclick=()=>move(1)",detail)
   self.assertIn("e.key==='ArrowLeft'",detail)
   self.assertIn("e.key==='ArrowRight'",detail)
  self.assertIn("mate-gallery.css?v=20261120-photo-cover-v3",src("index.html"))
  self.assertIn("mate-gallery.css?v=20261120-tall-media-v4",src("spark/index.html"))
  care=json.loads(src("data.json"))[0]
  spark=json.loads(src("spark/schools.json"))[0]
  self.assertEqual(len(care["images"]),4)
  self.assertEqual(len(spark["images"]),5)

 def test_approved_listings_first_clean_labels_and_aligned_links(self):
  care=src("assets/provider-search.js")
  spark=src("spark/index.html")
  home=src("index.html")
  for path in ("assets/mate-gallery.js","spark/assets/mate-gallery.js"):
   gallery=src(path)
   self.assertIn("mate-gallery-official-link",gallery)
   self.assertIn("photoStart+photos.map",gallery)
   self.assertIn("photoEnd+",gallery)
   self.assertNotIn("カテゴリーイメージ",gallery)
   self.assertNotIn("mate-photo-fallback",gallery)
  self.assertIn("Number(a.editorial===true)-Number(b.editorial===true)",care)
  self.assertIn("mateApprovedThumb(p)",care)
  # Directory UX: summaries never force a tall card; labels and in-paragraph
  # read-more remain immediately adjacent, with mid-list refinements.
  self.assertIn('class="result-inline-more"',care)
  self.assertIn('class="result-description"><strong>紹介：</strong>',care)
  self.assertIn('<strong>対象エリア：</strong>',care)
  self.assertIn('<strong>サービス：</strong>',care)
  self.assertIn("let visibleLimit=18",care)
  self.assertIn("data-show-more",care)
  self.assertIn("data-show-all",care)
  self.assertIn('data-care-refine',care)
  self.assertIn('profile-gallery-panel',src("provider.html"))
  self.assertIn('id="gallery"',src("provider.html"))
  self.assertIn('<a class="mate-editorial-thumb mate-thumbnail-fallback mate-approved-brand"',care)
  self.assertIn('data-approved-brand data-provider-id',care)
  self.assertIn('href="\'+escapeHtml(url)+\'" target="_blank" rel="noopener noreferrer"',care)
  self.assertIn("const name=mateDisplayName(p),url=ur(p)",care)
  original=json.loads(src("data.json"))
  poppins=next(p for p in original if p["id"]=="mate_care_3a29e1c1eb6f4f1b")
  self.assertEqual(poppins["official_url"],"https://smartsitter.jp/")
  self.assertIn("保育料は1時間2,420円〜",poppins["description"])
  self.assertIn("入会金・年会費は無料",poppins["description"])
  self.assertNotIn("tags",poppins)
  self.assertIn("mateDisplayName(p)",care)
  self.assertNotIn('result-kicker">公開情報参考・事業者未確認',care)
  self.assertNotIn('<strong>公開情報参考・事業者未確認</strong>',spark)
  self.assertIn("未確認の参考紹介",care)
  self.assertIn("mate-approved-brand",src("assets/mate-editorial-thumb.css"))
  self.assertIn("Number(a.editorial===true)-Number(b.editorial===true)",spark)
  self.assertNotIn(':"正式掲載"',care)
  self.assertNotIn('<strong>正式掲載</strong>',spark)
  self.assertIn("schoolThumb(s)+",spark)
  self.assertNotIn("Array.isArray(s.images)&&s.images.length&&window.MATEGallery",spark)
  self.assertIn(".results>.result>.provider-link",home)
  self.assertIn("margin-top:auto",home)
  self.assertIn(".cards>.card .cardActions{margin-top:auto",spark)
  self.assertIn("min-height:44px",spark)
  for path in ("assets/mate-gallery.css","spark/assets/mate-gallery.css"):
   self.assertIn(".mate-photo-fallback{display:none!important}",src(path))

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

 def test_empty_search_guides_and_free_listing_paths(self):
  care=src("assets/provider-search.js")
  spark=src("spark/index.html")
  self.assertIn('href="guide-sitter-choice.html"',care)
  # Family-oriented editorial cards keep correction and outbound links only.
  # Operator application remains accessible via the dedicated partner area.
  self.assertNotIn("正式掲載を申請 ↗",care)
  self.assertIn('href="contact.html">掲載相談フォームへ',src("index.html"))
  self.assertIn('href="guide-lessons-choice.html"',spark)
  self.assertIn("教室の無料掲載申請はこちら",spark)
  # No fictional providers or unauthorized bookings created by fallback links.
  self.assertIn("掲載許可をいただいたシッター事業者から順次公開",care)
  self.assertIn("掲載を許諾いただいた教室を順次公開",spark)

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
