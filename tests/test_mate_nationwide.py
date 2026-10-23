"""Nationwide UI and consent-gated publishing checks for CARE and SPARK."""
import datetime
import json
import re
import subprocess
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from sync_spark_public import PREFECTURES, build_public

EXPECTED = (
    "北海道 青森県 岩手県 宮城県 秋田県 山形県 福島県 茨城県 栃木県 "
    "群馬県 埼玉県 千葉県 東京都 神奈川県 新潟県 富山県 石川県 "
    "福井県 山梨県 長野県 岐阜県 静岡県 愛知県 三重県 滋賀県 京都府 "
    "大阪府 兵庫県 奈良県 和歌山県 鳥取県 島根県 岡山県 広島県 "
    "山口県 徳島県 香川県 愛媛県 高知県 福岡県 佐賀県 長崎県 "
    "熊本県 大分県 宮崎県 鹿児島県 沖縄県"
).split()
TODAY = datetime.date(2026, 10, 23)


class NationwideTests(unittest.TestCase):
    def test_all_47_prefectures_are_supported_by_export(self):
        self.assertEqual(len(PREFECTURES), 47)
        self.assertEqual(set(PREFECTURES), set(EXPECTED))

    def test_ui_has_two_complete_location_dropdowns(self):
        html = (ROOT / "spark/index.html").read_text(encoding="utf-8")
        self.assertNotIn("1都3県", html)
        self.assertIn("全国47都道府県", html)
        for select_id in ("region", "topRegion"):
            match = re.search(
                rf'<select id="{select_id}">([\s\S]*?)</select>',
                html,
            )
            self.assertIsNotNone(match)
            options = match.group(1)
            self.assertEqual(len(re.findall(r"<option>", options)), 47)
            for prefecture in EXPECTED:
                self.assertIn(f"<option>{prefecture}</option>", options)
        self.assertIn("s.region!=='全国'", html)

    def test_consent_checked_listing_works_outside_original_four(self):
        contract = {
            "契約ID": "C-47", "サービス": "SPARK",
            "掲載先ID": "school-47", "状態": "有効",
            "同意者": "担当者", "同意日時": "2026-10-22",
            "合意証拠URL・メールID": "private-proof",
        }
        base = {
            "ID": "school-47", "企業・教室名": "テスト教室",
            "ジャンル": "音楽", "公式・窓口URL": "https://example.jp",
            "掲載許諾": "許可", "対象学年（カンマ区切り）": "小学生",
            "最寄駅": "要確認", "掲載紹介文": "許可済みの内容",
            "掲載内容確認日": "2026-10-22", "体験受付許諾": "未確認",
        }
        for prefecture in ("北海道", "大阪府", "鹿児島県", "沖縄県", "全国"):
            with self.subTest(prefecture=prefecture):
                school = {**base, "都県・対象": f"{prefecture}・候補エリア"}
                exported = build_public([school], [contract], today=TODAY)
                self.assertEqual(len(exported), 1)
                self.assertEqual(exported[0]["region"], prefecture)
                self.assertFalse(exported[0]["acceptsTrial"])
                self.assertNotIn("合意証拠URL・メールID", exported[0])
                no_consent = build_public([{**school, "掲載許諾": "未確認"}], [contract], today=TODAY)
                self.assertEqual(no_consent, [])

    def test_care_area_filter_can_pick_all_47_without_inventory(self):
        js = (ROOT / "assets/provider-search.js").read_text(encoding="utf-8")
        match = re.search(r'const ALL_PREFECTURES=(\[[^\n]+\]);', js)
        self.assertIsNotNone(match)
        array = json.loads(match.group(1))
        self.assertEqual(set(array), set(EXPECTED))
        self.assertEqual(len(array), 47)
        self.assertIn("...ALL_PREFECTURES", js)
        self.assertIn("a==='全国'", js)
        for content in [
            (ROOT / "index.html").read_text(encoding="utf-8"),
            (ROOT / "spark/index.html").read_text(encoding="utf-8"),
        ]:
            self.assertIn("全国47都道府県", content)

    def test_care_js_syntax(self):
        script = (ROOT / "assets/provider-search.js").read_text(encoding="utf-8")
        output = subprocess.run(["node", "--check"], input=script,
                                text=True, capture_output=True)
        self.assertEqual(output.returncode, 0, output.stderr)


if __name__ == "__main__":
    unittest.main()
