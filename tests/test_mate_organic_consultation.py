"""Guard conversion paths from useful guide content to service-specific, consent-first consultations."""
from pathlib import Path
import unittest

ROOT=Path(__file__).resolve().parents[1]

class OrganicConsultationTests(unittest.TestCase):
    def test_related_guides_link_to_correct_service_consultation(self):
        for path,service in [
            ("guide-sitter-choice.html","CARE"),
            ("guide-family-outing.html","PLAY"),
            ("spark/guide-lessons-choice.html","SPARK"),
            ("spark/guide-lesson-trial-review.html","SPARK")
        ]:
            with self.subTest(path=path):
                html=(ROOT/path).read_text(encoding="utf-8")
                self.assertIn("https://care.kosodatemate.jp/consult.html?service="+service,html)
                self.assertIn("mate_guide_consult_click",html)
                self.assertIn("source_page:location.pathname",html)
                self.assertIn('rel="canonical"',html)
                self.assertIn('application/ld+json',html)
                self.assertNotIn("onclick=\"location.href",html)

if __name__=="__main__":
    unittest.main()
