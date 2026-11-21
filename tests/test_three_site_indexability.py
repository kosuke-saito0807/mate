"""Offline regression tests for the public 3-site indexability monitor."""
import importlib.util
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location(
    "indexability", ROOT / "scripts/check_three_site_indexability.py")
monitor = importlib.util.module_from_spec(spec)
spec.loader.exec_module(monitor)


def html(url, robots="index,follow"):
    return (
        '<!doctype html><html><head><title>MATE公開サービスの案内</title>'
        '<meta name="description" content="安心してサービスを比較できます。">'
        f'<meta name="robots" content="{robots}">'
        f'<link rel="canonical" href="{url}"></head>'
        '<body><main><h1>サービスを探す</h1></main></body></html>'
    )


class IndexabilityTests(unittest.TestCase):
    def setUp(self):
        self.origin = "https://care.kosodatemate.jp"
        self.pages = ("/", "/sitter-directory.html")
        self.assets = {
            "/robots.txt": "User-agent: *\nAllow: /\nSitemap: " + self.origin + "/sitemap.xml\n",
            "/sitemap.xml": ("<?xml version='1.0'?><urlset>"
                             "<url><loc>" + self.origin + "/</loc></url>"
                             "<url><loc>" + self.origin + "/sitter-directory.html</loc></url>"
                             "</urlset>"),
            "/": html(self.origin + "/"),
            "/sitter-directory.html": html(self.origin + "/sitter-directory.html"),
            "/assets/mate-funnel-events.js": "mate_provider_outbound_click",
        }

    def evaluate(self):
        def reader(url):
            path = url.removeprefix(self.origin)
            if path not in self.assets:
                raise RuntimeError("not found")
            return {}, self.assets[path]
        return monitor.inspect_site("CARE", self.origin, self.pages, reader)

    def test_valid_site_passes(self):
        self.assertTrue(self.evaluate()["passed"])

    def test_robots_block_fails(self):
        self.assets["/robots.txt"] = "User-agent: *\nDisallow: /\n"
        result = self.evaluate()
        self.assertFalse(result["passed"])
        self.assertTrue(any("blocked" in message for message in result["errors"]))

    def test_noindex_header_and_wrong_canonical_fail(self):
        self.assets["/"] = html(self.origin + "/other")
        def reader(url):
            return ({"x-robots-tag": "noindex"}, self.assets[url.removeprefix(self.origin)])
        result = monitor.inspect_site("CARE", self.origin, self.pages, reader)
        self.assertFalse(result["passed"])
        self.assertTrue(any("canonical" in message for message in result["errors"]))
        self.assertTrue(any("X-Robots" in message for message in result["errors"]))

    def test_missing_sitemap_directory_fails(self):
        self.assets["/sitemap.xml"] = "<urlset><url><loc>" + self.origin + "/</loc></url></urlset>"
        self.assertTrue(any("sitter-directory" in e for e in self.evaluate()["errors"]))

    def test_only_production_origins_are_monitored(self):
        self.assertEqual(set(monitor.SITES), {"CARE", "SPARK", "PLAY"})
        self.assertTrue(all(origin.startswith("https://") and "test." not in origin
                            and "web.app" not in origin
                            for origin, _ in monitor.SITES.values()))


if __name__ == "__main__":
    unittest.main()
