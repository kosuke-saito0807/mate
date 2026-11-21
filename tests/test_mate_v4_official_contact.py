"""Contact audit evidence is first-party, bounded, aggregate, and no-send."""
from pathlib import Path
import shutil
import subprocess
import unittest

ROOT = Path(__file__).resolve().parents[1]
CODE = (ROOT / "scripts/mate_auto_ops_v4.gs").read_text(encoding="utf-8")


class OfficialContactAuditTests(unittest.TestCase):
    def test_audit_discloses_why_new_contacts_cannot_be_confirmed(self):
        audit = CODE.split("function mateV4AuditOfficialContacts(){", 1)[1].split(
            "function previewMateOutreachReadinessV4(){", 1)[0]
        for key in ("officialSiteUnavailable", "solicitationRefusal",
                    "noUniquePublishedRoleEmail", "optoutSuppressed",
                    "verifiedButReviewHeld", "readyAfterReview",
                    "auditException"):
            self.assertIn(key, audit)
        self.assertIn("outcomes,", audit)
        self.assertIn("mateV4SalesRefusal_(z.html)", audit)
        self.assertIn("mateV4PublishedEmails_(z.html)", audit)
        self.assertIn("stopped.has(email)", audit)
        self.assertIn("mateV4PublicMailOperatorReview_(audited)", audit)
        self.assertNotIn("GmailApp.sendEmail(", audit)

    def test_monitor_collects_only_aggregate_audit_counts(self):
        monitor = CODE.split("function mateV4ProductionHeartbeat_(report){", 1)[1].split(
            "function mateAutoOpsV4Cycle(){", 1)[0]
        self.assertIn("report.publicAudit.outcomes", monitor)
        self.assertIn("sheet.getRange(2,13)", monitor)
        self.assertNotIn("業務用メール", monitor)
        self.assertNotIn("宛先メール", monitor)

    def test_live_js_has_valid_syntax_and_contact_parser_works(self):
        if not shutil.which("node"):
            self.skipTest("Node.js unavailable")
        # Node does not recognize the Apps Script .gs extension when given
        # as a file. --check on stdin performs the same syntax validation.
        syntax = subprocess.run(
            ["node", "--check"], input=CODE, cwd=ROOT,
            capture_output=True, text=True
        )
        self.assertEqual(syntax.returncode, 0, syntax.stdout + syntax.stderr)
        runtime = subprocess.run(
            ["node", "--test", "scripts/ci/test-official-contact-audit.mjs"],
            cwd=ROOT, capture_output=True, text=True
        )
        self.assertEqual(runtime.returncode, 0, runtime.stdout + runtime.stderr)


if __name__ == "__main__":
    unittest.main()
