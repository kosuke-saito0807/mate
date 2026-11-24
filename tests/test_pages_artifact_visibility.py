"""Protect GitHub Pages deployment from upload-to-API visibility races."""
from pathlib import Path
import unittest

REPO=Path(__file__).resolve().parents[1]

class PagesArtifactReadiness(unittest.TestCase):
    def test_pages_upload_and_deploy_use_exactly_matching_unique_name(self):
        workflow=(REPO/".github/workflows/pages.yml").read_text(encoding="utf-8")
        name="github-pages-${{ github.run_id }}-${{ github.run_attempt }}"
        self.assertEqual(workflow.count(name),2)
        self.assertIn("actions: read",workflow)
        upload=workflow.index("uses: actions/upload-pages-artifact@v4")
        readiness=workflow.index("name: Wait for Pages artifact visibility (read-only)")
        deploy=workflow.index("uses: actions/deploy-pages@v4")
        self.assertLess(upload,readiness)
        self.assertLess(readiness,deploy)
        self.assertIn('gh api "repos/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}/artifacts"',workflow)
        self.assertIn("grep -Fxq",workflow)
        self.assertIn("sleep 5",workflow)
        self.assertIn("sleep 25",workflow)
        self.assertIn("Pages deployment metadata to settle",workflow)
        self.assertLess(workflow.index("sleep 25"),deploy)
        self.assertGreater(workflow.index("sleep 25"),readiness)
        self.assertIn("exit 1",workflow)
        self.assertIn("GH_TOKEN: ${{ github.token }}",workflow)
        self.assertIn('artifact="github-pages-${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT}"',workflow)

    def test_hardened_release_checks_and_no_mail_send_preserved(self):
        workflow=(REPO/".github/workflows/pages.yml").read_text(encoding="utf-8")
        for token in ("scripts/audit_all_public_seo.py",
                      "scripts/check_live_release.py CARE",
                      "actions/configure-pages@v5",
                      "editorial-care.json editorial-play.json",
                      "cp -R spark _site/spark"):
            self.assertIn(token,workflow)
        self.assertNotIn("sendEmail(",workflow)


if __name__=="__main__":
    unittest.main()
