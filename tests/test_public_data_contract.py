"""Offline data quality regression tests; never read contacts or the CRM."""
import importlib.util
import unittest
from pathlib import Path
MOD=Path(__file__).resolve().parents[1]/"scripts/check_public_data_contract.py"
spec=importlib.util.spec_from_file_location("mate_public_data_check",MOD)
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class PublicDataContractTests(unittest.TestCase):
 def test_current_public_files(self): m.main()
 def test_never_publish_unapproved_or_demo(self):
  base={"id":"p_1","name":"サンプル","status":"掲載許可","verified":True,"verified_at":"2026-10-20","official_url":"https://example.org/"}
  self.assertEqual(m.check_rows([base],"CARE"),1)
  for row in ({**base,"verified":False},{**base,"id":"demo-1"},{**base,"official_url":"http://example.org"},{**base,"email":"private@example.org"},{**base,"verified_at":"2030-10-20"}):
   with self.subTest(row=row),self.assertRaises(m.PublicDataError):m.check_rows([row],"CARE")
 def test_no_duplicate_or_private_contact(self):
  base={"id":"s_1","name":"sample","approved":True,"verifiedAt":"2026-10-20","url":"https://example.org/"}
  self.assertEqual(m.check_rows([base],"SPARK"),1)
  for rows in ([base,base],[{**base,"contactEmail":"someone@example.org"}],[{**base,"consent_proof":"private"}],[{**base,"url":"https://user:pass@example.org"}]):
   with self.subTest(rows=rows),self.assertRaises(m.PublicDataError):m.check_rows(rows,"SPARK")
 def test_demo_separate(self):
  self.assertEqual(m.check_demo([{"id":"demo-1","demo":True}]),1)
  with self.assertRaises(m.PublicDataError):m.check_demo([{"id":"real-1","demo":False}])
if __name__=="__main__":unittest.main()
