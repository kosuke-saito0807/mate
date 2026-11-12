"""Guard the first-real-partner conversion funnel without promising unverified outcomes."""
import json
import re
import unittest
from pathlib import Path
from xml.etree import ElementTree as ET

ROOT=Path(__file__).resolve().parents[1]
HUB="https://care.kosodatemate.jp/business.html"
TARGETS={
    "CARE":"https://care.kosodatemate.jp/contact.html",
    "SPARK":"https://spark.kosodatemate.jp/partners.html",
    "PLAY":"https://care.kosodatemate.jp/play-listing.html",
}
class BusinessAcquisitionTests(unittest.TestCase):
    def test_hub_crawlable_and_trustworthy(self):
        html=(ROOT/"business.html").read_text(encoding="utf-8")
        self.assertIn('<link rel="canonical" href="'+HUB+'">',html)
        self.assertIn('name="robots" content="index,follow,max-image-preview:large"',html)
        self.assertIn('meta name="description"',html)
        self.assertIn('会員登録不要',html)
        self.assertIn('写真なしでも申請可能',html)
        self.assertIn('申請のみで公開・契約・課金は行いません',html)
        self.assertNotIn('必ず集客',html)
        self.assertNotIn('問い合わせ保証',html)
        schemas=re.findall(r'<script type="application/ld\+json">(.*?)</script>',html,re.S)
        self.assertEqual(len(schemas),1)
        obj=json.loads(schemas[0])
        self.assertEqual(obj["url"],HUB)
        self.assertEqual(obj["@type"],"WebPage")
        questions=obj.get("mainEntity",[])
        self.assertEqual(len(questions),4)
        for qa in questions:
            self.assertEqual(qa["@type"],"Question")
            self.assertIn(qa["name"],html)
            self.assertIn(qa["acceptedAnswer"]["text"],html)
        self.assertIn('data-business-contact="true"',html)
        self.assertIn("mate_business_contact_click",html)
        for service,link in TARGETS.items():
            self.assertIn('data-business-cta="'+service+'" href="'+link+'"',html)
        self.assertIn("mate_business_cta_click",html)
        self.assertNotIn('mailto:kosuke.saito0807',html)

    def test_sitemap_and_internal_entrances(self):
        sitemap=(ROOT/"sitemap.xml").read_text(encoding="utf-8")
        root=ET.fromstring(sitemap)
        urls=[x.text for x in root.findall(".//{http://www.sitemaps.org/schemas/sitemap/0.9}loc")]
        self.assertEqual(urls.count(HUB),1)
        for page in ["index.html","contact.html","partners.html","play-listing.html"]:
            self.assertIn('business.html',(ROOT/page).read_text(encoding="utf-8"),page)
        for page in ["spark/index.html","spark/partners.html"]:
            self.assertIn(HUB,(ROOT/page).read_text(encoding="utf-8"),page)

    def test_real_application_forms_stay_direct_and_enabled(self):
        for page,service in [
            ("contact.html","CARE"),("spark/partners.html","SPARK"),
            ("play-listing.html","PLAY")
        ]:
            with self.subTest(page=page):
                html=(ROOT/page).read_text(encoding="utf-8")
                self.assertIn('data-mate-direct-listing="true"',html)
                self.assertIn('name="service" value="'+service+'"',html)
                self.assertIn('mate-direct-intake.js',html)
                self.assertIn('type="submit"',html)

if __name__=="__main__":unittest.main()
