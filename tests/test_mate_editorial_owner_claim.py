"""Owner claim entrances must remain unapproved editorial references until verified."""
from pathlib import Path
import json
import re
import shutil
import subprocess
import unittest

ROOT = Path(__file__).resolve().parents[1]


class EditorialOwnerClaimTests(unittest.TestCase):
    CASES = (
        ("CARE", "editorial-care.json", "sitter-directory.html",
         "contact.html", "scripts/sync-care-directory.py"),
        ("SPARK", "spark/editorial-schools.json", "spark/school-directory.html",
         "partners.html", "scripts/sync-spark-directory.py"),
    )

    def test_owner_claim_links_map_only_to_unapproved_reference_cards(self):
        for service, data_path, html_path, form, generator in self.CASES:
            with self.subTest(service=service):
                records = json.loads((ROOT / data_path).read_text(encoding="utf-8"))
                approved = {r["id"] for r in records
                            if r.get("approved") is True}
                refs = {r["id"] for r in records
                        if r.get("editorial") is True and r.get("approved") is False}
                html = (ROOT / html_path).read_text(encoding="utf-8")
                links = re.findall(
                    r'data-mate-owner-claim="' + service +
                    r'" href="' + form + r'#claim=(editorial-[a-z0-9_-]+)"', html)
                self.assertEqual(set(links), refs)
                self.assertEqual(len(links), len(refs), "each public reference gets one CTA")
                self.assertFalse(set(links) & approved)
                self.assertIn("未承認", html)
                self.assertIn("無料の正式掲載を申請する", html)
                self.assertIn("data-mate-owner-claim", (ROOT / generator).read_text(encoding="utf-8"))

    def test_prefill_is_not_verification_or_automatic_publishing(self):
        for service, _, _, form, _ in self.CASES:
            with self.subTest(service=service):
                path = ("" if service == "CARE" else "spark/") + form
                html = (ROOT / path).read_text(encoding="utf-8")
                self.assertIn('data-mate-claim-notice', html)
                self.assertIn('src="assets/mate-reference-claim.js"', html)
                self.assertIn('data-mate-direct-listing="true"', html)
                script = (ROOT / path).parent / "assets/mate-reference-claim.js"
                self.assertTrue(script.exists())
                self.assertIn("approved === false", script.read_text(encoding="utf-8"))
                self.assertIn("本人確認や掲載承認ではありません", script.read_text(encoding="utf-8"))
                self.assertNotIn("submit()", script.read_text(encoding="utf-8"))

    def test_claim_events_do_not_include_reference_or_personal_data(self):
        for path in ("assets/mate-funnel-events.js", "spark/assets/mate-funnel-events.js"):
            script = (ROOT / path).read_text(encoding="utf-8")
            self.assertIn("mate_owner_claim_entry_click", script)
            self.assertIn("entry_type: 'editorial_reference'", script)
            self.assertNotIn("claimReferenceId:", script)

    def test_rebuild_idempotent_and_client_behavior(self):
        if not shutil.which("node"):
            self.skipTest("Node unavailable")
        subprocess.run(["node", "--test", "scripts/ci/test-editorial-claim.mjs"],
                       cwd=ROOT, capture_output=True, text=True, check=True)
        for _, _, directory, _, script in self.CASES:
            with self.subTest(script=script):
                subprocess.run(["python3", script], cwd=ROOT, capture_output=True,
                               text=True, check=True)
                expected = (ROOT / directory).read_text(encoding="utf-8")
                subprocess.run(["python3", script], cwd=ROOT, capture_output=True,
                               text=True, check=True)
                self.assertEqual(expected,
                                 (ROOT / directory).read_text(encoding="utf-8"))


if __name__ == "__main__":
    unittest.main()
