"""CARE / SPARK self-service applicant flow is complete, safe and no-login."""
import re
import subprocess
import unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]

class OwnerSelfServiceTest(unittest.TestCase):
    def test_owner_self_registers_without_accounts(self):
        for path,svc in (("contact.html","CARE"),("spark/partners.html","SPARK"),("play-listing.html","PLAY")):
            html=(ROOT/path).read_text(encoding="utf-8")
            with self.subTest(service=svc):
                self.assertIn('name="service" value="'+svc+'"',html)
                for field in ("company","website","name","email","region","city","category",
                              "description","listing_content_checked_at","listing_permission",
                              "trial_referral_consent","listing_payload_b64"):
                    self.assertRegex(html,r'name="'+field+r'"')
                if svc=="PLAY":
                    self.assertIn("事務局にて内容と掲載権限を確認",html)
                    self.assertNotIn("会員登録不要・掲載料無料。フォーム送信後",html)
                else:
                    self.assertIn("会員登録不要",html)
                self.assertIn('name="description"',html)
                self.assertIn('minlength="25"',html)
                self.assertIn('name="listing_permission"',html)
                self.assertIn('name="trial_referral_consent"',html)

    def test_spark_school_grade_range_maps_to_legacy_age_fields(self):
        page=(ROOT/"spark/partners.html").read_text(encoding="utf-8")
        script=(ROOT/"spark/assets/mate-self-service.js").read_text(encoding="utf-8")
        for name in ("gradeFrom","gradeTo"):
            self.assertIn('name="'+name+'" required',page)
        for label in ("0歳（乳児）","1歳","2歳","年少","年中","年長","小学1年生",
                      "小学6年生","中学1年生","高校3年生"):
            self.assertIn(label,page)
        self.assertIn('name="ageMin" type="hidden"',page)
        self.assertIn('name="ageMax" type="hidden"',page)
        self.assertIn('name="ages" type="hidden"',page)
        self.assertNotIn('type="number" min="0" max="18" name="ageMin"',page)
        self.assertIn("first>last",script)
        self.assertIn('form.elements.namedItem("ageMin").value',script)
        self.assertIn('form.elements.namedItem("ageMax").value',script)
        self.assertIn('form.elements.namedItem("ages").value',script)
        self.assertIn("grades.indexOf(from)",script)
        self.assertIn('"a0","a1","a2"',script)
        self.assertIn("const lower=[0,1,2,3",script)
        self.assertIn("const upper=[0,1,2,4",script)
        self.assertIn("category.join",script)
        r=subprocess.run(["node","--check"],input=script,text=True,capture_output=True)
        self.assertEqual(r.returncode,0,r.stderr)

    def test_operator_receipt_email_deep_links_to_correct_review_row(self):
        script=(ROOT/"scripts/mate_direct_intake.gs").read_text(encoding="utf-8")
        self.assertIn("function mateDirectReviewLink_(book,apps,aid,sourceRow)",script)
        self.assertIn("ids[i][0]===aid",script)
        self.assertIn("ids[j][0]!==sourceIds[j][0]",script)
        self.assertIn("getRange(2,31,last-1,1)",script)
        self.assertIn("reviewTarget?reviewTarget.url",script)
        self.assertIn('"/edit#gid="+apps.getSheetId()+"&range=A"',script)
        self.assertIn("reviewTarget&&reviewTarget.pending",script)
        self.assertNotIn('"/edit#gid=193110041",',script)

    def test_no_customer_pii_in_business_registration_payload(self):
        for path in ("assets/mate-self-service.js","spark/assets/mate-self-service.js"):
            text=(ROOT/path).read_text(encoding="utf-8")
            self.assertIn("MATE_LISTING_V1__",text)
            for banned in ('"email"','"phone"','"guardianName"','"name"'):
                self.assertNotIn(banned,text)
            self.assertIn("listing_permission",text)
            r=subprocess.run(["node","--check"],input=text,text=True,capture_output=True)
            self.assertEqual(r.returncode,0,r.stderr)

    def test_invalid_age_and_dates_rejected_before_submitting(self):
        for filename in ("assets/mate-self-service.js","spark/assets/mate-self-service.js"):
            content=(ROOT/filename).read_text(encoding="utf-8")
            self.assertIn('Number(data.ageMin)>Number(data.ageMax)',content)
            self.assertIn('data.nextTrialDate<data.listing_content_checked_at',content)
            self.assertIn('data.listing_content_checked_at>todayJst',content)
            self.assertIn('Date.now()+9*60*60*1000',content)
            check=subprocess.run(["node","--check"],input=content,text=True,capture_output=True)
            self.assertEqual(check.returncode,0,check.stderr)

    def test_registrations_require_human_approval(self):
        gs=(ROOT/"scripts/mate_self_service.gs").read_text(encoding="utf-8")
        for token in ("syncMateSelfServiceApplications","publishReviewedMateApplications",
                      'a[24]!=="承認"','a[25]!=="確認済み"',
                      '"状態":"未契約"','"体験受付許諾":"未確認"'):
            self.assertIn(token,gs)
        # CARE approval prepares an INACTIVE contract; it does not publish
        # until a separate authorized signer and evidence are recorded.
        self.assertIn('"サービス":"CARE","掲載先ID":unique',gs)
        self.assertIn('sheet.getRange(i+2,25).setValue("契約確認待ち")',gs)
        self.assertNotIn("GmailApp.sendEmail",gs)
        self.assertNotIn("GmailApp.createDraft",gs)
        self.assertNotIn("メールアドレス",gs)
        r=subprocess.run(["node","--check"],input=gs,text=True,capture_output=True)
        self.assertEqual(r.returncode,0,r.stderr)

    def test_care_publishes_preverified_business_details_only(self):
        script=(ROOT/"scripts/sync_google_sheets_public.py").read_text(encoding="utf-8")
        for field in ("掲載紹介文","サービス区分","料金メモ","対応時間","特徴タグ"):
            self.assertIn(field,script)
        search=(ROOT/"assets/provider-search.js").read_text(encoding="utf-8")
        self.assertIn("p.description",search)
        self.assertIn("p.pricingNotes",search)
        self.assertIn("escapeHtml",search)

    def test_privacy_first_visitor(self):
        html=(ROOT/"spark/index.html").read_text(encoding="utf-8")
        self.assertNotIn('class="privacyComfort"',html)
        self.assertIn('name="guardianName"',html)
        self.assertNotIn('name="guardianName" maxlength="80" autocomplete="name" required',html)
        self.assertNotIn('name="grade" required',html)
        self.assertIn('name="email" type="email" maxlength="254" autocomplete="email" required',html)
        self.assertIn('name="agreed" value="yes" required',html)

if __name__=="__main__":
    unittest.main()
