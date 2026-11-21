"""Directory region filters must be a transparent client-side presentation of editorial source geography."""
from pathlib import Path
import html
import json
import re
import shutil
import subprocess
import unittest

ROOT = Path(__file__).resolve().parents[1]


class DirectoryRegionFilterTest(unittest.TestCase):
    CASES = [
        ("CARE", "sitter-directory.html", "editorial-care.json",
         "scripts/sync-care-directory.py", "guide-tokyo-babysitter-choice.html"),
        ("SPARK", "spark/school-directory.html", "spark/editorial-schools.json",
         "scripts/sync-spark-directory.py", "spark/guide-tokyo-kids-classes.html"),
    ]

    def test_all_visible_cards_preserve_public_source_region(self):
        for service, page, source, generator, guide in self.CASES:
            with self.subTest(service=service):
                records = json.loads((ROOT / source).read_text(encoding="utf-8"))
                by_id = {r["id"]: r for r in records}
                markup = (ROOT / page).read_text(encoding="utf-8")
                cards = re.findall(
                    r'<article class="provider" id="([^"]+)" data-region="([^"]+)">',
                    markup,
                )
                self.assertEqual(len(cards), len(records))
                self.assertEqual(set(x for x, _ in cards), set(by_id))
                for ident, region in cards:
                    self.assertEqual(html.unescape(region), by_id[ident]["region"])
                self.assertIn('<select id="directory-region">', markup)
                self.assertIn('id="directory-filter-result"', markup)
                self.assertIn("実際の", (ROOT / guide).read_text(encoding="utf-8"))
                self.assertIn("?region=東京都", (ROOT / guide).read_text(encoding="utf-8"))
                self.assertIn('src="assets/mate-directory-region-filter.js"', markup)
                self.assertNotIn("noindex", markup)
                self.assertIn("事業者未承認", markup)
                self.assertIn("data-mate-owner-claim", markup)
                self.assertIn("data-region=", (ROOT / generator).read_text(encoding="utf-8"))

    def test_region_filter_does_not_contaminate_search_analytics(self):
        script = (ROOT / "assets/mate-directory-region-filter.js").read_text(encoding="utf-8")
        spark = (ROOT / "spark/assets/mate-directory-region-filter.js").read_text(encoding="utf-8")
        self.assertEqual(script, spark)
        self.assertIn("searchParams.get('region')", script)
        self.assertIn("history.replaceState", script)
        for forbidden in ("gtag(", "localStorage", "fetch(", "sendBeacon", "FormData"):
            self.assertNotIn(forbidden, script)
        if shutil.which("node"):
            result = subprocess.run(
                ["node", "--test", "scripts/ci/test-directory-region-filter.mjs"],
                cwd=ROOT, capture_output=True, text=True,
            )
            self.assertEqual(result.returncode, 0, result.stdout+result.stderr)

    def test_rebuilding_from_source_remains_idempotent(self):
        for _, page, _, generator, _ in self.CASES:
            with self.subTest(script=generator):
                subprocess.run(["python3", generator], check=True, cwd=ROOT,
                               capture_output=True, text=True)
                first = (ROOT / page).read_text(encoding="utf-8")
                subprocess.run(["python3", generator], check=True, cwd=ROOT,
                               capture_output=True, text=True)
                self.assertEqual(first, (ROOT / page).read_text(encoding="utf-8"))
                self.assertIn('data-region=', first)
                self.assertIn('src="assets/mate-directory-region-filter.js"', first)


if __name__ == "__main__":
    unittest.main()
