"""Keep MATE CARE's discovery links pointed at PLAY's source-backed infant aquarium article."""
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
TARGET = "https://play.kosodatemate.jp/guide-baby-aquariums"

class BabyAquariumLinks(unittest.TestCase):
    def test_care_guides_link_to_verified_play_article(self):
        for name in ("guides.html","guide-family-outing.html","guide-baby-outing-prep.html"):
            with self.subTest(page=name):
                html=(ROOT/name).read_text(encoding="utf-8")
                self.assertIn(TARGET,html)
                self.assertIn("公式",html)
        hub=(ROOT/"guides.html").read_text(encoding="utf-8")
        self.assertIn("赤ちゃんと東京の水族館4館を比べる",hub)
        self.assertIn("授乳室・ミルク設備・ベビーカー動線",hub)
        self.assertNotIn("予約保証",hub)

if __name__=="__main__":
    unittest.main()
