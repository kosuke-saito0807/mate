"""PLAY staging publication must fail closed and keep contacts private."""
import datetime as dt
import sys
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from build_play_staging import build_public

TODAY = dt.date(2026, 10, 25)
def approved():
    return {
        "申請ID": "MATE-WEB-a1b2c3d4-eeee-4444-8888-abcdefabcdef",
        "サービス": "PLAY", "審査状態": "承認",
        "担当者権限の確認": "確認済み", "審査者": "運営担当",
        "掲載申請の意思": "自社掲載に同意",
        "情報確認日": "2026-10-25",
        "教室・事業者名": "許諾済みの親子体験（架空）",
        "公式URL": "https://example.com/event",
        "都道府県": "東京都", "市区町村・対応エリア": "北区",
        "ジャンル": "ものづくり",
        "紹介文": "許諾された仮想データに関する公開用の説明文です。実在の事業者を示すものではありません。",
        "担当者名": "非公開者", "メール": "private@example.com",
        "電話": "00000000000",
    }

class PlayPublicationTest(unittest.TestCase):
    def test_only_allowlisted_fields(self):
        row = approved()
        items = build_public([row], TODAY)
        self.assertEqual(len(items), 1)
        self.assertEqual(items[0]["title"], row["教室・事業者名"])
        self.assertFalse({"メール", "電話", "担当者名"} & set(items[0]))
        self.assertNotIn("private@example.com", str(items))

    def test_internal_test_never_publishes(self):
        row = approved()
        row["掲載申請の意思"] = "内部テスト（一般公開・掲載承認は禁止）"
        self.assertEqual(build_public([row], TODAY), [])
        row = approved()
        row["審査状態"] = "差戻し"
        self.assertEqual(build_public([row], TODAY), [])

    def test_missing_permission_and_review_block(self):
        for key, value in [
            ("担当者権限の確認", "未確認"),
            ("審査者", ""), ("掲載申請の意思", ""),
            ("公式URL", "http://example.com"), ("情報確認日", "2025-01-01")
        ]:
            row = approved()
            row[key] = value
            self.assertEqual(build_public([row], TODAY), [], key)

    def test_duplicate_approved_id_fails_closed(self):
        row = approved()
        with self.assertRaises(ValueError):
            build_public([row, dict(row)], TODAY)

    def test_cannot_publish_other_service(self):
        row = approved()
        row["サービス"] = "CARE"
        self.assertEqual(build_public([row], TODAY), [])

if __name__ == "__main__":
    unittest.main()
