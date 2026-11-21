"""CARE/SPARK unique cost tools should be useful, crawlable and privacy-respecting."""
from pathlib import Path
import shutil
import subprocess
import unittest
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]

class CostEstimatorTests(unittest.TestCase):
    CASES = (
        ("guide-sitter-hourly-cost.html", "sitemap.xml",
         "https://care.kosodatemate.jp/guide-sitter-hourly-cost.html",
         "CARE", "時給", "利用回数"),
        ("spark/guide-lesson-total-cost.html", "spark/sitemap.xml",
         "https://spark.kosodatemate.jp/guide-lesson-total-cost.html",
         "SPARK", "月謝", "支払い月数"),
    )

    def test_estimates_are_in_existing_indexable_high_value_guides(self):
        for page, sitemap, url, service, a, b in self.CASES:
            with self.subTest(page=page):
                html = (ROOT / page).read_text(encoding="utf-8")
                self.assertIn('href="' + url + '"', html)
                self.assertIn('name="robots" content="index,follow', html)
                self.assertIn('data-mate-cost-estimator="' + service + '"', html)
                self.assertIn('src="assets/mate-cost-estimator.js"', html)
                self.assertIn('data-cost-result', html)
                self.assertIn('aria-live="polite"', html)
                self.assertIn("外部", html)
                self.assertIn(a, html)
                self.assertIn(b, html)
                self.assertIn("公式", html)
                self.assertIn("計算", html)
                self.assertIn("data-cost-reset", html)
                urls = {loc.text for loc in ET.parse(ROOT / sitemap).iter()
                        if loc.tag.rsplit("}", 1)[-1] == "loc"}
                self.assertIn(url, urls)

    def test_js_is_local_only_and_identical(self):
        a = (ROOT / "assets/mate-cost-estimator.js").read_text(encoding="utf-8")
        b = (ROOT / "spark/assets/mate-cost-estimator.js").read_text(encoding="utf-8")
        self.assertEqual(a, b)
        self.assertIn("mate_cost_estimator_used", a)
        self.assertNotIn("localStorage", a)
        self.assertNotIn("sessionStorage", a)
        self.assertNotIn("FormData(", a)
        self.assertNotIn("fetch(", a)
        if shutil.which("node"):
            subprocess.run(["node", "--test", "scripts/ci/test-cost-estimator.mjs"],
                           cwd=ROOT, check=True, capture_output=True, text=True)
        else:
            self.skipTest("Node unavailable")

if __name__ == "__main__":
    unittest.main()
