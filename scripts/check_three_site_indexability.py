#!/usr/bin/env python3
"""Read-only production indexability check for the 3 MATE sites.

This checks public HTTP responses, not Google indexing or Search Console state.
The PLAY Firebase TEST host is deliberately excluded: it must remain noindex.
No form submission, email, paid crawl, login, or indexing API calls.
"""
from __future__ import annotations

import json
import re
import sys
import urllib.request
from datetime import datetime, timezone
from urllib.parse import urlparse
from xml.etree import ElementTree as ET

SITES = {
    "CARE": ("https://care.kosodatemate.jp", ("/", "/sitter-directory.html", "/play-listing.html")),
    "SPARK": ("https://spark.kosodatemate.jp", ("/", "/school-directory.html")),
    "PLAY": ("https://play.kosodatemate.jp", ("/", "/partners", "/contact", "/operator/", "/experiences")),
}
UA = "MATE-Public-Indexability-Monitor/1.0"


def fetch(url: str) -> tuple[dict[str, str], str]:
    request = urllib.request.Request(url, headers={"User-Agent": UA, "Cache-Control": "no-cache"})
    with urllib.request.urlopen(request, timeout=18) as response:
        if response.status != 200:
            raise RuntimeError(f"HTTP {response.status}")
        final = urlparse(response.geturl())
        original = urlparse(url)
        if final.scheme != "https" or final.hostname != original.hostname:
            raise RuntimeError("unexpected cross-host or insecure redirect")
        headers = {k.lower(): v for k, v in response.headers.items()}
        body = response.read(2_000_000).decode("utf-8-sig", errors="replace")
    return headers, body


def head_of(source: str) -> str:
    match = re.search(r"<head\b[^>]*>(.*?)</head>", source, re.I | re.S)
    return match.group(1) if match else ""


def html_metadata_errors(url: str, headers: dict[str, str], source: str) -> list[str]:
    errors: list[str] = []
    if "noindex" in headers.get("x-robots-tag", "").lower():
        errors.append("HTTP X-Robots-Tag blocks indexing")
    head = head_of(source)
    if not head:
        return errors + ["HTML head unavailable"]
    if not re.search(r"<title\b[^>]*>\s*[^<\s]", head, re.I):
        errors.append("missing useful title")
    if not re.search(r"<meta\b[^>]*\bname\s*=\s*['\"]description['\"]", head, re.I):
        errors.append("missing meta description")
    for tag in re.findall(r"<meta\b[^>]*>", head, re.I | re.S):
        if re.search(r"\bname\s*=\s*['\"]robots['\"]", tag, re.I):
            if re.search(r"\bnoindex\b", tag, re.I):
                errors.append("HTML meta robots blocks indexing")
            if re.search(r"\bnofollow\b", tag, re.I):
                errors.append("HTML meta robots blocks following links")
    canonical = ""
    for tag in re.findall(r"<link\b[^>]*>", head, re.I | re.S):
        if re.search(r"\brel\s*=\s*['\"]canonical['\"]", tag, re.I):
            match = re.search(r"\bhref\s*=\s*['\"]([^'\"]+)['\"]", tag, re.I)
            canonical = match.group(1) if match else ""
            break
    if canonical != url:
        errors.append("missing/mismatched canonical")
    if not re.search(r"<h1(?:\s|>)", source, re.I):
        errors.append("no readable H1 in delivered HTML")
    return errors


def sitemap_urls(xml_text: str) -> set[str]:
    root = ET.fromstring(xml_text)
    return {(node.text or "").strip() for node in root.iter()
            if node.tag.rsplit("}", 1)[-1] == "loc" and (node.text or "").strip()}


def inspect_site(service: str, origin: str, pages: tuple[str, ...], reader=fetch) -> dict:
    failures: list[str] = []
    checked: list[str] = []
    def load(path: str):
        try:
            headers, source = reader(origin + path)
            checked.append(path)
            return headers, source
        except Exception as error:
            failures.append(f"{path}: {type(error).__name__}: {str(error)[:160]}")
            return None

    robots = load("/robots.txt")
    if robots:
        headers, body = robots
        if re.search(r"(?im)^\s*Disallow\s*:\s*/\s*$", body):
            failures.append("/robots.txt: entire website blocked")
        if (origin + "/sitemap.xml") not in body:
            failures.append("/robots.txt: sitemap reference missing")
    sitemap = load("/sitemap.xml")
    locs: set[str] = set()
    if sitemap:
        try:
            locs = sitemap_urls(sitemap[1])
        except ET.ParseError as error:
            failures.append(f"/sitemap.xml: invalid XML ({error})")
    for path in pages:
        url = origin + path
        if sitemap and url not in locs:
            failures.append(f"/sitemap.xml: missing {path}")
        result = load(path)
        if result:
            headers, body = result
            failures.extend(f"{path}: {error}" for error in html_metadata_errors(url, headers, body))
            if service == "PLAY" and path == "/experiences":
                # Real, indexable public HTML -- not a JavaScript-only SPA fallback.
                if "未承認参考紹介" not in body or "<h3" not in body:
                    failures.append("/experiences: reference listings missing from delivered HTML")
                # Editorial references are NOT linked to a per-card owner claim form.
                # Only a site-level provider application entrypoint is allowed.
                if "play-listing.html#claim=editorial-" in body or "editorial_owner_claim" in body:
                    failures.append("/experiences: obsolete per-reference owner-claim link present")
                if "https://care.kosodatemate.jp/play-listing.html" not in body:
                    failures.append("/experiences: site-level provider application link missing")
                if "公式情報を確認する" not in body:
                    failures.append("/experiences: original official-source links missing")
                if 'data-mate-directory-event="official"' not in body or 'data-mate-directory-event="listing"' not in body:
                    failures.append("/experiences: anonymous conversion event markers missing")
                if '<script src="/play-directory-analytics.js" defer></script>' not in body:
                    failures.append("/experiences: first-party anonymous event script not loaded")
    if service in ("CARE", "SPARK"):
        result = load("/assets/mate-funnel-events.js")
        if result and "mate_provider_outbound_click" not in result[1]:
            failures.append("/assets/mate-funnel-events.js: missing expected event")
    if service == "CARE":
        # PLAY's owner application is hosted on CARE. This JSON must be shipped
        # with the actual Pages artifact, not merely committed to the repo.
        result = load("/editorial-play.json")
        if result:
            try:
                entries = json.loads(result[1])
                if not isinstance(entries, list) or not entries:
                    failures.append("/editorial-play.json: expected non-empty reference list")
                elif any(
                    not isinstance(item, dict)
                    or not isinstance(item.get("id"), str)
                    or not item["id"].startswith("editorial-")
                    or item.get("editorial") is not True
                    or item.get("approved") is not False
                    or not isinstance(item.get("name"), str)
                    or not item["name"].strip()
                    or not isinstance(item.get("url"), str)
                    or not item["url"].startswith("https://")
                    for item in entries
                ):
                    failures.append("/editorial-play.json: invalid/unapproved-reference contract")
                elif len({item["id"] for item in entries}) != len(entries):
                    failures.append("/editorial-play.json: duplicate IDs")
            except (ValueError, TypeError):
                failures.append("/editorial-play.json: malformed JSON")
    if service == "CARE":
        # The owner-claim JSON can be healthy even when the actual PLAY form or
        # client-side prefill script is missing from a Pages deployment.
        form = load("/play-listing.html")
        if form:
            required = (
                'data-mate-direct-listing="true"',
                'data-mate-claim-notice',
                'name="service" value="PLAY"',
                'name="company"',
                'name="website"',
                'assets/mate-reference-claim.js',
            )
            for marker in required:
                if marker not in form[1]:
                    failures.append(f"/play-listing.html: missing owner-claim form marker {marker}")
        script = load("/assets/mate-reference-claim.js")
        if script:
            required_script = (
                "editorial-play.json",
                "row.editorial === true",
                "row.approved === false",
                "window.fetch(",
            )
            if not all(marker in script[1] for marker in required_script):
                failures.append("/assets/mate-reference-claim.js: owner-claim prefill contract missing")
    if service == "PLAY":
        # Static HTML must use the existing same-origin GA4 bridge without sending
        # provider IDs, URLs, query strings, referrers or visitor form values.
        metrics = load("/play-directory-analytics.js")
        if metrics:
            markers = (
                "MATE_PLAY_METRIC", "MATE_PLAY_ANALYTICS_READY",
                "route: '/experiences'", "metric('page_view')",
                "metric('play_outbound_click')", "metric('mate_listing_click')",
                "referrer: '', campaign: '', partner_id: ''",
            )
            if any(marker not in metrics[1] for marker in markers):
                failures.append("/play-directory-analytics.js: anonymous event contract missing")
        bridge = load("/play-analytics-bridge.js")
        if bridge and "'/experiences'" not in bridge[1]:
            failures.append("/play-analytics-bridge.js: static directory route excluded")
    if service == "SPARK":
        result = load("/schools.json")
        if result and not result[1].lstrip().startswith(("{", "[")):
            failures.append("/schools.json: unexpected non-JSON body")
    return {"service": service, "origin": origin, "checks": checked, "errors": failures, "passed": not failures}


def main() -> int:
    results = [inspect_site(service, origin, pages)
               for service, (origin, pages) in SITES.items()]
    print(json.dumps({
        "checked_at_utc": datetime.now(timezone.utc).isoformat(),
        "note": "Public source/HTTP checks only: Google indexing, rankings and conversions NOT verified.",
        "sites": results,
    }, ensure_ascii=False, indent=2))
    return 0 if all(site["passed"] for site in results) else 1


if __name__ == "__main__":
    sys.exit(main())
