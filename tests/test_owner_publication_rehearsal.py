"""Offline, no-network end-to-end rehearsal of human approval/publication gates.
All providers below are imaginary fixtures used in CI only; no Sheets are
mutated and no JSON file is generated, committed, or deployed.
"""
import datetime as dt
import sys
import unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
from sync_google_sheets_public import build_public as care_public
from sync_spark_public import build_public as spark_public

TODAY=dt.date(2026,11,4)
CARE={
 "ID":"care_fixture_approved_01","事業者名":"Verified Childcare Fixture",
 "掲載許可":"許可","MATE掲載ステータス":"掲載許可",
 "公式サイト":"https://example.org/care","掲載情報確認日":"2026-11-04",
 "掲載紹介文":"Non-production simulation of an authorized childcare provider",
 "メール":"private-contact@example.org"
}
CARE_CONTRACT={
 "契約ID":"CARE-CI-FIXTURE","サービス":"CARE","掲載先ID":CARE["ID"],
 "同意者":"CI reviewer fixture","同意日時":"2026-11-04 12:00:00",
 "条件版":"2026-11-04-v1","合意証拠URL・メールID":"internal-fixture-evidence",
 "開始日":"2026-11-04","終了日":"2027-11-04","状態":"有効"
}
SPARK={
 "ID":"spark_fixture_approved_01","企業・教室名":"Verified Learning Fixture",
 "都県・対象":"東京都・文京区","ジャンル":"プログラミング",
 "公式・窓口URL":"https://example.org/lessons",
 "掲載許諾":"許可","対象学年（カンマ区切り）":"小学生",
 "最寄駅":"駒込駅","掲載紹介文":"Review-only class fixture",
 "体験受付許諾":"未確認","掲載内容確認日":"2026-11-04"
}
SPARK_CONTRACT={
 "契約ID":"SPARK-CI-FIXTURE","サービス":"SPARK",
 "掲載先ID":SPARK["ID"],"同意者":"CI reviewer fixture",
 "同意日時":"2026-11-04 12:00:00","合意証拠URL・メールID":"internal-fixture-evidence",
 "状態":"有効","条件版":"2026-11-04-v1",
 "開始日":"2026-11-04","終了日":"2027-11-04"
}
class OwnerPublicationRehearsal(unittest.TestCase):
 def test_care_no_consent_no_contract_no_publish(self):
  self.assertEqual(care_public([CARE],[],today=TODAY),[])
  self.assertEqual(care_public([{**CARE,"掲載許可":"未確認"}],[CARE_CONTRACT],today=TODAY),[])
  self.assertEqual(care_public([CARE],[{**CARE_CONTRACT,"状態":"未契約"}],today=TODAY),[])
  approved=care_public([CARE],[CARE_CONTRACT],today=TODAY)
  self.assertEqual(len(approved),1)
  self.assertNotIn("private-contact@example.org",str(approved))
  self.assertNotIn("internal-fixture-evidence",str(approved))
 def test_spark_separate_agreement_required(self):
  self.assertEqual(spark_public([SPARK],[],today=TODAY),[])
  self.assertEqual(spark_public([{**SPARK,"掲載許諾":"未確認"}],[SPARK_CONTRACT],today=TODAY),[])
  approved=spark_public([SPARK],[SPARK_CONTRACT],today=TODAY)
  self.assertEqual(len(approved),1)
  self.assertEqual(approved[0]["acceptsTrial"],False)
 def test_owner_internal_e2e_never_enters_public_json(self):
  for name,id_ in [("斎藤テスト","MATE-WEB-708fa2f3-60b9-4b98-9cc1-13f9462dab32"),
                   ("架空事業者","care-not-real")]:
   c={**CARE,"ID":id_,"事業者名":name}
   contract={**CARE_CONTRACT,"掲載先ID":id_}
   self.assertEqual(care_public([c],[contract],today=TODAY),[])
if __name__=="__main__":unittest.main()
