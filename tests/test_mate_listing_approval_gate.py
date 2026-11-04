"""Static review of the separately installed approval GAS integration.
No spreadsheets, emails, publication or external requests.
"""
from pathlib import Path
import unittest

# This test runs in the public repo and checks contracts common to the
# separately maintained private implementation documentation only.
ROOT=Path(__file__).resolve().parents[1]
class ListingGate(unittest.TestCase):
 def test_care_sync_still_requires_permission_and_contract(self):
  content=(ROOT/'scripts/sync_google_sheets_public.py').read_text(encoding='utf-8')
  for token in ('signed_care_contracts','掲載許可','MATE掲載ステータス','契約ID',
                '同意日時','合意証拠URL・メールID','MATE-WEB-'):
   self.assertIn(token,content)
 def test_spark_sync_still_requires_permission_and_contract(self):
  content=(ROOT/'scripts/sync_spark_public.py').read_text(encoding='utf-8')
  for token in ('build_public','掲載許諾','ALLOWED_CONTRACT','同意者','合意証拠URL・メールID'):
   self.assertIn(token,content)
 def test_public_intake_never_directly_approves(self):
  content=(ROOT/'scripts/mate_direct_intake.gs').read_text(encoding='utf-8')
  self.assertIn('"未審査","未確認","",""',content)
  self.assertNotIn('runMateListingApprovalV1()',content)
if __name__=='__main__':unittest.main()
