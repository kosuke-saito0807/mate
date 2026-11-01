"""CARE contract-backed publishing tests. No network or applicant PII."""
import datetime
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from sync_google_sheets_public import build_public

TODAY = datetime.date(2026, 11, 1)
CARE = {
    "ID": "care-verified-1",
    "事業者名": "Verified CARE company",
    "掲載許可": "許可",
    "MATE掲載ステータス": "掲載許可",
    "公式サイト": "https://example.org/care",
    "掲載情報確認日": "2026-10-31",
    "掲載紹介文": "Verified professional childcare support",
    "担当者": "PRIVATE CONTACT",
    "メール": "private@example.org",
}
CONTRACT = {
    "契約ID": "CARE-AGREEMENT-01",
    "サービス": "CARE",
    "掲載先ID": "care-verified-1",
    "同意者": "Authorized signer",
    "同意日時": "2026-10-31 12:00:00",
    "条件版": "2026-11-01",
    "合意証拠URL・メールID": "private-agreement-evidence",
    "開始日": "2026-10-31",
    "終了日": "2027-04-30",
    "状態": "有効",
}

class CareContractPublication(unittest.TestCase):
    def test_only_valid_contract_permits_listing(self):
        self.assertEqual(build_public([CARE], today=TODAY), [])
        self.assertEqual(build_public([CARE], [], today=TODAY), [])
        result = build_public([CARE], [CONTRACT], today=TODAY)
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["id"], CARE["ID"])
        self.assertEqual(result[0]["verified_at"], "2026-10-31")
        serialized = repr(result)
        for private in ("private@example.org", "PRIVATE CONTACT", "Authorized signer",
                        "private-agreement-evidence", "CARE-AGREEMENT-01"):
            self.assertNotIn(private, serialized)

    def test_unsigned_expired_future_unrelated_contracts_never_publish(self):
        edits = [
            {"状態": "未契約"}, {"サービス": "SPARK"},
            {"掲載先ID": "different"}, {"同意者": ""},
            {"同意日時": ""}, {"同意日時": "2026-11-03"},
            {"同意日時": "bad-date"}, {"条件版": ""},
            {"合意証拠URL・メールID": ""}, {"開始日": ""},
            {"終了日": ""}, {"開始日": "2026-11-05"},
            {"終了日": "2026-10-31"}, {"終了日": "not-a-date"},
            {"契約ID": "DRAFT-care-verified-1"},
        ]
        for change in edits:
            with self.subTest(change=change):
                self.assertEqual(build_public([CARE], [{**CONTRACT, **change}], today=TODAY), [])

    def test_revocation_or_stale_business_information_blocks(self):
        changes = [
            {"掲載許可": "未確認"}, {"MATE掲載ステータス": "掲載申請中"},
            {"公式サイト": "http://example.org/"}, {"掲載情報確認日": ""},
            {"掲載情報確認日": "2026-11-02"}, {"掲載情報確認日": "2024-01-01"},
        ]
        for change in changes:
            with self.subTest(change=change):
                self.assertEqual(build_public([{**CARE, **change}], [CONTRACT], today=TODAY), [])

    def test_legacy_sitter_service_and_duplicate_contracts(self):
        self.assertEqual(len(build_public([CARE], [{**CONTRACT, "サービス": "SITTER"}], today=TODAY)), 1)
        with self.assertRaises(ValueError):
            build_public([CARE], [CONTRACT, CONTRACT], today=TODAY)

    def test_duplicate_consent_grants_never_create_duplicate_businesses(self):
        with self.assertRaises(ValueError):
            build_public([CARE, CARE], [CONTRACT], today=TODAY)

if __name__ == "__main__":
    unittest.main()
