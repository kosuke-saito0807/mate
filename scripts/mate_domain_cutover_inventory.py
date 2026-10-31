#!/usr/bin/env python3
"""Read-only inventory for MATE's future three-service domain cutover.

NO deployment, DNS changes, redirects, Search Console requests or file writes.
Run now without --domain, or later with --domain actual-owned-domain.jp.
"""
import argparse
import json
import re
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
CURRENT = {
    "CARE": "https://kosuke-saito0807.github.io/mate/",
    "SPARK": "https://mate-spark.web.app/",
    "PLAY": "https://mate-play-production.web.app/",
}
LEGACY_PLAY = "https://mate-play.kosuke-saito0807.chatgpt.site/"
FORBIDDEN_HOSTS = ("github.io", "web.app", "firebaseapp.com", "chatgpt.site")
SOURCE_FILES = [
    *sorted(ROOT.glob("*.html")),
    *sorted((ROOT / "spark").glob("*.html")),
    ROOT / "robots.txt",
    ROOT / "sitemap.xml",
    ROOT / "spark/robots.txt",
    ROOT / "spark/sitemap.xml",
]


def validate_domain(value):
    """Validate syntax only; actual registrar ownership must be separately verified."""
    if not isinstance(value, str) or not value or len(value) > 253:
        raise ValueError("A bare domain name is required")
    domain = value.lower()
    if domain != value or not re.fullmatch(r"[a-z0-9.-]+", domain):
        raise ValueError("Use a lowercase ASCII domain without scheme, path or spaces")
    labels = domain.split(".")
    if len(labels) < 2 or any(
        len(label) > 63 or not re.fullmatch(r"[a-z0-9](?:[a-z0-9-]*[a-z0-9])?", label)
        for label in labels
    ) or not re.fullmatch(r"[a-z]{2,63}", labels[-1]):
        raise ValueError("Invalid domain syntax")
    if any(domain == suffix or domain.endswith("." + suffix) for suffix in FORBIDDEN_HOSTS):
        raise ValueError("Use an independently owned domain, not a provider hostname")
    return domain


def inventory(root=ROOT, domain=None):
    """Build an auditable, read-only list of URL references and critical cutover gates."""
    domain = validate_domain(domain) if domain else None
    targets = {service: f"https://{service.lower()}.{domain}/" for service in CURRENT} if domain else {}
    scanned = []
    for source in SOURCE_FILES:
        relative = source.relative_to(ROOT).as_posix()
        text = (root / relative).read_text(encoding="utf-8")
        old_counts = {service: text.count(url.rstrip("/")) for service, url in CURRENT.items()}
        legacy_count = text.count(LEGACY_PLAY.rstrip("/"))
        if any(old_counts.values()) or legacy_count:
            scanned.append({
                "path": relative,
                "current_url_mentions": {service: count for service, count in old_counts.items() if count},
                "legacy_play_mentions": legacy_count,
            })
    return {
        "mode": "READ_ONLY_PREPARATION",
        "domain": domain,
        "domain_ownership_verified": False,
        "current_sites": CURRENT,
        "proposed_sites": targets,
        "files_with_current_or_legacy_urls": scanned,
        "gates_before_any_publication": [
            "Register and verify ownership of the approved base domain (XServer Domain for .jp); Cloudflare is DNS provider, not the registrar",
            "Connect care/spark/play hostnames to the correct existing Hosting targets; do not mix SPARK and PLAY Firebase projects",
            "Keep Google Analytics measurement ID G-CHXY0DC2WP on all 3 services",
            "Preserve forms, approved-only listing data, and the live PLAY legacy API limitations; do not auto-merge old PLAY link PR #43",
            "Update HTML canonical/OG/JSON-LD, internal and cross-site links, robots and sitemap URLs together",
            "Verify every new HTTPS origin serves correct content, SSL, canonical, noindex policy and forms before directing traffic",
            "Check old-host redirect capabilities per provider; do not promise 301 redirects from github.io or web.app without an actual HTTP check",
            "Only after cutover, verify new Search Console domain property and submit the NEW sitemaps once (not per-URL quota retries)",
        ],
        "prohibited_actions": ["deploy", "DNS modification", "Search Console API requests", "publish unapproved listings"],
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--domain", help="Optional future domain; do not assume it is owned")
    args = parser.parse_args()
    print(json.dumps(inventory(domain=args.domain), indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
