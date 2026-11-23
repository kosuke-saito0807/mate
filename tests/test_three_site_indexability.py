"""Offline regression tests for the public 3-site indexability monitor."""
import importlib.util
import json
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
        self.pages = ("/", "/sitter-directory.html", "/play-listing.html")
        self.assets = {
            "/robots.txt": "User-agent: *\nAllow: /\nSitemap: " + self.origin + "/sitemap.xml\n",
            "/sitemap.xml": ("<?xml version='1.0'?><urlset>"
                             "<url><loc>" + self.origin + "/</loc></url>"
                             "<url><loc>" + self.origin + "/sitter-directory.html</loc></url>"
                             "<url><loc>" + self.origin + "/play-listing.html</loc></url>"
                             "</urlset>"),
            "/": html(self.origin + "/"),
            "/sitter-directory.html": html(self.origin + "/sitter-directory.html"),
            "/assets/mate-funnel-events.js": "mate_provider_outbound_click",
            "/play-listing.html": html(self.origin + "/play-listing.html") + (
                '<form data-mate-direct-listing="true">'
                '<input name="service" value="PLAY">'
                '<input name="company"><input name="website"></form>'
                '<p data-mate-claim-notice></p>'
                '<script src="assets/mate-reference-claim.js"></script>'
            ),
            "/assets/mate-reference-claim.js": (
                "window.fetch('editorial-play.json');"
                "row.editorial === true && row.approved === false;"
            ),
            "/editorial-play.json": json.dumps([{"id":"editorial-sample","name":"Sample","url":"https://example.org/","editorial":True,"approved":False}]),
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

    def test_play_owner_claim_mirror_404_fails(self):
        self.assets.pop("/editorial-play.json")
        result = self.evaluate()
        self.assertFalse(result["passed"])
        self.assertTrue(any("editorial-play.json" in e for e in result["errors"]))

    def test_play_owner_claim_mirror_rejects_approved_entry(self):
        self.assets["/editorial-play.json"] = json.dumps([
            {"id":"editorial-sample","name":"Sample","url":"https://example.org/",
             "editorial":True,"approved":True}
        ])
        result = self.evaluate()
        self.assertFalse(result["passed"])
        self.assertTrue(any("unapproved-reference" in e for e in result["errors"]))

    def test_play_owner_claim_mirror_rejects_bad_json(self):
        self.assets["/editorial-play.json"] = "{"
        self.assertTrue(any("malformed JSON" in e for e in self.evaluate()["errors"]))

    def test_missing_play_owner_claim_form_fails(self):
        self.assets.pop("/play-listing.html")
        self.assertTrue(any("play-listing.html" in e for e in self.evaluate()["errors"]))

    def test_unwired_play_owner_claim_form_fails(self):
        self.assets["/play-listing.html"] = html(self.origin + "/play-listing.html")
        self.assertTrue(any("form marker" in e for e in self.evaluate()["errors"]))

    def test_missing_play_claim_prefill_script_fails(self):
        self.assets.pop("/assets/mate-reference-claim.js")
        self.assertTrue(any("mate-reference-claim.js" in e for e in self.evaluate()["errors"]))

    def test_broken_play_prefill_contract_fails(self):
        self.assets["/assets/mate-reference-claim.js"] = "function noop() {}"
        self.assertTrue(any("prefill contract missing" in e for e in self.evaluate()["errors"]))

    def test_play_crawlable_directory_and_claim_links(self):
        origin = "https://play.kosodatemate.jp"
        pages = monitor.SITES["PLAY"][1]
        self.assertIn("/experiences", pages)
        data = {
            "/robots.txt": "User-agent: *\\nAllow: /\\nSitemap: " + origin + "/sitemap.xml\\n",
            "/sitemap.xml": "<urlset>" + "".join(
                "<url><loc>" + origin + p + "</loc></url>" for p in pages
            ) + "</urlset>",
        }
        for p in pages:
            data[p] = html(origin + p)
        data["/experiences"] += (
            "<section><p>未承認参考紹介</p><h3>編集部参考情報</h3>"
            '<a href="https://example.org/">主催者の公式情報を確認する</a>'
            '<a href="https://care.kosodatemate.jp/play-listing.html#claim=editorial-demo">'
            "この情報から正式掲載を申請する</a></section>"
            '<a data-mate-directory-event="official" href="https://example.org/"></a>'
            '<a data-mate-directory-event="listing" href="https://care.kosodatemate.jp/"></a>'
            '<script src="/play-directory-analytics.js" defer></script>'
        )
        data["/play-directory-analytics.js"] = (
            "MATE_PLAY_METRIC MATE_PLAY_ANALYTICS_READY route: '/experiences' "
            "metric('page_view') metric('play_outbound_click') metric('mate_listing_click') "
            "referrer: '', campaign: '', partner_id: ''"
        )
        data["/play-analytics-bridge.js"] = "'/experiences'"
        def reader(url):
            path = url.removeprefix(origin)
            if path not in data:
                raise RuntimeError("404")
            return {}, data[path]
        self.assertTrue(monitor.inspect_site("PLAY", origin, pages, reader)["passed"])
        self.assertTrue(monitor.inspect_site("PLAY", origin, pages, reader)["passed"])
        del data["/play-directory-analytics.js"]
        self.assertTrue(any("play-directory-analytics.js" in e for e in
                            monitor.inspect_site("PLAY", origin, pages, reader)["errors"]))
        data["/play-directory-analytics.js"] = "MATE_PLAY_METRIC"
        self.assertTrue(any("event contract" in e for e in
                            monitor.inspect_site("PLAY", origin, pages, reader)["errors"]))
        data["/play-directory-analytics.js"] = (
            "MATE_PLAY_METRIC MATE_PLAY_ANALYTICS_READY route: '/experiences' "
            "metric('page_view') metric('play_outbound_click') metric('mate_listing_click') "
            "referrer: '', campaign: '', partner_id: ''"
        )
        del data["/experiences"]
        self.assertTrue(any("experiences" in e for e in
                            monitor.inspect_site("PLAY", origin, pages, reader)["errors"]))
        data["/experiences"] = html(origin + "/experiences") + (
            "<h3>参考紹介</h3>未承認参考紹介・公式情報を確認する"
        )
        self.assertTrue(any("owner-claim" in e for e in
                            monitor.inspect_site("PLAY", origin, pages, reader)["errors"]))

    def test_only_production_origins_are_monitored(self):
        self.assertEqual(set(monitor.SITES), {"CARE", "SPARK", "PLAY"})
        self.assertTrue(all(origin.startswith("https://") and "test." not in origin
                            and "web.app" not in origin
                            for origin, _ in monitor.SITES.values()))


if __name__ == "__main__":
    unittest.main()
