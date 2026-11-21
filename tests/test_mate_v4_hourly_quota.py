"""Guard against hourly Gmail quota retry storms without weakening sales suppression."""
from pathlib import Path
import shutil
import subprocess
import unittest

ROOT = Path(__file__).resolve().parents[1]
FILE = ROOT / "scripts/mate_auto_ops_v4.gs"


class HourlyQuotaTests(unittest.TestCase):
    def setUp(self):
        self.code = FILE.read_text(encoding="utf-8")
        self.hourly = self.code.split("function mateAutoOpsV4Cycle(){", 1)[1].split(
            "function mateV4FastZeroSendReason_(){", 1)[0]

    def test_hourly_observes_fast_cycle_jst_cooldown(self):
        self.assertIn("const gmailQuotaKey='MATE_FAST_GMAIL_QUOTA_BLOCKED_JST'", self.hourly)
        self.assertIn("PAUSED_UNTIL_NEXT_JST_DAY", self.hourly)
        self.assertIn("GMAIL_QUOTA_COOLDOWN_NO_GMAIL_CALLS", self.hourly)
        self.assertIn("SKIPPED_GMAIL_QUOTA_COOLDOWN", self.hourly)

    def test_no_suppression_or_duplicate_guards_removed(self):
        for text in ("report.optouts=mateV4OptoutInbox()",
                     "report.hardBounces=mateV4HardBounceQuarantine()",
                     "report.reconciledSent=mateV4ReconcileSentReservations()",
                     "report.outreach=mateV4SendOutreach()",
                     "UNKNOWN_REQUIRES_SENT_LOG_RECONCILIATION"):
            self.assertIn(text, self.hourly)
        self.assertLess(self.hourly.index("report.optouts=mateV4OptoutInbox()"),
                        self.hourly.index("report.outreach=mateV4SendOutreach()"))

    def test_js_syntax(self):
        if not shutil.which("node"):
            self.skipTest("Node.js unavailable")
        result = subprocess.run(["node", "--check"], input=self.code,
                                text=True, capture_output=True)
        self.assertEqual(result.returncode, 0, result.stderr)


if __name__ == "__main__":
    unittest.main()
