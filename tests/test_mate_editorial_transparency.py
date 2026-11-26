"""Guard single-source MATE editorial policy, provenance, and cross-service SEO paths."""
from html.parser import HTMLParser
from pathlib import Path
from xml.etree import ElementTree as ET
import json
import re
import unittest

ROOT=Path(__file__).resolve().parents[1]
URL="https://care.kosodatemate.jp/editorial-policy.html"

class Tags(HTMLParser):
    def __init__(self):
        super().__init__();self.links=[];self.h1=0;self.canonical=[];self.meta={}
    def handle_starttag(self,tag,attrs):
        a=dict(attrs)
        if tag=="a":self.links.append(a.get("href",""))
        if tag=="h1":self.h1+=1
        if tag=="link" and a.get("rel")=="canonical":self.canonical.append(a.get("href"))
        if tag=="meta" and a.get("name"):self.meta[a["name"]]=a.get("content","")

class EditorialTransparency(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.page=(ROOT/"editorial-policy.html").read_text(encoding="utf-8")
        cls.tags=Tags();cls.tags.feed(cls.page)

    def test_indexable_single_canonical_and_jsonld(self):
        self.assertEqual(self.tags.h1,1)
        self.assertEqual(self.tags.canonical,[URL])
        self.assertIn("index,follow",self.tags.meta.get("robots",""))
        self.assertIn("正式掲載",self.tags.meta.get("description",""))
        self.assertIn("掲載事業者の情報はどう確認している",self.page)
        self.assertGreater(len(self.page),6500)
        match=re.search(r'<script type="application/ld[+]json">(.*?)</script>',self.page,re.S)
        self.assertIsNotNone(match)
        js=json.loads(match.group(1));graph=js["@graph"]
        self.assertEqual({x["@type"] for x in graph},{"WebPage","BreadcrumbList"})
        wp=next(x for x in graph if x["@type"]=="WebPage")
        self.assertEqual(wp["url"],URL)
        self.assertEqual(wp["publisher"]["name"],"NextEdu")
        self.assertNotIn("Review",str(graph))
        self.assertNotIn("AggregateRating",str(graph))

    def test_meaningful_distinction_and_safe_corrections(self):
        for word in ["編集部による参考紹介","事業者からの正式掲載","安全保証",
                     "本人確認","未承認","公式Webサイト","誤記","修正・削除",
                     "受付","おむつ替え","振替"]:
            self.assertIn(word,self.page,word)
        self.assertIn("事業者がMATEとの提携・推薦・安全審査を受けているとは判断できません",self.page)
        self.assertIn("申請だけで自動公開・課金・契約が始まることはありません",self.page)
        self.assertIn("mailto:kosodatemate@gmail.com",self.page)
        self.assertNotIn("自動で承認",self.page)
        self.assertNotIn("口コミ評価4.9",self.page)

    def test_document_is_discoverable_from_all_public_hubs(self):
        names=["index.html","sitter-directory.html","public-guide.html","operator.html",
               "spark/index.html","spark/school-directory.html","llms.txt","spark/llms.txt"]
        for path in names:
            content=(ROOT/path).read_text(encoding="utf-8")
            self.assertIn("editorial-policy.html",content,path)
        urls=[n.text for n in ET.parse(ROOT/"sitemap.xml").iter() if n.tag.endswith("loc")]
        self.assertEqual(urls.count(URL),1)
        self.assertNotIn("Disallow: /\n", (ROOT/"robots.txt").read_text(encoding="utf-8"))

    def test_no_broken_internal_page_links(self):
        for link in self.tags.links:
            if not link or link.startswith("#") or link.startswith("mailto:"):
                continue
            if link.startswith(("https://spark.kosodatemate.jp/",
                                "https://play.kosodatemate.jp/")):continue
            self.assertFalse(link.startswith("http://"),link)
            if link.startswith("https://care.kosodatemate.jp/"):
                link=link.removeprefix("https://care.kosodatemate.jp/")
            self.assertTrue((ROOT/link.split("#",1)[0]).is_file(),link)

if __name__=="__main__":
    unittest.main()
