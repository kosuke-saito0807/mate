"""Static cross-site audit: assets, booking safety, redirects, publishing automation."""
from __future__ import annotations

from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit
import json
import unittest

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / "spark"


class References(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links = []

    def handle_starttag(self, tag, attrs):
        data = dict(attrs)
        for key in ("href", "src", "action"):
            if key in data:
                self.links.append((tag, key, data[key]))


class SiteIntegrity(unittest.TestCase):
    def test_every_local_html_asset_exists(self):
        for root in (ROOT, SITE):
            for page in sorted(root.glob("*.html")):
                parser = References()
                parser.feed(page.read_text(encoding="utf-8"))
                for tag, attribute, value in parser.links:
                    if not value or value.startswith(("#", "mailto:", "tel:", "data:")):
                        continue
                    url = urlsplit(value)
                    if url.scheme in ("http", "https"):
                        continue
                    self.assertFalse(url.scheme, (str(page), value))
                    self.assertFalse(url.path.startswith("//"), (str(page), value))
                    dest = (page.parent / unquote(url.path)).resolve()
                    # Resolve pages linked as directories to index.html.
                    if dest.is_dir():
                        dest /= "index.html"
                    with self.subTest(page=page.relative_to(ROOT), value=value):
                        self.assertTrue(dest.is_relative_to(ROOT))
                        self.assertTrue(dest.exists(), f"{page.relative_to(ROOT)} -> {value}")

    def test_cross_service_navigation_is_current(self):
        for name in ("index.html", "operator.html"):
            html = (ROOT / name).read_text(encoding="utf-8")
            self.assertNotIn("https://naraico.kosuke-saito0807.chatgpt.site", html)
            self.assertIn("https://mate-spark.web.app/", html)
        index = (SITE / "index.html").read_text(encoding="utf-8")
        self.assertIn("https://kosuke-saito0807.github.io/mate/", index)
        self.assertIn("MATE PLAY", index)

    def test_legacy_spark_form_cannot_be_used(self):
        html = (SITE / "compare.html").read_text(encoding="utf-8")
        self.assertIn('<meta http-equiv="refresh" content="0;url=./">', html)
        self.assertNotIn('<form', html)
        self.assertNotIn('fetch(', html)
        self.assertIn("noindex,follow", html)

    def test_safety_of_public_listings_and_forms(self):
        care = json.loads((ROOT / "data.json").read_text(encoding="utf-8"))
        spark = json.loads((SITE / "schools.json").read_text(encoding="utf-8"))
        for p in care:
            self.assertTrue(p.get("verified"))
            self.assertEqual(p.get("status"), "掲載許可")
        for s in spark:
            self.assertTrue(s.get("approved"))
            self.assertNotIn("メール", s)
            self.assertNotIn("合意証拠URL・メールID", s)
        index = (SITE / "index.html").read_text(encoding="utf-8")
        self.assertIn('id="trialForm" method="POST" action="" hidden', index)
        self.assertIn("!demoMode", index)
        self.assertIn("s.approved===true&&s.acceptsTrial===true", index)
        self.assertFalse(json.loads((SITE / "config.json").read_text(encoding="utf-8"))["applyEnabled"])
        self.assertIn('id="listing-contact"', (ROOT / "contact.html").read_text(encoding="utf-8"))
        self.assertIn('id="partnerForm" data-mate-direct-listing="true" hidden', (SITE / "partners.html").read_text(encoding="utf-8"))

    def test_care_export_requires_positive_consent_and_recent_verification(self):
        import sys
        import datetime
        sys.path.insert(0, str(ROOT / "scripts"))
        from sync_google_sheets_public import build_public
        row = {
            "ID": "care-test-1", "事業者名": "テスト事業者",
            "掲載許可": "許可", "MATE掲載ステータス": "掲載許可",
            "公式サイト": "https://example.org/", "掲載情報確認日": "2026-10-20",
            "担当者": "非公開担当者", "メール": "private@example.org",
        }
        today = datetime.date(2026,10,21)
        published = build_public([row],today=today)
        self.assertEqual(len(published),1)
        self.assertEqual(published[0]["verified_at"],"2026-10-20")
        self.assertNotIn("メール",published[0])
        self.assertNotIn("data_as_of",published[0])
        for override in (
            {"掲載許可": "未確認"}, {"MATE掲載ステータス": "未確認"},
            {"公式サイト": "javascript:alert(1)"}, {"掲載情報確認日": ""},
            {"掲載情報確認日": "2026-10-24"}, {"事業者名": ""},
        ):
            self.assertEqual(build_public([{**row, **override}],today=today),[])
        with self.assertRaises(ValueError):
            build_public([row, row],today=today)

    def test_unverified_trial_intake_stays_off_even_after_approved_school(self):
        config = json.loads((SITE / "config.json").read_text(encoding="utf-8"))
        self.assertFalse(config["trialIntakeEnabled"])
        page = (SITE / "index.html").read_text(encoding="utf-8")
        self.assertIn("trialIntakeEnabled=false;",page)
        self.assertNotIn("formsubmit.co",page)
        self.assertIn("e.preventDefault();",page)
        self.assertIn("eligible&&safeHost&&trialIntakeEnabled",page)
        self.assertIn("!eligible||!safeHost||!trialIntakeEnabled",page)

    def test_sync_propagates_consent_changes_to_firebase(self):
        flow = (ROOT / ".github/workflows/sync-smartsheet-public.yml").read_text(encoding="utf-8")
        self.assertIn("steps.commit.outputs.changed == 'true'", flow)
        self.assertIn("FirebaseExtended/action-hosting-deploy", flow)
        self.assertIn("FIREBASE_SERVICE_ACCOUNT_MATE_SPARK", flow)
        self.assertIn("MATE_FIREBASE_AUTO_DEPLOY_ENABLED", flow)
        self.assertNotIn("GmailApp", flow)
        self.assertNotIn("sendEmail", flow)


if __name__ == "__main__":
    unittest.main()
