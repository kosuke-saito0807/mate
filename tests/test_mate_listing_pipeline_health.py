"""Read-only listing-pipeline diagnostics safeguards. No GAS execution or emails."""
import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]

class ListingPipelineDiagnosticsTests(unittest.TestCase):
    def test_aggregate_health_diagnostic_does_not_send_or_write(self):
        src=(ROOT/"scripts/mate_publication_completion_mail.gs").read_text(encoding="utf-8")
        marker="function auditMateListingPipelineV1(){"
        self.assertIn(marker,src)
        body=src.split(marker,1)[1].split("\n}",1)[0]
        self.assertIn('READ_ONLY_NO_SEND_NO_PUBLISH',body)
        self.assertIn("ScriptApp.getProjectTriggers()",body)
        for forbidden in (
            "MailApp.sendEmail", "GmailApp.sendEmail", ".setValue(",
            ".setValues(", ".appendRow(", "UrlFetchApp.fetch(",
            "matePubRun_(true)", "matePubReconcile_(true)"
        ):
            with self.subTest(forbidden=forbidden):
                self.assertNotIn(forbidden,body)
        for service in ("CARE","SPARK","PLAY"):
            self.assertIn(service+":{applications:0",body)
        self.assertNotIn('email:',body)
        self.assertNotIn('company:',body)

if __name__=="__main__":unittest.main()
