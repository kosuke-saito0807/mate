"""Guard against reintroducing recipient-wasting monitoring BCC or weakening send safeguards."""
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
SRC = (ROOT/"scripts/mate_auto_ops_v4.gs").read_text(encoding="utf-8")

class OutreachNoBccTests(unittest.TestCase):
    def test_sending_has_no_owner_bcc_and_diagnostics_explain_scope(self):
        send = SRC.split("function mateV4SendOutreach(){", 1)[1].split("\nfunction ",1)[0]
        self.assertIn("GmailApp.sendEmail(email,subject,body,{name:sender,replyTo:MATE_V4.account})",send)
        self.assertNotIn("bcc:ownerCopy",send)
        self.assertNotIn("MATE_OWNER_COPY_EMAIL",send)
        self.assertIn("MailApp.getRemainingDailyQuota()<1",send)
        self.assertIn("blocked.has(email)",send)
        self.assertIn("allRecipients.has(email)",send)
        self.assertIn("attempted.has(key)",send)
        self.assertIn("MATE_AUTO_SEND_LEGAL_REVIEWED",send)
        self.assertIn("bccCodePolicy:'DISABLED_IN_THIS_SOURCE_ONLY'",SRC)
        self.assertIn("otherProjectsNotInspected:true",SRC)
    def test_readiness_surfaces_aggregated_contact_failures_without_send(self):
        preview=SRC.split("function previewMateOutreachReadinessV4(){",1)[1].split("function mateV4PublicMailOperatorReview_",1)[0]
        self.assertIn("pendingByService",preview)
        self.assertIn("missingEmailByService",preview)
        self.assertIn("noUniqueOfficialEmail",preview)
        self.assertIn("httpsUnavailable",preview)
        self.assertIn("fetchFailed",preview)
        self.assertNotIn("GmailApp.sendEmail(",preview)

    def test_official_contact_discovery_retries_without_relaxing_send_checks(self):
        audit = SRC.split("function mateV4AuditOfficialContacts(){",1)[1].split("function previewMateOutreachReadinessV4(){",1)[0]
        self.assertIn("const retryDays=/取得不可|取得失敗|確認できず/.test(note)?2:",audit)
        self.assertIn("MATE_PUBLIC_AUDIT_BATCH",audit)
        # Slow official-site audits now have a time budget and a hard cap of
        # three per hourly cycle, regardless of a stale Script Property.
        self.assertIn("Math.min(3,Math.max(1,Math.floor(requested)))",audit)
        self.assertIn("MATE_AUDIT_BUDGET_DEFER",audit)
        self.assertIn("checked--;outcomes.budgetDeferred++;break",audit)
        self.assertIn("batchSize",audit)
        self.assertIn("if(x['状態']==='営業可能候補'&&x['営業拒否']==='未確認')return 1;",audit)
        self.assertIn("x['営業拒否']==='FALSE'&&mateV4PublicMailOperatorReview_(x)",audit)
        self.assertIn("if(x['営業拒否']!=='未確認'&&!recheckHeld",audit)
        self.assertIn("if(x['営業拒否']==='未確認')tab.getRange(x._row,13).setValue('FALSE')",audit)
        self.assertIn("mateV4ContactLink_(home.html,home.url)",audit)
        self.assertIn("loaded.push(fetchPage(next))",audit)
        self.assertIn("mateV4SalesRefusal_(z.html)",audit)
        self.assertIn("stopped.has(email)",audit)
        self.assertIn("mateV4OwnerBlocked_(x)",audit)
        self.assertIn("mateV4PublicMailOperatorReview_(audited)",audit)
        self.assertNotIn("GmailApp.sendEmail(",audit)
        self.assertIn("possible.includes(old)",audit)
        self.assertIn("possible.length===1?possible[0]",audit)
        self.assertIn("x['営業拒否']==='未確認'",audit)
        self.assertIn("tab.getRange(x._row,13).setValue('FALSE')",audit)
        self.assertIn("if(x['営業拒否']==='TRUE'",audit)
        self.assertIn("if(refused)",audit)

    def test_first_party_audit_prioritizes_known_role_mailboxes(self):
        audit=SRC.split("function mateV4AuditOfficialContacts(){",1)[1].split("function previewMateOutreachReadinessV4(){",1)[0]
        self.assertIn("const auditPriority=x=>",audit)
        self.assertIn("mateV4RoleEmail_(x['業務用メール'])",audit)
        self.assertIn("auditPriority(a)-auditPriority(b)",audit)
        self.assertIn("businessRoles.length===1?businessRoles[0]",audit)
        self.assertIn("possible.length===1?possible[0]",audit)
        self.assertIn("mateV4SalesRefusal_(z.html)",audit)
        self.assertIn("stopped.has(email)",audit)
        self.assertNotIn("GmailApp.sendEmail(",audit)

    def test_business_site_redirects_do_not_follow_third_parties(self):
        getter=SRC.split("function mateV4PublicHtml_(url){",1)[1].split("function mateV4ContactLink_",1)[0]
        self.assertIn("followRedirects:false",getter)
        self.assertIn("mateV4SameBusinessHost_(target,url)",getter)
        self.assertIn("mateV4Https_(target)",getter)
        self.assertIn("if(status!==200)return ''",getter)
        self.assertIn("bytes.length>250000",getter)
        self.assertIn("hop<2",getter)
    def test_curated_registry_reuses_prospects_without_unverified_sends(self):
        seed=SRC.split("function mateV4SeedSectorDirectories(){",1)[1].split("/** Business fit is a rank hint",1)[0]
        self.assertIn("東京都認定_営業優先",seed)
        self.assertIn("今すぐ営業リスト",seed)
        self.assertIn("seenBusinessHosts",seed)
        self.assertIn("seenCompanies",seed)
        self.assertIn("seenCompanies.has(company)",seed)
        self.assertIn("mateV4OwnerBlocked_",seed)
        self.assertIn("'UNVERIFIED'",seed)
        self.assertIn("'窓口確認待ち'",seed)
        self.assertNotIn("GmailApp.sendEmail(",seed)


    def test_first_outreach_explains_public_listing_preview_and_approval_boundary(self):
        send = SRC.split("function mateV4SendOutreach(){", 1)[1].split(
            "function diagnoseMateV4Backlog(){", 1)[0]
        self.assertIn("const listingPreview=", send)
        for url in ("https://care.kosodatemate.jp/sitter-directory.html",
                    "https://spark.kosodatemate.jp/school-directory.html",
                    "https://play.kosodatemate.jp/"):
            self.assertIn(url, send)
        self.assertIn("'掲載イメージ・検索画面：'+listingPreview", send)
        self.assertIn("掲載承認・提携・推薦を意味しません", send)
        self.assertIn("申請者様の権限と内容を別途確認します", send)
        for safeguard in ("attempted.add(key)", "blocked.has(email)",
                          "manualHistory.has(email)", "MailApp.getRemainingDailyQuota()"):
            self.assertIn(safeguard, send)

    def test_backlog_diagnosis_separates_evidence_from_permission(self):
        section = SRC.split("function diagnoseMateV4Backlog(){", 1)[1].split(
            "function diagnoseMateV4Health(){", 1)[0]
        for status in ("pendingOfficialAudit", "publicEmailReviewHold",
                       "refusalNotReviewed", "validWithoutGmailHistoryCheck"):
            self.assertIn(status, section)
        self.assertIn("never infer consent", section)
        self.assertNotIn("GmailApp.sendEmail(", section)


if __name__ == "__main__":
    unittest.main()
