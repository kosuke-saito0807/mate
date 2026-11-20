"""CARE is the single public design/content reference for SPARK's operator route."""
import re
import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
care=(ROOT/"operator.html").read_text(encoding="utf-8")
spark=(ROOT/"spark/operator.html").read_text(encoding="utf-8")

def within(html,start,end):
    return html.split(start,1)[1].split(end,1)[0]

class OperatorParity(unittest.TestCase):
    def test_identical_operator_design(self):
        self.assertEqual(within(care,"<style>","</style>"),
                         within(spark,"<style>","</style>"))
        self.assertLess(spark.index('class="operator-header"'),spark.index('class="founder-profile"'))
        self.assertIn('<h1>斎藤幸輔｜MATE運営者情報</h1>',spark)
        self.assertIn('href="./">SPARKホームへ戻る',spark)

    def test_complete_founder_profile_and_media_matches_care(self):
        for part in ('<div class="founder-copy">','<div class="founder-history">'):
            match=re.search(re.escape(part)+r'(.*?)</div>',care,re.S)
            self.assertIsNotNone(match)
            self.assertIn(part+match.group(1)+'</div>',spark)
        for token in ('監修書籍','取材・インタビュー掲載実績',
                      '明治大学商学部卒業。在学中に教員免許を取得。',
                      'https://www.amazon.co.jp/dp/4297106132',
                      'https://schoolschool.jp/2022/06/codecampkids/'):
            self.assertIn(token,spark)
        self.assertIn('src="https://care.kosodatemate.jp/assets/nextedu-saito-portrait.png"',spark)

    def test_company_and_local_links(self):
        self.assertIn('<h2 id="operator-details">MATE SPARK</h2>',spark)
        self.assertIn('<dd>NextEdu</dd>',spark)
        self.assertIn('NextEdu（MATE運営事務局）',spark)
        self.assertIn('id="inquiry"',spark)
        self.assertIn('href="partners.html"',spark)
        self.assertIn('href="privacy.html"',spark)
        self.assertIn('<link rel="canonical" href="https://spark.kosodatemate.jp/operator.html">',spark)

if __name__=="__main__":
    unittest.main()
