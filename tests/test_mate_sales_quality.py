"""Aggregation-only sales safety diagnostics: never email, publish or expose lead PII."""
import datetime as dt, importlib.util, unittest
from pathlib import Path
p=Path(__file__).resolve().parents[1]/"scripts/audit_mate_sales.py"
spec=importlib.util.spec_from_file_location("mate_sales_audit",p);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class SalesQuality(unittest.TestCase):
 def test_duplicate_ids_and_unsafe_outbound_flag(self):
  master=[{"サービス":"CARE","ID":"C123","確認日":"2026-10-29"},
          {"サービス":"CARE","ID":"C123","確認日":"2026-10-01"},
          {"サービス":"SPARK","ID":"C123","確認日":"2026-10-29"}]
  queue=[{"サービス":"PLAY","実送信承認":"TRUE","承認ハッシュ":""},
         {"サービス":"PLAY","実送信承認":"TRUE","承認ハッシュ":"verified_hash"}]
  contracts=[{"状態":"有効","契約ID":"A","掲載先ID":"B","同意者":"","同意日時":"","合意証拠URL・メールID":""},
             {"状態":"有効","契約ID":"C","掲載先ID":"D","同意者":"担当者","同意日時":"2026-10-15","合意証拠URL・メールID":"proof"}]
  report=m.summarize(master,queue,[{"進捗":"受付"}],contracts,dt.date(2026,10,29))
  self.assertEqual(report["reviewAlerts"],{"duplicateCandidateIds":1,"approvedQueueMissingHash":1,"activeContractMissingConsentEvidence":1})
  self.assertEqual(report["activeWrittenContracts"],1)
  self.assertEqual(report["inquiriesPending"],1)
  self.assertEqual(report["services"]["PLAY"]["sendApprovedInQueue"],1)
  self.assertEqual(report["safety"],{"outboundAutomationEnabled":False,"autoSendPerformed":False})
 def test_no_lead_names_or_emails_in_public_aggregate(self):
  import json
  r=m.summarize([{"サービス":"CARE","ID":"private001","担当者":"privateName","メール":"private@example.org"}],[],[],[],dt.date(2026,10,29))
  text=json.dumps(r,ensure_ascii=False)
  self.assertNotIn("privateName",text)
  self.assertNotIn("private@example.org",text)
  self.assertNotIn("private001",text)
if __name__=="__main__":unittest.main()
