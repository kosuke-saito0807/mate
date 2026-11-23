"""Trustworthy SPARK editorial directory and contextual CARE/PLAY navigation."""
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parents[1]
SPARK = "https://spark.kosodatemate.jp/school-directory.html"
PLAY = "https://play.kosodatemate.jp/experiences"


class SparkReferenceNavigation(unittest.TestCase):
    def test_family_paths_link_to_relevant_play_directory(self):
        for filename in (
            "spark/index.html",
            "spark/school-directory.html",
            "spark/guide-lesson-trial-review.html",
            "spark/guide-lessons-choice.html",
            "spark/guide-lessons-age-two.html",
        ):
            with self.subTest(filename=filename):
                page = (ROOT / filename).read_text(encoding="utf-8")
                self.assertIn(f'href="{PLAY}"', page)
                self.assertIn("未承認", page)
                self.assertRegex(page, "公式情報|公式案内|公式サイト")
                self.assertNotIn(f'rel="nofollow" href="{PLAY}"', page)

    def test_outdated_approval_and_launch_claims_removed(self):
        trial = (ROOT / "spark/guide-lesson-trial-review.html").read_text(encoding="utf-8")
        choice = (ROOT / "spark/guide-lessons-choice.html").read_text(encoding="utf-8")
        self.assertNotIn("許諾済みの実在教室", trial)
        self.assertNotIn("掲載は現在準備中", choice)
        self.assertNotIn("掲載情報は許諾・内容確認後に順次公開", choice)
        self.assertIn("事業者が未承認", trial)
        self.assertIn("未承認の参考紹介", choice)
        for page in (trial, choice):
            self.assertTrue('href="school-directory.html"' in page or 'href="https://spark.kosodatemate.jp/school-directory.html"' in page)

    def test_editorial_record_and_owner_application_are_still_separate(self):
        directory = (ROOT / "spark/school-directory.html").read_text(encoding="utf-8")
        self.assertIn("事業者未承認", directory)
        self.assertIn("この教室のご担当者様ですか？", directory)
        self.assertIn('data-mate-owner-claim="SPARK"', directory)
        self.assertIn("partners.html#claim=editorial-", directory)
        self.assertIn("主催者の公式サイト", directory.replace("事業者の公式サイト", "主催者の公式サイト"))

    def test_ai_manifest_links_directory_with_approval_disclosure(self):
        manifest = (ROOT / "spark/llms.txt").read_text(encoding="utf-8")
        self.assertIn(f"]({PLAY})", manifest)
        self.assertIn("事業者未承認参考紹介", manifest)
        self.assertIn("対象年齢", manifest)

    def test_aggregate_cross_service_click_never_includes_user_data(self):
        care = (ROOT / "assets/mate-funnel-events.js").read_text(encoding="utf-8")
        spark = (ROOT / "spark/assets/mate-funnel-events.js").read_text(encoding="utf-8")
        self.assertEqual(care, spark)
        self.assertIn("mate_cross_service_click", care)
        self.assertIn("href === 'https://play.kosodatemate.jp/experiences'", care)
        self.assertIn("destination_type: 'editorial_directory'", care)
        self.assertIn("target_service: 'PLAY'", care)
        self.assertNotIn("emit('mate_cross_service_click', { href:", care)
        self.assertNotIn("document.referrer", care)
        self.assertNotIn("location.search", care)

    def test_other_domain_is_never_inserted_into_spark_sitemap(self):
        sitemap = (ROOT / "spark/sitemap.xml").read_text(encoding="utf-8")
        self.assertIn(SPARK, sitemap)
        self.assertNotIn(PLAY, sitemap)


if __name__ == "__main__":
    unittest.main()
