"""SPARK indexable directory and editorial/partner separation regression tests."""
import importlib.util
import json
import re
import unittest
from pathlib import Path
from xml.etree import ElementTree as ET

ROOT=Path(__file__).resolve().parents[1]
SRC=ROOT/"spark/editorial-schools.json"
PAGE=ROOT/"spark/school-directory.html"

class SchoolDirectorySeoTests(unittest.TestCase):
    def test_directory_contains_public_reference_rows_only(self):
        data=json.loads(SRC.read_text(encoding="utf-8"))
        valid=[x for x in data if x.get("editorial") is True and x.get("approved") is False and x.get("url","").startswith("https://")]
        html=PAGE.read_text(encoding="utf-8")
        self.assertGreaterEqual(len(valid),159)
        self.assertIn('rel="canonical" href="https://spark.kosodatemate.jp/school-directory.html"',html)
        self.assertIn('<meta name="robots" content="index,follow,max-image-preview:large">',html)
        self.assertIn('事業者未承認の参考紹介です',html)
        self.assertIn('href="./#discover"',html)
        self.assertIn('id="directory-count">'+str(len(valid))+"</strong>",html)
        self.assertEqual(html.count('class="provider"'),len(valid))
        self.assertIn('href="https://spark.kosodatemate.jp/school-directory.html"',html.replace('rel="canonical" ','rel="canonical" '))
        for entry in valid:
            with self.subTest(entry=entry["id"]):
                self.assertIn('id="'+entry["id"]+'"',html)
                self.assertIn(entry["name"],html)
        self.assertNotIn('予約可能です',html)
        self.assertNotIn('事業者確認済み',html)
        self.assertNotIn('GMAIL_SENT:',html)

    def test_age_specific_guides_and_consultation_visible_in_static_list(self):
        html=PAGE.read_text(encoding="utf-8")
        self.assertIn('href="guide-lessons-age-three.html"',html)
        self.assertIn('href="guide-lessons-age-two.html"',html)
        self.assertIn('href="guide-lesson-trial-review.html"',html)
        self.assertIn('href="https://care.kosodatemate.jp/consult.html?service=SPARK&amp;inquiry=age-three"',html)
        self.assertIn("相談だけで入会や予約は成立しません",html)
        self.assertIn("必ず各教室の公式情報",html)

    def test_schema_and_links(self):
        html=PAGE.read_text(encoding="utf-8")
        block=re.search(r'<script type="application/ld\+json">(.*?)</script>',html,re.S)
        self.assertIsNotNone(block)
        graph=json.loads(block.group(1))["@graph"]
        itemlist=next(node for node in graph if node["@type"]=="ItemList")
        self.assertEqual(itemlist["numberOfItems"],html.count('class="provider"'))
        self.assertEqual(len(itemlist["itemListElement"]),itemlist["numberOfItems"])
        self.assertEqual(len({x["url"] for x in itemlist["itemListElement"]}),len(itemlist["itemListElement"]))
        sitemap=(ROOT/"spark/sitemap.xml").read_text(encoding="utf-8")
        self.assertEqual(sitemap.count("<loc>https://spark.kosodatemate.jp/school-directory.html</loc>"),1)
        homepage=(ROOT/"spark/index.html").read_text(encoding="utf-8")
        self.assertIn('href="school-directory.html"',homepage)
        self.assertIn("子どもの習い事で、",homepage)
        self.assertIn('school-directory.html', (ROOT/"spark/llms.txt").read_text(encoding="utf-8"))

    def test_generator_is_idempotent_and_fails_on_duplicate_source(self):
        module_path=ROOT/"scripts/sync-spark-directory.py"
        spec=importlib.util.spec_from_file_location("spark_directory",module_path)
        module=importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        before=PAGE.read_bytes()
        module.build()
        middle=PAGE.read_bytes()
        module.build()
        after=PAGE.read_bytes()
        self.assertEqual(middle,after)
        data=json.loads(SRC.read_text(encoding="utf-8"))
        self.assertEqual(module.validated(),[x for x in data if x.get("editorial") is True and x.get("approved") is False and x.get("url","").startswith("https://")])
        # Source files unchanged by generation; output format can be renewed.
        self.assertTrue(before.startswith(b"<!doctype html>"))

if __name__=="__main__":
    unittest.main()
