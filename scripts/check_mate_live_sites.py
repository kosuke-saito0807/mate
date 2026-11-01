#!/usr/bin/env python3
"""Read-only 3-site production health audit: HTTPS, current UX, release provenance.

Never submit forms, hit business API endpoints, track users, send mail,
or try to alter DNS/deployment. Intended for GitHub Actions and manual use.
"""
import json
import re
import ssl
import sys
import time
from urllib import error, request

SITES = {
    "CARE": {
        "base": "https://care.kosodatemate.jp",
        "pages": [("/", "シッターの相談"), ("/contact.html", "事業者情報を登録する")],
        "release": True,
    },
    "SPARK": {
        "base": "https://spark.kosodatemate.jp",
        "pages": [("/", "習い事探しの頼れる相棒「MATE SPARK」"), ("/partners.html", "教室の情報をご登録ください")],
        "release": True,
    },
    "PLAY": {
        "base": "https://play.kosodatemate.jp",
        "pages": [("/", "mate-play-deploy-sha"), ("/robots.txt", "Allow: /")],
        "release": False,
    },
}
UA = "MATE-Public-Site-Health/1.0 (read-only; no forms)"


def fetch(url, attempts=3):
    last = None
    for n in range(attempts):
        try:
            req = request.Request(url, headers={"User-Agent": UA, "Accept": "text/html,application/json,text/plain"})
            with request.urlopen(req, timeout=15, context=ssl.create_default_context()) as res:
                if res.geturl().split("?", 1)[0] != url:
                    raise ValueError("Unexpected redirect at " + url + " to " + res.geturl())
                if res.status != 200:
                    raise ValueError("HTTP %s at %s" % (res.status, url))
                return res.read(600_000).decode("utf-8", "replace")
        except (OSError, ValueError, error.URLError) as exc:
            last = exc
            if n + 1 < attempts:
                time.sleep(2)
    raise RuntimeError("%s: %s" % (url, last))


def check():
    failures = []
    for service, conf in SITES.items():
        print("SITE", service, conf["base"], flush=True)
        for path, marker in conf["pages"]:
            url = conf["base"] + path
            try:
                page = fetch(url)
                if marker not in page:
                    raise ValueError("Expected current content marker missing: " + marker)
                if service == "PLAY" and path == "/robots.txt" and "Disallow: /" in page:
                    raise ValueError("PLAY production robots.txt incorrectly blocks crawling")
                print(" PASS", path, "HTTPS certificate and current page marker", flush=True)
            except Exception as exc:
                failures.append(str(exc))
                print(" FAIL", path, str(exc), flush=True)
        if conf["release"]:
            url = conf["base"] + "/release.json"
            try:
                release = json.loads(fetch(url))
                sha = release.get("source_commit")
                if release.get("service") != service or not isinstance(sha, str) or not re.fullmatch(r"[a-f0-9]{40}", sha):
                    raise ValueError("Release marker not yet deployed or invalid")
                print(" PASS", "release.json", "GitHub commit", sha, flush=True)
            except Exception as exc:
                failures.append(str(exc))
                print(" FAIL", "release.json", str(exc), flush=True)
    if failures:
        print("\nIssues: %s; production release or DNS/SSL verification required" % len(failures), file=sys.stderr)
        return 1
    print("\nPASS: 3 sites served HTTPS content; CARE/SPARK release IDs available")
    return 0


if __name__ == "__main__":
    sys.exit(check())
