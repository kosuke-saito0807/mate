"""Search-intent and conversion trust checks for CARE/SPARK/BUSINESS pages."""
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parents[1]


def source(path):
    return (ROOT / path).read_text(encoding="utf-8")


class SearchTrustFunnelTests(unittest.TestCase):
    def test_care_home_has_search_relevant_visible_heading(self):
        html = source("index.html")
        heading = re.search(r"<h1>(.*?)</h1>", html, re.S)
        self.assertIsNotNone(heading)
        self.assertIn("ベビーシッター", heading.group(1))
        self.assertIn("訪問保育", html)
        self.assertIn('href="sitter-directory.html"', html)
        self.assertIn('href="guide-tokyo-babysitter-choice.html"', html)

    def test_search_results_distinguish_approved_and_independent_editorial_data(self):
        care = source("index.html")
        spark = source("spark/index.html")
        for page in (care, spark):
            self.assertIn("参考紹介", page)
            self.assertIn("未承認", page)
            self.assertIn("公式", page)
        self.assertNotIn("安心して任せられます", care)
        self.assertNotIn("掲載許可をいただいたシッター事業者から順次公開しています", care)
        self.assertNotIn("教室の掲載意思と情報・許諾を確認できたものから公開します", spark)
        self.assertIn('href="school-directory.html"', spark)
        self.assertIn('href="guide-tokyo-kids-classes.html"', spark)

    def test_business_preview_links_are_grounded_and_not_approval_claims(self):
        html = source("business.html")
        for service, url in (
            ("CARE", "https://care.kosodatemate.jp/sitter-directory.html"),
            ("SPARK", "https://spark.kosodatemate.jp/school-directory.html"),
            ("PLAY", "https://play.kosodatemate.jp/"),
        ):
            self.assertIn(f'data-business-preview="{service}" href="{url}"', html)
        self.assertIn("mate_business_preview_click", html)
        self.assertIn("事業者未確認・未承認", html)
        self.assertIn("正式な掲載はお申し込み後", html)
        self.assertIn("送客件数は保証しません", html)
        self.assertNotIn("掲載実績多数", html)

    def test_safety_and_user_consent_unchanged(self):
        care = source("index.html")
        spark = source("spark/index.html")
        self.assertIn("実際の予約や契約、利用条件は各事業者", care)
        self.assertIn("教室への取次ぎには別途同意が必要", spark)
        self.assertIn('data-mate-cta="listing"', care)
        self.assertIn('data-mate-cta="listing"', spark)


if __name__ == "__main__":
    unittest.main()
