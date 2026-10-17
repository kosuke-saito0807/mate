import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from sync_spark_public import build_public, normalized_ages

BASE = {
    "ID": "s1", "企業・教室名": "確認済み学習塾", "都県・対象": "東京都・文京区",
    "ジャンル": "学習塾", "公式・窓口URL": "https://example.com/",
    "掲載許諾": "許可", "対象学年（カンマ区切り）": "小学3年生、中学生",
    "最寄駅": "千駄木駅", "掲載紹介文": "少人数の学習塾です。",
    "体験受付許諾": "可", "掲載内容確認日": "2026-10-17",
}
CONTRACT = {
    "契約ID": "C-01", "サービス": "SPARK", "掲載先ID": "s1",
    "同意者": "掲載担当", "同意日時": "2026-10-17",
    "合意証拠URL・メールID": "evidence-record-01", "状態": "有効",
}


class ExportTests(unittest.TestCase):
    def test_requires_both_approvals(self):
        self.assertEqual(build_public([BASE], []), [])
        self.assertEqual(build_public([{**BASE, "掲載許諾": "未確認"}], [CONTRACT]), [])
        self.assertEqual(build_public([BASE], [{**CONTRACT, "状態": "未契約"}]), [])
        self.assertEqual(build_public([BASE], [{**CONTRACT, "同意者": ""}]), [])

    def test_public_fields_do_not_leak_private_columns(self):
        result = build_public([{**BASE, "メール": "private@example.com"}], [CONTRACT])
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["ages"], ["小学生", "中学生"])
        self.assertEqual(result[0]["region"], "東京都")
        self.assertTrue(result[0]["acceptsTrial"])
        self.assertNotIn("メール", result[0])
        self.assertNotIn("合意証拠URL・メールID", result[0])

    def test_trial_requires_specific_permission(self):
        result = build_public([{**BASE, "体験受付許諾": "未確認"}], [CONTRACT])
        self.assertFalse(result[0]["acceptsTrial"])

    def test_rejects_unverified_or_bad_site(self):
        self.assertEqual(build_public([{**BASE, "掲載内容確認日": ""}], [CONTRACT]), [])
        self.assertEqual(build_public([{**BASE, "公式・窓口URL": "javascript:alert(1)"}], [CONTRACT]), [])

    def test_duplicate_ids_fail_closed(self):
        with self.assertRaises(ValueError):
            build_public([BASE, BASE], [CONTRACT])

    def test_age_normalization(self):
        self.assertEqual(normalized_ages("年長、小学1年生 / 中学2年生"), ["幼児", "小学生", "中学生"])


if __name__ == "__main__":
    unittest.main()
