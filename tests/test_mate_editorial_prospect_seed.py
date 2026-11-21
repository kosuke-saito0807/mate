"""Safeguard candidate sourcing: a public reference is never permission to solicit."""
from pathlib import Path
import json
import shutil
import subprocess
import unittest

ROOT = Path(__file__).resolve().parents[1]
GAS = (ROOT/"scripts/mate_auto_ops_v4.gs").read_text(encoding="utf-8")


class EditorialProspectSeedTest(unittest.TestCase):
    def test_import_is_in_rotating_phase_not_the_sender(self):
        phase = GAS.split("function mateAutoOpsV4Cycle(){",1)[1].split(
            "/**\n * Separate short send-only runner",1)[0]
        self.assertIn("report.editorialProspects=safe('editorialProspects',mateV4SeedEditorialProspects)", phase)
        self.assertIn("phaseIndex===1",phase)
        self.assertLess(phase.index("report.outreach=mateV4SendOutreach()"),
                        phase.index("report.editorialProspects=safe"))
        self.assertIn("report.generalWebDiscovery",phase)
        self.assertIn("report.collected",phase)

    def test_only_current_unapproved_editorial_sources_enter_staging(self):
        fn = GAS.split("function mateV4SeedEditorialProspects(){",1)[1].split(
            "/** Business fit is a rank hint",1)[0]
        self.assertIn("https://care.kosodatemate.jp/editorial-care.json",fn)
        self.assertIn("https://spark.kosodatemate.jp/editorial-schools.json",fn)
        self.assertIn("entry.editorial!==true||entry.approved!==false",fn)
        self.assertIn("'UNVERIFIED'",fn)
        self.assertIn("'未確認','窓口確認待ち'",fn)
        self.assertIn("sendApproved:0",fn)
        self.assertIn("mateV4OwnerBlocked_",fn)
        self.assertIn("maxAppend=50",fn)
        self.assertIn("followRedirects:false",fn)
        self.assertIn("source:'MATE_UNAPPROVED_EDITORIAL'",fn)
        for forbidden in ("GmailApp.", "MailApp.", "sendEmail(", "FormApp.",
                          "approveListing", "publishListing", "chargeCard"):
            self.assertNotIn(forbidden,fn)

    def test_monitor_keeps_aggregate_seeding_evidence_separate_from_send_counts(self):
        heartbeat = GAS.split("function mateV4ProductionHeartbeat_(report){",1)[1].split(
            "function mateAutoOpsV4Cycle(){",1)[0]
        self.assertIn("report.editorialProspects!==undefined",heartbeat)
        self.assertIn("sheet.getRange(1,14)",heartbeat)
        self.assertIn("sheet.getRange(2,14)",heartbeat)
        self.assertIn("送信未許可",heartbeat)
        self.assertIn("safeSend",heartbeat)
        self.assertNotIn("r['業務用メール']",heartbeat)

    def test_bundled_public_json_is_explicitly_unapproved(self):
        for path in ("editorial-care.json","spark/editorial-schools.json"):
            with self.subTest(path=path):
                records=json.loads((ROOT/path).read_text(encoding="utf-8"))
                self.assertGreater(len(records),10)
                self.assertTrue(all(r.get("editorial") is True and
                                    r.get("approved") is False for r in records))

    def test_live_javascript_syntax_and_unit_behavior(self):
        if not shutil.which("node"):
            self.skipTest("Node.js unavailable")
        result=subprocess.run(
            ["node","--test","scripts/ci/test-editorial-prospects.mjs"],
            cwd=ROOT,capture_output=True,text=True,
        )
        self.assertEqual(result.returncode,0,result.stdout+result.stderr)


if __name__=="__main__":
    unittest.main()
