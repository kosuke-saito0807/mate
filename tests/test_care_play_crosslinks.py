"""Prevent loss of contextual links from CARE pages to PLAY's public reference directory."""
from pathlib import Path
import re
import unittest

ROOT=Path(__file__).resolve().parents[1]
PLAY="https://play.kosodatemate.jp/experiences"

class CrossServiceDiscoveryLinks(unittest.TestCase):
    def test_care_navigation_and_guides_link_to_play_directory(self):
        for filename in ("index.html", "guides.html", "guide-weekend-family-event.html"):
            with self.subTest(page=filename):
                content=(ROOT/filename).read_text(encoding="utf-8")
                self.assertIn(f'href="{PLAY}"',content)
                # Content, not a hidden redirect, actually explains the next action.
                self.assertRegex(content,r"(未承認|参考紹介)")
                self.assertRegex(content,r"(公式情報|公式サイト|公式案内)")
                self.assertNotIn('rel="nofollow" href="'+PLAY+'"',content)

    def test_machine_readable_page_recommends_same_directory_with_caveat(self):
        source=(ROOT/"llms.txt").read_text(encoding="utf-8")
        self.assertIn(f"]({PLAY})",source)
        self.assertIn("未承認",source)
        self.assertIn("料金",source)

    def test_play_list_does_not_pollute_care_sitemap(self):
        # Cross-service URL is a regular outbound link, not a CARE-owned sitemap URL.
        sitemap=(ROOT/"sitemap.xml").read_text(encoding="utf-8")
        self.assertNotIn(PLAY,sitemap)


if __name__=="__main__":
    unittest.main()
