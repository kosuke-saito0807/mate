"""Pre-release contract: indexable pages and telemetry assets must be verifiable."""
from pathlib import Path
import importlib.util
import unittest

ROOT = Path(__file__).resolve().parents[1]

class LiveReleaseContractTests(unittest.TestCase):
    def test_sitemap_discovery_and_analytics_assets_are_verified_after_deploy(self):
        spec = importlib.util.spec_from_file_location(
            "mate_live_release", ROOT / "scripts" / "check_live_release.py"
        )
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        for service in ("CARE", "SPARK"):
            pages = module.SITES[service]["pages"]
            self.assertIn("/", pages)
            self.assertIn("/sitemap.xml", pages)
            self.assertIn("/robots.txt", pages)
            self.assertIn("/assets/mate-funnel-events.js", pages)
            self.assertIn("assets/mate-funnel-events.js", pages["/"])
            self.assertIn("mate_provider_outbound_click", pages["/assets/mate-funnel-events.js"])
        self.assertIn("/sitter-directory.html", module.SITES["CARE"]["pages"])
        self.assertIn("/school-directory.html", module.SITES["SPARK"]["pages"])
        self.assertIn("Allow: /schools.json", module.SITES["SPARK"]["pages"]["/robots.txt"])

if __name__ == "__main__":
    unittest.main()
