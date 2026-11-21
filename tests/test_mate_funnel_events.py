"""Safety regression checks for MATE's privacy-minimizing funnel telemetry."""
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]


class FunnelEventTests(unittest.TestCase):
    def test_every_public_homepage_loads_local_tracker(self):
        for html in ("index.html", "spark/index.html"):
            with self.subTest(html=html):
                content = (ROOT / html).read_text(encoding="utf-8")
                self.assertIn('src="assets/mate-funnel-events.js"', content)
                self.assertTrue((ROOT / html).parent.joinpath("assets/mate-funnel-events.js").is_file())

    def test_event_names_and_privacy(self):
        files = [ROOT / "assets/mate-funnel-events.js", ROOT / "spark/assets/mate-funnel-events.js"]
        a, b = (path.read_text(encoding="utf-8") for path in files)
        self.assertEqual(a, b)
        for event in ("mate_provider_outbound_click", "mate_search_entry_click",
                      "mate_search_control_click", "mate_search_submit"):
            self.assertIn(event, a)
        for forbidden in ("search_term:", "query:", "user_id:", "email:", "link_url:", "provider_url:"):
            self.assertNotIn(forbidden, a)


if __name__ == "__main__":
    unittest.main()
