"""Verify gallery assets, category fallbacks and no-crop treatment."""
from pathlib import Path
import re
import unittest
import xml.etree.ElementTree as ET

ROOT=Path(__file__).resolve().parents[1]
class GalleryFallbackTests(unittest.TestCase):
    def test_all_category_art_exists(self):
        for name in ("piano","coding","sports","art","learning","science"):
            art=ROOT/"spark"/"assets"/f"mate-category-{name}.svg"
            self.assertTrue(art.is_file(),name)
            self.assertIn('<svg ',art.read_text(encoding="utf-8"))
            ET.parse(art)
            self.assertIn('MATE SPARK',art.read_text(encoding="utf-8"))
    def test_gallery_is_same_on_care_and_spark(self):
        for filename in ("mate-gallery.js","mate-gallery.css"):
            a=(ROOT/"assets"/filename).read_text(encoding="utf-8")
            b=(ROOT/"spark"/"assets"/filename).read_text(encoding="utf-8")
            self.assertEqual(a,b)
    def test_uploaded_photos_are_not_cropped(self):
        for folder in ("assets","spark/assets"):
            css=(ROOT/folder/"mate-gallery.css").read_text(encoding="utf-8")
            self.assertRegex(css,r"mate-real-photo\s*\{[^}]*object-fit:contain")
            self.assertRegex(css,r"mate-category-photo\s*\{[^}]*object-fit:cover")
    def test_category_selection(self):
        js=(ROOT/"spark/assets/mate-gallery.js").read_text(encoding="utf-8")
        for token in ("mate-category-piano.svg","mate-category-coding.svg",
                      "mate-category-sports.svg","mate-category-art.svg",
                      "mate-category-learning.svg","mate-category-science.svg"):
            self.assertIn(token,js)
        self.assertIn("data.description",js)
    def test_updated_cache_key(self):
        for path in ("index.html","spark/index.html"):
            page=(ROOT/path).read_text(encoding="utf-8")
            for name in ("mate-gallery.js","mate-gallery.css"):
                self.assertIn(name+"?v=20261110-premium2",page)
if __name__=="__main__":unittest.main()
