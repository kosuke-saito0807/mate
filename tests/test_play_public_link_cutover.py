"""Unit tests of official PLAY link cutover; does not modify real site."""
import importlib.util
import pathlib
import tempfile
import unittest

source=pathlib.Path(__file__).resolve().parents[1]/"scripts/prepare_play_public_link_cutover.py"
spec=importlib.util.spec_from_file_location("mate_play_cutover",source)
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class PublicLinkCutover(unittest.TestCase):
 def test_accept_only_separate_verified_play_production(self):
  self.assertEqual(m.validate_new("https://mate-play-prod.web.app"),"https://mate-play-prod.web.app")
  self.assertEqual(m.validate_new("https://play.mate-example.jp"),"https://play.mate-example.jp")
  for origin in ("https://mate-play-test.web.app","https://mate-spark.web.app",
                 "https://mate-play.kosuke-saito0807.chatgpt.site/",
                 "http://mate-play-prod.web.app","https://mate-play-prod.web.app/?email=test",
                 "https://mate-play-prod.firebaseapp.com","https://mate-play-other.web.app/tracking"):
   with self.subTest(origin=origin),self.assertRaises(ValueError):m.validate_new(origin)
 def test_only_current_public_html_is_planned_not_live_modified(self):
  with tempfile.TemporaryDirectory() as root:
   r=pathlib.Path(root);(r/"spark").mkdir()
   (r/"index.html").write_text('<a href="'+m.OLD+'/">PLAY</a>')
   (r/"spark/index.html").write_text('<a href="'+m.OLD+'">PLAY</a>')
   (r/"secret.txt").write_text(m.OLD)
   result=m.planned_changes("https://mate-play-prod.web.app",r)
   self.assertEqual({p.relative_to(r).as_posix() for p in result},{"index.html","spark/index.html"})
   self.assertIn("https://mate-play-prod.web.app/",result[r/"index.html"])
   self.assertIn(m.OLD,(r/"index.html").read_text())
   self.assertIn(m.OLD,(r/"secret.txt").read_text())
 def test_public_site_never_links_to_unindexed_test(self):
  for page in list(m.ROOT.glob("*.html"))+list((m.ROOT/"spark").glob("*.html")):
   self.assertNotIn("mate-play-test.web.app",page.read_text(encoding="utf-8"),page.name)
if __name__=="__main__":unittest.main()
