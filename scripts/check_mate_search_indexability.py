#!/usr/bin/env python3
"""Read-only indexability audit for MATE's three public production websites."""
import json
import re
import sys
import urllib.request
import xml.etree.ElementTree as ET
from html.parser import HTMLParser
from urllib.parse import urlparse, urljoin

SITES = {"CARE": "https://care.kosodatemate.jp/", "SPARK": "https://spark.kosodatemate.jp/", "PLAY": "https://play.kosodatemate.jp/"}
AGENT = "MATE-Crawlability-QA/1.0 (read-only; no form submissions)"

class Head(HTMLParser):
    def __init__(self):
        super().__init__()
        self.title = ""
        self.in_title = False
        self.canonicals = []
        self.description = []
        self.robots = []
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "title": self.in_title = True
        if tag == "link" and "canonical" in a.get("rel", "").lower().split():
            self.canonicals.append(a.get("href", ""))
        if tag == "meta" and a.get("name", "").lower() == "description":
            self.description.append(a.get("content", ""))
        if tag == "meta" and a.get("name", "").lower() in ("robots", "googlebot"):
            self.robots.append(a.get("content", ""))
    def handle_endtag(self, tag):
        if tag == "title": self.in_title = False
    def handle_data(self, data):
        if self.in_title: self.title += data

def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": AGENT, "Cache-Control": "no-cache"})
    with urllib.request.urlopen(req, timeout=18) as response:
        if response.status != 200: raise RuntimeError("HTTP " + str(response.status))
        if response.geturl().rstrip("/") != url.rstrip("/"):
            raise RuntimeError("unexpected redirect to " + response.geturl())
        return response.read(3_000_000).decode("utf-8"), dict(response.headers)

def run():
    results = []
    failures = []
    for service, base in SITES.items():
        record = {"service": service, "urls": 0, "issues": []}
        try:
            robots, _ = get(base + "robots.txt")
            if re.search(r"(?im)^\s*Disallow:\s*/\s*$", robots):
                raise ValueError("root-wide robots.txt disallow")
            if base + "sitemap.xml" not in robots:
                raise ValueError("canonical sitemap missing from robots.txt")
            xml, _ = get(base + "sitemap.xml")
            root = ET.fromstring(xml)
            urls = [n.text.strip() for n in root.iter() if n.tag.endswith("}loc") and n.text]
            if not urls or base not in urls:
                raise ValueError("sitemap missing canonical homepage")
            if len(urls) != len(set(urls)):
                raise ValueError("duplicate sitemap URLs")
            if len(urls) > 60:
                raise ValueError("unexpected sitemap size")
            titles = {}
            for url in urls:
                parsed = urlparse(url)
                if parsed.scheme != "https" or parsed.netloc != urlparse(base).netloc or parsed.query or parsed.fragment:
                    raise ValueError("sitemap contains invalid cross-site/query URL " + url)
                page, headers = get(url)
                head = Head()
                head.feed(page[:120000])
                if not head.title.strip(): raise ValueError("missing title " + url)
                if not head.description or not head.description[0].strip():
                    raise ValueError("missing meta description " + url)
                if len(head.canonicals) != 1 or head.canonicals[0] != url:
                    raise ValueError("missing/mismatched canonical " + url + " got " + repr(head.canonicals))
                if any("noindex" in r.lower() for r in head.robots):
                    raise ValueError("noindex meta " + url)
                if "noindex" in headers.get("X-Robots-Tag", "").lower():
                    raise ValueError("noindex HTTP header " + url)
                title = head.title.strip()
                if title in titles: record["issues"].append("duplicate title: " + url + " and " + titles[title])
                titles[title] = url
                record["urls"] += 1
            print("PASS", service, record["urls"], "sitemap URLs crawlable and canonical")
        except Exception as exc:
            failure = service + ": " + str(exc)
            print("FAIL", failure, file=sys.stderr)
            failures.append(failure)
        results.append(record)
    print("AUDIT_SUMMARY", json.dumps({"sites": results, "failures": failures}, ensure_ascii=False))
    return 1 if failures else 0

if __name__ == "__main__": sys.exit(run())
