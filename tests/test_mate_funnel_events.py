"""Safety regression checks for MATE's privacy-minimizing funnel telemetry."""
from pathlib import Path
import unittest
import shutil
import subprocess

ROOT = Path(__file__).resolve().parents[1]


class FunnelEventTests(unittest.TestCase):
    def test_every_public_homepage_loads_local_tracker(self):
        for html in ("index.html", "spark/index.html", "sitter-directory.html", "spark/school-directory.html"):
            with self.subTest(html=html):
                content = (ROOT / html).read_text(encoding="utf-8")
                self.assertIn('src="assets/mate-funnel-events.js"', content)
                self.assertTrue((ROOT / html).parent.joinpath("assets/mate-funnel-events.js").is_file())

    def test_js_is_valid_in_node(self):
        if not shutil.which('node'):
            self.skipTest('Node.js is not installed')
        for filename in ('assets/mate-funnel-events.js', 'spark/assets/mate-funnel-events.js'):
            with self.subTest(filename=filename):
                subprocess.run(['node', '--check', str(ROOT / filename)], check=True, capture_output=True, text=True)

    def test_event_names_and_privacy(self):
        files = [ROOT / "assets/mate-funnel-events.js", ROOT / "spark/assets/mate-funnel-events.js"]
        a, b = (path.read_text(encoding="utf-8") for path in files)
        self.assertEqual(a, b)
        self.assertIn("link.closest('#results .result, #cards .card, .provider')", a)
        self.assertIn("#filter, #directory-filter", a)
        for event in ("mate_provider_outbound_click", "mate_search_entry_click",
                      "mate_search_control_click", "mate_search_submit", "mate_search_filter_change"):
            self.assertIn(event, a)
        for forbidden in ("search_term:", "query:", "user_id:", "email:", "link_url:", "provider_url:"):
            self.assertNotIn(forbidden, a)


if __name__ == "__main__":
    unittest.main()
