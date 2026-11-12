"""Read-only source audit for every indexable CARE/SPARK sitemap URL.

Never submits URLs for indexing, fabricates rankings, or changes live content.
Run before deploying; a passing audit is not evidence of live indexing.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from urllib.parse import urlparse
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
SITES = {
    "care.kosodatemate.jp": ("sitemap.xml", ROOT),
    "spark.kosodatemate.jp": ("spark/sitemap.xml", ROOT / "spark"),
}
NS = {"s": "http://www.sitemaps.org/schemas/sitemap/0.9"}


def inspect() -> list[str]:
    errors: list[str] = []
    seen_urls: set[str] = set()
    seen_titles: dict[str, str] = {}
    counts: dict[str, int] = {}
    for hostname, (sitemap_file, directory) in SITES.items():
        entries = ET.parse(ROOT / sitemap_file).findall(".//s:loc", NS)
        if not entries:
            errors.append(f"{sitemap_file}: no entries")
        counts[hostname] = len(entries)
        for entry in entries:
            url = (entry.text or "").strip()
            parts = urlparse(url)
            if parts.scheme != "https" or parts.hostname != hostname or parts.query or parts.fragment:
                errors.append(f"{sitemap_file}: unexpected URL {url}")
                continue
            if url in seen_urls:
                errors.append(f"{sitemap_file}: duplicate URL {url}")
            seen_urls.add(url)
            rel = parts.path.lstrip("/") or "index.html"
            if rel.endswith("/") or ".." in Path(rel).parts:
                errors.append(f"{url}: invalid path")
                continue
            path = directory / rel
            if not path.is_file():
                errors.append(f"{url}: missing source file {path.relative_to(ROOT)}")
                continue
            html = path.read_text(encoding="utf-8")
            title = re.search(r"<title>\s*([^<]+?)\s*</title>", html, re.I)
            desc = re.search(r'<meta\s+name="description"\s+content="([^"]+)"', html, re.I)
            canonical = re.search(r'<link\s+rel="canonical"\s+href="([^"]+)"', html, re.I)
            robots = re.search(r'<meta\s+name="robots"\s+content="([^"]+)"', html, re.I)
            h1 = re.search(r"<h1(?:\s|>)", html, re.I)
            if not title or len(title.group(1).strip()) < 10:
                errors.append(f"{url}: missing or thin title")
            elif title.group(1).strip() in seen_titles:
                errors.append(f"{url}: duplicate title with {seen_titles[title.group(1).strip()]}")
            else:
                seen_titles[title.group(1).strip()] = url
            if not desc or len(desc.group(1).strip()) < 35:
                errors.append(f"{url}: missing or thin meta description")
            if not canonical or canonical.group(1) != url:
                errors.append(f"{url}: canonical must match sitemap URL")
            if not robots or "noindex" in robots.group(1).lower() or "index" not in robots.group(1).lower():
                errors.append(f"{url}: page not explicitly indexable")
            if not h1:
                errors.append(f"{url}: no H1")
            for script in re.findall(r'<script\s+type="application/ld\+json">([\s\S]*?)</script>', html, re.I):
                try:
                    json.loads(script)
                except json.JSONDecodeError:
                    errors.append(f"{url}: malformed JSON-LD")
    for hostname, (sitemap_file, _) in SITES.items():
        robot_path = ROOT / ("spark/robots.txt" if hostname.startswith("spark") else "robots.txt")
        robots = robot_path.read_text(encoding="utf-8")
        if "Disallow: /\n" in robots or "Sitemap: https://" + hostname + "/sitemap.xml" not in robots:
            errors.append(f"{robot_path.relative_to(ROOT)}: crawling blocked or sitemap missing")
    print(json.dumps({"source_sitemap_page_counts": counts, "errors": errors, "note": "Source audit only; not live indexation or rankings."}, ensure_ascii=False, indent=2))
    return errors


if __name__ == "__main__":
    sys.exit(1 if inspect() else 0)
