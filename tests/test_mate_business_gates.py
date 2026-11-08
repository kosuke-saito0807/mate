"""Synthetic, offline checks. No Sheets, mail, publishing or payment actions."""
import importlib.util
from pathlib import Path
import unittest

P = Path(__file__).resolve().parents[1] / "scripts/check_mate_business_gates.py"
spec = importlib.util.spec_from_file_location("business_gates", P)
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

def base():
    return {key: [] for key in m.SHEETS}

class Gates(unittest.TestCase):
    def test_empty_and_unreviewed_test_never_implicitly_approved(self):
        d = base()
        d["applications"] = [{"審査状態":"未審査","教室・事業者名":"テスト","担当者権限の確認":"未確認"}]
        r=m.analyse(d)
        self.assertEqual(r["alerts"],{})
        self.assertEqual(r["counts"]["approved_applications"],0)

    def test_test_record_cannot_be_approved_without_contract(self):
        d=base()
        d["applications"]=[{"審査状態":"承認","教室・事業者名":"内部テスト","紹介文":"ダミー","担当者権限の確認":"未確認"}]
        r=m.analyse(d)["alerts"]
        self.assertEqual(r["test_application_approved"],1)
        self.assertEqual(r["approved_application_no_evidence_contract"],1)

    def test_real_approved_application_requires_active_contract(self):
        d=base()
        d["applications"]=[{"審査状態":"承認","教室・事業者名":"実在の教室","担当者権限の確認":"確認済み",
                            "審査者":"運営","公開ID":"real-school-1","掲載申請の意思":"正式申請"}]
        r=m.analyse(d)["alerts"]
        self.assertEqual(r["approved_application_no_evidence_contract"],1)
        d["contracts"]=[{"掲載先ID":"real-school-1","状態":"有効","契約ID":"contract1",
                         "同意者":"担当者","同意日時":"2026-11-08","合意証拠URL・メールID":"evidence"}]
        self.assertEqual(m.analyse(d)["alerts"],{})

    def test_paid_or_invoice_needs_both_explicit_consents(self):
        d=base()
        d["paid"]=[{"請求ID":"inv-1","税込金額":"1000","有料契約状態":"未契約",
                    "請求書送付状態":"送付済","明示同意":"","MATE承諾":""}]
        self.assertEqual(m.analyse(d)["alerts"]["paid_without_explicit_bilateral_consent"],1)
        d["paid"][0].update({"明示同意":"確認済み","MATE承諾":"確認済み","申請ID":"app-1","条件版":"v1"})
        self.assertEqual(m.analyse(d)["alerts"],{})

    def test_publication_test_and_send_evidence(self):
        d=base()
        d["approval"]=[{"操作":"掲載承認","事業者名":"テスト","備考":"内部テスト"}]
        d["sendlog"]=[{"状態":"送信済","送信根拠":"","根拠URL":""}]
        d["outreach"]=[{"実送信承認":"TRUE","承認ハッシュ":""}]
        alerts=m.analyse(d)["alerts"]
        self.assertEqual(alerts["test_publication_approved"],1)
        self.assertEqual(alerts["outbound_sent_without_evidence"],1)
        self.assertEqual(alerts["outbound_approval_missing_hash"],1)

if __name__=="__main__":
    unittest.main()
