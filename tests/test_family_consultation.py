"""End-user CARE/PLAY privacy-first forms and safe self-service handoff contracts."""
from pathlib import Path
import subprocess
import unittest
ROOT=Path(__file__).resolve().parents[1]
class FamilyFormTests(unittest.TestCase):
 def test_care_play_share_one_no_account_form(self):
  s=(ROOT/"consult.html").read_text(encoding="utf-8")
  self.assertIn("会員登録なし・無料・メールアドレスのみ必須",s)
  self.assertIn("get('service')==='PLAY'",s)
  self.assertIn('name="email" type="email" autocomplete="email" maxlength="254" required',s)
  self.assertIn('name="guardianName" autocomplete="name"',s)
  self.assertIn('name="phone" type="tel"',s)
  self.assertIn('name="privacy_agree" type="checkbox" value="同意する" required',s)
  self.assertIn('name="referral_interest" type="checkbox"',s)
  self.assertNotIn('name="guardianName" required',s)
  self.assertNotIn('name="phone" required',s)
  self.assertNotIn('name="childName"',s)
  self.assertNotIn('name="schoolName"',s)
  self.assertIn("掲載事業者には自動転送しません",s)
  self.assertIn("個別に説明し、利用者の同意", (ROOT/"consult-privacy.html").read_text(encoding="utf-8"))
  self.assertIn("https://formsubmit.co/ajax/kosodatemate@gmail.com",s)
  self.assertIn("json.success",s)
  self.assertIn("Object.fromEntries(new FormData(form))",s)
  self.assertIn("lead_type:'family_inquiry'",s)
 def test_front_door_links_and_current_play_application(self):
  self.assertIn('href="consult.html?service=CARE"', (ROOT/"index.html").read_text(encoding="utf-8"))
  self.assertIn('href="consult.html?service=PLAY"', (ROOT/"play-listing.html").read_text(encoding="utf-8"))
 def test_actual_gas_e2e_mock_runs_without_email_or_writes(self):
  p=subprocess.run(["node","tests/test_mate_selfservice_e2e.cjs"],cwd=ROOT,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
  self.assertEqual(p.returncode,0,p.stdout+"\n"+p.stderr)
  self.assertIn("PASS SPARK",p.stdout)
  self.assertIn("PASS CARE",p.stdout)
  self.assertIn("PASS PLAY",p.stdout)
if __name__=="__main__": unittest.main()
