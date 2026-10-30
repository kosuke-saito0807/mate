"""Check Firebase's main page preserves the original MATE SPARK content and safe demo fallback."""
import json
import re
import subprocess
import unittest
from pathlib import Path

SITE = Path(__file__).resolve().parents[1] / "spark"


class OriginalSiteAlignmentTest(unittest.TestCase):
    def test_original_branding_and_sections(self):
        h = (SITE / "index.html").read_text(encoding="utf-8")
        for text in ("MEET YOUR NEXT POSSIBILITY.", "好きが見つかる。", "世界が、",
                     "ABOUT MATE SPARK", "OUR MISSION", "月謝の上限",
                     "通える曜日", "体験相談が可能な教室のみ", "FOR SCHOOL PARTNERS"):
            with self.subTest(text=text):
                self.assertIn(text, h)
        for text in ('id="region"', 'id="age"', 'id="price"', 'id="category"',
                     'id="keyword"', 'id="weekdays"', 'id="cards"',
                     'id="compareDialog"', 'href="operator.html"'):
            with self.subTest(id=text):
                self.assertIn(text, h)

    def test_original_scene_and_shared_footer(self):
        h = (SITE / "index.html").read_text(encoding="utf-8")
        for token in ('id="scene"', 'data-scene-category=', 'class="spark-footer"',
                      'MATE CARE ↗', 'MATE PLAY ↗', 'href="terms.html"',
                      'href="disclaimer.html"', 'id="sceneHeading"'):
            with self.subTest(token=token):
                self.assertIn(token, h)


    def test_discovery_heading_and_gradient_match_mate_brand(self):
        h = (SITE / "index.html").read_text(encoding="utf-8")
        self.assertIn('<div class="discovery-header"><p class="section-label">FIND YOUR MATE</p>',h)
        self.assertNotIn('class="center discovery-header"',h)
        self.assertIn('次の「好き」を、見つけよう。',h)
        self.assertIn('object-fit:contain;object-position:right center',h)
        self.assertIn('rgba(255,255,255,.96) 29%',h)
        self.assertIn('linear-gradient(180deg,rgba(255,255,255,.92)',h)

    def test_care_based_visual_alignment_and_footer(self):
        html=(SITE / "index.html").read_text(encoding="utf-8")
        css=(SITE / "mate-brand-alignment.css").read_text(encoding="utf-8")
        care=(SITE.parent / "index.html").read_text(encoding="utf-8")
        care_css=(SITE.parent / "assets/mate-brand-alignment.css").read_text(encoding="utf-8")
        self.assertIn("<title>子どもの習い事・教室を探す｜MATE SPARK</title>",html)
        self.assertIn('class="spark-footer"',html)
        footer=html.split('<footer class="spark-footer">',1)[1].split("</footer>",1)[0]
        self.assertIn('class="footerTop"',footer)
        self.assertIn('class="footerLinks"',footer)
        self.assertNotIn("全国47都道府県",footer)
        self.assertNotIn("架空サンプルは表示例で",footer)
        self.assertIn('class="footerTop"',care)
        self.assertIn("mask-image:none",css)
        self.assertIn(".hero .hero-art::after{",css)
        self.assertIn("rgba(255,255,255,.88) 43%",css)
        self.assertIn("rgba(255,255,255,0) 71%",css)
        self.assertIn("z-index:3",css)
        self.assertNotIn("mask-image:linear-gradient",css)
        self.assertIn("white-wash-v2",html)
        self.assertIn("object-fit:contain;object-position:right center",html)
        self.assertNotIn("object-fit:cover",css)
        self.assertNotIn("max-width:1380px",css)
        self.assertNotIn("max-width:1380px",care_css)
        self.assertIn("--mate-font:",css)
        self.assertIn("--mate-font:",care_css)
        self.assertIn("mate-brand-alignment.css",html)
        self.assertIn("mate-brand-alignment.css",care)

    def test_inline_javascript_syntax(self):
        h = (SITE / "index.html").read_text(encoding="utf-8")
        matches = re.findall(r"<script>(.*?)</script>", h, flags=re.S)
        self.assertTrue(matches)
        for i, script in enumerate(matches):
            p = subprocess.run(["node", "--check"], input=script,
                               text=True, capture_output=True, check=False)
            self.assertEqual(p.returncode, 0, "script %s: %s" % (i, p.stderr))

    def test_twelve_fake_schools_and_disabled_trial(self):
        examples = json.loads((SITE / "demo-schools.json").read_text(encoding="utf-8"))
        self.assertEqual(len(examples), 12)
        self.assertTrue(all(x.get("demo") is True for x in examples))
        self.assertTrue(all(x.get("acceptsTrial") is False for x in examples))
        self.assertEqual(
            sorted(set(x["region"] for x in examples)),
            sorted(["東京都", "神奈川県", "埼玉県", "千葉県"]))
        config = json.loads((SITE / "config.json").read_text(encoding="utf-8"))
        self.assertIs(config["applyEnabled"], False)

    def test_previous_comparison_preserved(self):
        self.assertTrue((SITE / "compare.html").is_file())
        self.assertTrue((SITE / "mate-spark-logo.svg").is_file())

if __name__ == "__main__":
    unittest.main()
