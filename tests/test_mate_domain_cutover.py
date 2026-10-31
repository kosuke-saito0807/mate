"""No-host-change regression checks for the eventual MATE custom domain."""
import importlib.util
import json
import subprocess
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("mate_cutover", ROOT / "scripts/mate_domain_cutover_inventory.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class DomainInventoryTests(unittest.TestCase):
    def test_current_baseline_and_known_mate_sites(self):
        report = module.inventory()
        self.assertEqual(report["mode"], "READ_ONLY_PREPARATION")
        self.assertIsNone(report["domain"])
        self.assertFalse(report["domain_ownership_verified"])
        self.assertEqual(set(report["current_sites"]), {"CARE", "SPARK", "PLAY"})
        self.assertTrue(report["files_with_current_or_legacy_urls"])
        self.assertEqual(report["proposed_sites"], {})

    def test_future_custom_domain_is_only_a_proposal(self):
        report = module.inventory(domain="example.jp")
        self.assertEqual(report["proposed_sites"]["CARE"], "https://care.example.jp/")
        self.assertEqual(report["proposed_sites"]["SPARK"], "https://spark.example.jp/")
        self.assertEqual(report["proposed_sites"]["PLAY"], "https://play.example.jp/")
        self.assertFalse(report["domain_ownership_verified"])
        self.assertIn("Search Console", " ".join(report["gates_before_any_publication"]))
        self.assertIn("XServer Domain", " ".join(report["gates_before_any_publication"]))
        self.assertIn("Cloudflare is DNS provider", " ".join(report["gates_before_any_publication"]))
        proposed = module.inventory(domain="kosodatemate.jp")
        self.assertEqual(proposed["proposed_sites"], {
            "CARE": "https://care.kosodatemate.jp/",
            "SPARK": "https://spark.kosodatemate.jp/",
            "PLAY": "https://play.kosodatemate.jp/",
        })
        self.assertFalse(proposed["domain_ownership_verified"])
        self.assertIn("deploy", report["prohibited_actions"])

    def test_rejects_provider_hosts_paths_or_malformed_domains(self):
        for domain in ("https://example.jp", "example.jp/foo", "mate-spark.web.app",
                       "example.github.io", "example.chatgpt.site", "EXAMPLE.JP",
                       "example..jp", "-example.jp", "example.jp/"):
            with self.subTest(domain=domain):
                with self.assertRaises(ValueError):
                    module.validate_domain(domain)
        self.assertEqual(module.validate_domain("mate.co.jp"), "mate.co.jp")

    def test_cli_does_not_write_or_guess_domain(self):
        before = (ROOT / "index.html").read_bytes()
        result = subprocess.run(
            [sys.executable, str(ROOT / "scripts/mate_domain_cutover_inventory.py")],
            check=True, capture_output=True, text=True,
        )
        report = json.loads(result.stdout)
        self.assertIsNone(report["domain"])
        self.assertEqual((ROOT / "index.html").read_bytes(), before)


if __name__ == "__main__":
    unittest.main()
