"""Verify deployed CARE / SPARK pages after CI publishing, not only source files.

Network checks deliberately run on GitHub-hosted runners after deployment.
Only public HTTPS pages are fetched; no real listing forms are submitted.
"""
from __future__ import annotations

import json
import sys
import time
import urllib.error
import urllib.request

SITES = {
    "CARE": {
        "origin": "https://care.kosodatemate.jp",
        "release_service": "CARE",
        "pages": {
            "/business.html": ["MATE CARE", "MATE SPARK", "MATE PLAY", "data-business-cta", "application/ld+json"],
            "/contact.html": ['data-mate-direct-listing="true"', 'name="service" value="CARE"'],
            "/play-listing.html": ['data-mate-direct-listing="true"', 'name="service" value="PLAY"'],
            "/sitemap.xml": ["https://care.kosodatemate.jp/business.html"],
            "/robots.txt": ["Sitemap:"],
            "/llms.txt": ["MATE CARE", "business.html"],
        },
    },
    "SPARK": {
        "origin": "https://spark.kosodatemate.jp",
        "release_service": "SPARK",
        "pages": {
            "/": ["MATE SPARK", "partners.html"],
            "/partners.html": ['data-mate-direct-listing="true"', 'name="service" value="SPARK"'],
            "/sitemap.xml": ["https://spark.kosodatemate.jp/partners.html"],
            "/robots.txt": ["Sitemap:"],
            "/llms.txt": ["MATE SPARK", "business.html"],
        },
    },
}

def read_text(url: str) -> str:
    req = urllib.request.Request(
        url, headers={"User-Agent": "MATE-Publish-Smoke/1.0", "Cache-Control": "no-cache"}
    )
    with urllib.request.urlopen(req, timeout=18) as response:
        if response.status != 200:
            raise RuntimeError(f"HTTP {response.status} for {url}")
        return response.read(1_500_000).decode("utf-8-sig", errors="replace")

def check(service: str, expected_sha: str) -> None:
    config = SITES[service]
    origin = config["origin"]
    release = json.loads(read_text(origin + "/release.json?source=" + expected_sha[:12]))
    if release.get("service") != config["release_service"]:
        raise AssertionError(f"{service}: deployed release does not match service")
    if release.get("source_commit") != expected_sha:
        raise AssertionError(
            f"{service}: deployed SHA {str(release.get('source_commit'))[:12]} "
            f"does not match source {expected_sha[:12]}"
        )
    for path, markers in config["pages"].items():
        body = read_text(origin + path)
        for marker in markers:
            if marker not in body:
                raise AssertionError(f"{service}: {path} missing required marker {marker!r}")
    print(f"VERIFIED: {service} live release {expected_sha[:12]} and {len(config['pages'])} public paths")

def main() -> int:
    if len(sys.argv) != 3 or sys.argv[1] not in SITES or len(sys.argv[2]) != 40:
        print("Usage: python3 scripts/check_live_release.py CARE|SPARK full_commit_sha", file=sys.stderr)
        return 2
    service, sha = sys.argv[1:]
    errors = []
    for attempt in range(1, 11):
        try:
            check(service, sha)
            return 0
        except (OSError, ValueError, KeyError, AssertionError, RuntimeError) as exc:
            errors.append(f"attempt {attempt}: {type(exc).__name__}: {exc}")
            if attempt < 10:
                time.sleep(10)
    print("\n".join(errors[-4:]), file=sys.stderr)
    return 1

if __name__ == "__main__":
    raise SystemExit(main())
