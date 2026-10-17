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
