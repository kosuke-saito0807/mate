"""Ensure read-only daily browser QA checks actual CARE/SPARK/PLAY production hosts.

No website, external account, or Search Console requests are made by these tests.
"""
from pathlib import Path
import unittest

ROOT=Path(__file__).resolve().parents[1]
SCRIPT=(ROOT/"tests/live_three_sites.cjs").read_text(encoding="utf-8")


class ProductionMonitorContracts(unittest.TestCase):
    def test_audit_uses_current_three_production_sites(self):
        for row in (
            "CARE:'https://kosuke-saito0807.github.io/mate/'",
            "SPARK:'https://mate-spark.web.app/'",
            "PLAY:'https://mate-play-production.web.app/'",
        ):
            self.assertIn(row,SCRIPT)
        self.assertIn("const LEGACY_PLAY_ORIGIN=",SCRIPT)
        self.assertNotIn("PLAY:'https://mate-play.kosuke-saito0807.chatgpt.site/'",SCRIPT)

    def test_audit_checks_each_service_title_and_origin(self):
        for title in (
            "ベビーシッター・訪問保育を探す｜MATE CARE",
            "子どもの習い事・教室を探す｜MATE SPARK",
            "親子のお出かけ・体験を探す｜MATE PLAY",
        ):
            self.assertIn(title,SCRIPT)
        self.assertIn("result.title!==EXPECTED_TITLES[service]",SCRIPT)
        self.assertIn("new URL(result.url).origin!==new URL(ORIGINS[service]).origin",SCRIPT)

    def test_removed_footer_copy_is_not_required_for_47_areas(self):
        self.assertIn("if(service==='SPARK'&&data.prefOptions!==47)",SCRIPT)
        self.assertNotIn("if(!data.hasNationwideText)result.warnings.push",SCRIPT)
        self.assertIn("legacyPlayNotCutOver:LEGACY_PLAY_ORIGIN",SCRIPT)

    def test_audit_never_submits_forms(self):
        self.assertIn("page.request.get(href",SCRIPT)
        self.assertNotIn("page.request.post(",SCRIPT)
        self.assertNotIn(".click(",SCRIPT)
        self.assertNotIn(".submit(",SCRIPT)
        self.assertNotIn("formPage.fill(",SCRIPT)


if __name__=="__main__":
    unittest.main()
