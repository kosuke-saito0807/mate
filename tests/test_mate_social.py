"""Validate public brand social hub and MATE PLAY guide before GitHub Pages deployment."""
import unittest
from pathlib import Path
from xml.etree import ElementTree as ET
ROOT=Path(__file__).resolve().parents[1]
class SocialLaunchTests(unittest.TestCase):
 def test_social_hub_only_links_real_services(self):
  html=(ROOT/"links.html").read_text(encoding="utf-8")
  for url in ("https://care.kosodatemate.jp/","https://spark.kosodatemate.jp/","https://play.kosodatemate.jp//"):
   self.assertIn(url,html)
  self.assertIn('content="noindex,follow"',html)
  self.assertIn("mate_service_select",html)
  self.assertNotIn("Instagramアカウント開設済み",html)
 def test_play_guide_canonical_ga4_and_sitemap(self):
  html=(ROOT/"guide-family-outing.html").read_text(encoding="utf-8")
  url="https://care.kosodatemate.jp/guide-family-outing.html"
  self.assertIn('href="'+url+'"',html)
  self.assertIn("service:'PLAY'",html)
  self.assertNotIn("会員登録必須",html)
  sitemap=(ROOT/"sitemap.xml").read_text(encoding="utf-8")
  self.assertIn(url,sitemap)
  ET.fromstring(sitemap)
  self.assertIn("guide-family-outing.html",(ROOT/"index.html").read_text(encoding="utf-8"))
if __name__=="__main__":unittest.main()
