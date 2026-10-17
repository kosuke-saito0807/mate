"""End-to-end contract gating, richer listing fields and safe free intake checks."""
import datetime
import json
import re
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from sync_spark_public import build_public, public_amount, public_age, public_weekdays

DATE = datetime.date(2026, 10, 17)
SCHOOL = {
    "ID": "spark-school-1", "企業・教室名": "架空ではない承認済み教室",
    "都県・対象": "東京都・文京区", "ジャンル": "プログラミング",
    "公式・窓口URL": "https://example.edu.jp/school",
    "メール": "private@example.org", "電話": "09000000000",
    "掲載許諾": "許可", "対象学年（カンマ区切り）": "小学生",
    "最寄駅": "千石駅", "掲載紹介文": "承認された紹介テキスト",
    "体験受付許諾": "可", "掲載内容確認日": "2026-10-16",
    "月謝税込円": "8,800", "体験料金税込円": "0",
    "対象最少年齢": "6", "対象最高年齢": "12",
    "開講曜日（カンマ区切り）": "水、土",
    "教室所在地": "文京区千石", "特徴タグ（カンマ区切り）": "少人数、初心者歓迎",
    "次回体験予定日": "2026-10-22",
}
CONTRACT = {
    "契約ID": "spark-contract-1", "サービス": "SPARK",
    "掲載先ID": "spark-school-1", "状態": "有効",
    "同意者": "運営担当者", "同意日時": "2026-10-15",
    "合意証拠URL・メールID": "private-evidence",
    "開始日": "2026-10-16", "終了日": "2026-11-30",
    "条件版": "2026-10-17",
}


class SparkFullFeatureTests(unittest.TestCase):
    def test_correct_export_and_minimal_personal_data(self):
        results = build_public([SCHOOL], [CONTRACT], today=DATE)
        self.assertEqual(len(results), 1)
        x = results[0]
        self.assertEqual(x["region"], "東京都")
        self.assertEqual(x["area"], "文京区千石")
        self.assertEqual(x["station"], "千石駅")
        self.assertEqual(x["monthlyPrice"], 8800)
        self.assertEqual(x["trialPrice"], 0)
        self.assertEqual([x["ageMin"], x["ageMax"]], [6, 12])
        self.assertEqual(x["weekdays"], ["水", "土"])
        self.assertEqual(x["tags"], ["少人数", "初心者歓迎"])
        self.assertEqual(x["nextTrialDate"], "2026-10-22")
        for private in ("メール", "電話", "同意者", "同意日時", "合意証拠URL・メールID", "契約ID"):
            self.assertNotIn(private, x)
            self.assertNotIn("private@example.org", json.dumps(x, ensure_ascii=False))
            self.assertNotIn("private-evidence", json.dumps(x, ensure_ascii=False))

    def test_start_and_expiration_of_contract(self):
        cases = [
            {**CONTRACT, "開始日": "2026-10-19"},
            {**CONTRACT, "終了日": "2026-10-16"},
            {**CONTRACT, "開始日": "bogus"},
            {**CONTRACT, "状態": "未契約"},
        ]
        for case in cases:
            with self.subTest(case=case):
                self.assertEqual(build_public([SCHOOL], [case], today=DATE), [])

    def test_trial_needs_explicit_approval(self):
        x = build_public([{**SCHOOL, "体験受付許諾": "未確認"}], [CONTRACT], today=DATE)[0]
        self.assertFalse(x["acceptsTrial"])
        self.assertNotIn("nextTrialDate", x)

    def test_unknown_price_and_date_are_not_invented(self):
        x = build_public([{**SCHOOL, "月謝税込円": "", "体験料金税込円": "相談",
            "次回体験予定日": "2026-10-16"}], [CONTRACT], today=DATE)[0]
        self.assertNotIn("monthlyPrice", x)
        self.assertNotIn("trialPrice", x)
        self.assertNotIn("nextTrialDate", x)

    def test_invalid_age_reversed_rejected(self):
        self.assertEqual(build_public([{**SCHOOL, "対象最少年齢": 13, "対象最高年齢": 6}], [CONTRACT], today=DATE), [])

    def test_parsers(self):
        self.assertEqual(public_amount({"a": "1,000"}, "a"), 1000)
        self.assertEqual(public_amount({"a": "0"}, "a"), 0)
        self.assertIsNone(public_amount({"a": "-1"}, "a"))
        self.assertEqual(public_age({"a": "6"}, "a"), 6)
        self.assertEqual(public_weekdays("水、土、火、水"), ["水", "土", "火"])

    def test_frontend_has_real_details_and_favorite_filter(self):
        html = (ROOT / "spark/index.html").read_text(encoding="utf-8")
        for token in ("id=\"detailDialog\"", "data-detail", "favoriteOnly",
                      "体験日が近い順", "data-fav", "id=\"trialDialog\"",
                      "id=\"trialForm\"", "FormSubmit", "mate-spark.web.app"):
            with self.subTest(token=token):
                self.assertIn(token, html)
        ids = re.findall(r"\bid=\"([^\"]+)\"", html)
        self.assertEqual(len(ids), len(set(ids)), "duplicate HTML id")

    def test_form_is_closed_until_real_consent(self):
        html = (ROOT / "spark/index.html").read_text(encoding="utf-8")
        self.assertIn('id="trialForm" method="POST" action="" hidden', html)
        self.assertIn("list.length===selected.size", html)
        self.assertIn("!demoMode", html)
        self.assertIn("s.approved===true&&s.acceptsTrial===true", html)
        self.assertIn('name="_honey"', html)
        self.assertIn('type="checkbox" name="agreed"', html)
        config = json.loads((ROOT / "spark/config.json").read_text(encoding="utf-8"))
        self.assertFalse(config["applyEnabled"])
        self.assertEqual(json.loads((ROOT / "spark/schools.json").read_text(encoding="utf-8")), [])

    def test_internal_operations_not_deployed_publicly(self):
        config = json.loads((ROOT / "firebase.json").read_text(encoding="utf-8"))
        self.assertIn("**/*.md", config["hosting"]["ignore"])
        workflow = (ROOT / ".github/workflows/pages.yml").read_text(encoding="utf-8")
        self.assertIn("find _site/spark -type f -name '*.md' -delete", workflow)

    def test_legal_pages(self):
        for name in ("terms.html", "disclaimer.html", "privacy.html", "partners.html", "thanks-trial.html"):
            self.assertTrue((ROOT / "spark" / name).is_file(), name)


if __name__ == "__main__":
    unittest.main()
