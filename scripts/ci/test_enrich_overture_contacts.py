"""Offline tests for bounded official-site link discovery: no network or mail."""
import csv
import importlib.util
import ipaddress
import sys
import tempfile
import unittest
from datetime import date
from pathlib import Path
from unittest.mock import patch

SCRIPT = Path(__file__).resolve().parents[1] / "enrich_overture_contacts.py"
sys.path.insert(0, str(SCRIPT.parent))
SPEC = importlib.util.spec_from_file_location("mate_contact_locator", SCRIPT)
MOD = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MOD)
FIELDS = MOD.FIELDS


class ContactDiscoverySafety(unittest.TestCase):
    def test_first_party_https_contact_links_only(self):
        markup = """<html><a href="mailto:owner@example.jp">お問い合わせ</a>
        <a href="https://outside.example.com/contact">他サイトお問い合わせ</a>
        <a href="/privacy">お問い合わせ</a>
        <a href="/contact?user=private">お問い合わせ</a>
        <a href="javascript:alert(1)">お問い合わせ</a>
        <a href="/contact/">お問い合わせはこちら</a></html>"""
        result = MOD.contact_link("https://example.jp/", markup)
        self.assertEqual(result, "https://example.jp/contact/")

    def test_contact_form_with_japanese_label_and_query_rejected(self):
        markup = """<a href="/foo/form">お問い合わせフォーム</a>
        <a href="/contact?session=secret">お問い合わせ</a>"""
        self.assertEqual(MOD.contact_link("https://studio.jp/", markup),
                         "https://studio.jp/foo/form")
        self.assertEqual(MOD.contact_link("https://studio.jp/",
                                         '<a href="/faq">Contact us</a>'), "")

    def test_hostname_port_and_userinfo_rejected(self):
        for host in ["localhost", "127.0.0.1", "10.0.0.3",
                     "169.254.169.254", "example.internal", "a..com",
                     "a.local", "example.com@", "a_b.com"]:
            with self.subTest(host=host):
                self.assertFalse(MOD.approved_host(host))
        for uri in ("http://studio.jp/", "https://user:pass@studio.jp/",
                    "https://studio.jp:8443/", "https://studio.jp/?email=x",
                    "https://studio.jp/#visitor", "https://127.0.0.1/"):
            with self.subTest(url=uri):
                with self.assertRaises(ValueError):
                    MOD.same_origin_page(uri)
        self.assertTrue(MOD.approved_host("www.studio.jp"))

    def test_dns_private_addresses_fail_closed(self):
        with patch.object(MOD.socket, "getaddrinfo", return_value=[
            (MOD.socket.AF_INET, MOD.socket.SOCK_STREAM, 6, "", ("10.0.0.3", 443)),
            (MOD.socket.AF_INET, MOD.socket.SOCK_STREAM, 6, "", ("8.8.8.8", 443)),
        ]):
            with self.assertRaises(ValueError):
                MOD.public_address("studio.jp")
        with patch.object(MOD.socket, "getaddrinfo", return_value=[
            (MOD.socket.AF_INET, MOD.socket.SOCK_STREAM, 6, "", ("8.8.8.8", 443))
        ]):
            self.assertEqual(MOD.public_address("studio.jp"), "8.8.8.8")

    def test_robots_disallow_stops_before_homepage(self):
        requests = []
        def fake_get(host, path, ip):
            requests.append(path)
            return 200, "text/plain", b"User-agent: *\nDisallow: /\n"
        with patch.object(MOD, "public_address", return_value="8.8.8.8"), \
             patch.object(MOD, "request_pinned", side_effect=fake_get):
            self.assertEqual(MOD.read_official_contact_url("https://studio.jp/"), "")
        self.assertEqual(requests, ["/robots.txt"])

    def test_no_redirects_followed_or_form_submitted(self):
        requests = []
        def fake_get(host, path, ip):
            requests.append(path)
            if path == "/robots.txt":
                return 404, "text/plain", b""
            return 301, "text/html", '<a href="/contact">お問い合わせ</a>'.encode("utf-8")
        with patch.object(MOD, "public_address", return_value="8.8.8.8"), \
             patch.object(MOD, "request_pinned", side_effect=fake_get):
            self.assertEqual(MOD.read_official_contact_url("https://studio.jp/"), "")
        self.assertEqual(requests, ["/robots.txt", "/"])

    def test_allowed_public_homepage_extracts_only_url(self):
        requests = []
        def fake_get(host, path, ip):
            requests.append((host, path))
            if path == "/robots.txt":
                return 200, "text/plain", b"User-agent: *\nAllow: /\n"
            return 200, "text/html; charset=utf-8", (
                '<a href="mailto:personal@studio.jp">メール</a>'
                '<a href="/contact.html">お問い合わせ</a>').encode("utf-8")
        with patch.object(MOD, "public_address", return_value="8.8.8.8"), \
             patch.object(MOD, "request_pinned", side_effect=fake_get):
            found = MOD.read_official_contact_url("https://studio.jp/")
        self.assertEqual(found, "https://studio.jp/contact.html")
        self.assertEqual(requests, [("studio.jp", "/robots.txt"), ("studio.jp", "/")])

    def test_enrichment_keeps_candidates_unapproved_and_recent_in_sync(self):
        records = [
            dict(service="SPARK", name="ピアノ教室", website="https://piano.jp/",
                 region="東京", email="", contact_url="", source_url="https://docs.overturemaps.org/guides/places/",
                 mail_basis="UNVERIFIED", checked_at="", solicitation_prohibited="false"),
            dict(service="PLAY", name="親子工房", website="https://craft.jp/",
                 region="東京", email="", contact_url="", source_url="https://docs.overturemaps.org/guides/places/",
                 mail_basis="UNVERIFIED", checked_at="", solicitation_prohibited="false"),
        ]
        with tempfile.TemporaryDirectory() as folder:
            archive, recent = Path(folder)/"archive.csv", Path(folder)/"recent.csv"
            with archive.open("w", newline="", encoding="utf-8") as file:
                writer = csv.DictWriter(file, fieldnames=FIELDS)
                writer.writeheader()
                writer.writerows(records)
            def fake_discover(url):
                return ("https://piano.jp/contact/" if "piano" in url
                        else "https://other.jp/contact/")
            summary = MOD.enrich_archive(archive, recent, day=date(2026, 11, 23),
                                         batch=0, limit=2, discover=fake_discover)
            self.assertEqual(summary["checked"], 2)
            self.assertEqual(summary["contact_links_found"], 1)
            self.assertEqual(summary["mail_send_authorized"], 0)
            with archive.open(encoding="utf-8", newline="") as file:
                updated=list(csv.DictReader(file))
            self.assertEqual(updated[0]["contact_url"], "https://piano.jp/contact/")
            self.assertEqual(updated[1]["contact_url"], "")
            self.assertEqual(updated[0]["checked_at"], "2026-11-23")
            self.assertTrue(all(row["email"] == "" and row["mail_basis"] == "UNVERIFIED"
                                for row in updated))
            with recent.open(encoding="utf-8", newline="") as file:
                rolling=list(csv.DictReader(file))
            self.assertEqual(len(rolling), 2)
            self.assertEqual(rolling[0]["contact_url"], updated[0]["contact_url"])

    def test_enrichment_rejects_unsafe_fake_destination_and_caps_queries(self):
        with tempfile.TemporaryDirectory() as folder:
            archive = Path(folder)/"archive.csv"
            records = [dict.fromkeys(FIELDS,"") for _ in range(6)]
            for i, row in enumerate(records):
                row.update(service="PLAY", name="工房"+str(i),
                           website="https://craft"+str(i)+".jp/", mail_basis="UNVERIFIED")
            with archive.open("w",newline="",encoding="utf-8") as file:
                writer=csv.DictWriter(file,fieldnames=FIELDS);writer.writeheader();writer.writerows(records)
            with self.assertRaises(ValueError):
                MOD.enrich_archive(archive,Path(folder)/"recent.csv",
                                   day=date(2026,11,23),batch=0,limit=5,discover=lambda _: "")
            summary = MOD.enrich_archive(
                archive,Path(folder)/"recent.csv",day=date(2026,11,23),batch=0,
                limit=2, discover=lambda u: u+"contact?private_token=x")
            self.assertEqual(summary["contact_links_found"],0)


if __name__ == "__main__":
    unittest.main()
