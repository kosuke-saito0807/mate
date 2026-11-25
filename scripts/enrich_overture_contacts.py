#!/usr/bin/env python3
"""Bounded, read-only discovery of official first-party contact-page links.

Enriches Overture *unverified* prospects for later human/GAS review. It NEVER
submits forms, collects emails or personal phone numbers, sends outreach, or
turns discovered links into approved marketing recipients.
"""
from __future__ import annotations

import argparse
import csv
import datetime as dt
import html.parser
import http.client
import ipaddress
import json
import os
import re
import socket
import ssl
import tempfile
from pathlib import Path
from urllib.parse import unquote, urljoin, urlsplit, urlunsplit
from urllib.robotparser import RobotFileParser

from collect_overture_growth import FIELDS, safe_websites, write_recent_csv

USER_AGENT = "MATE-OfficialContactLocator/1.0 (+https://care.kosodatemate.jp/operator.html)"
MAX_BYTES = 160_000
TIMEOUT_SECONDS = 7
MAX_PER_RUN = 4
NO_DIRECT_CONTACT = re.compile(
    r"(?:^|/)(?:privacy|policy|terms|recruit|careers|jobs|login|signup|"
    r"register|account|member|admin)(?:/|$|[._-])", re.I
)
CONTACT_PATH = re.compile(
    r"(?:^|/)(?:contact(?:[-_]?us|[-_]?form)?|inquir(?:y|ies)|"
    r"otoiawase|toiawase|お問い合わせ|お問合せ|問合せ)"
    r"(?:/|$|[._-])", re.I
)
CONTACT_TEXT = re.compile(r"お問い合わせ|お問合せ|問合せ|問い合わせ|contact us|inquir", re.I)


def approved_host(host: str) -> bool:
    """Hostnames only; never fetch private hosts, bare IPs or custom ports."""
    if not isinstance(host, str) or len(host) > 250:
        return False
    host = host.lower()
    if not re.fullmatch(r"[a-z0-9.-]+", host) or "." not in host:
        return False
    if any(not re.fullmatch(r"[a-z0-9](?:[a-z0-9-]*[a-z0-9])?", label)
           for label in host.split(".")):
        return False
    if host.endswith((".local", ".localhost", ".test", ".invalid", ".internal")):
        return False
    try:
        ipaddress.ip_address(host)
        return False
    except ValueError:
        return True


def public_address(host: str) -> str:
    """Resolve each site before use; make the outbound TLS connection to that IP."""
    if not approved_host(host):
        raise ValueError("non-public or malformed hostname")
    answers = socket.getaddrinfo(host, 443, socket.AF_INET, socket.SOCK_STREAM)
    addresses = sorted({item[4][0] for item in answers})
    if not addresses or any(not ipaddress.ip_address(ip).is_global for ip in addresses):
        raise ValueError("DNS has private/reserved endpoints")
    return addresses[0]


def same_origin_page(url: str) -> tuple[str, str]:
    parts = urlsplit(url)
    host = (parts.hostname or "").lower()
    if (parts.scheme != "https" or not approved_host(host) or parts.port not in (None, 443)
            or parts.username or parts.password or any(ch in (parts.path or "") for ch in "\r\n\t")):
        raise ValueError("non-public HTTPS website")
    if parts.query or parts.fragment:
        raise ValueError("untrusted query/fragment in source website")
    return host, (parts.path or "/")


def request_pinned(host: str, path: str, ip: str) -> tuple[int, str, bytes]:
    """No proxies and no redirects: pin socket to a validated global IP and verify TLS host."""
    if not path.startswith("/") or "\r" in path or "\n" in path:
        raise ValueError("unsafe path")
    context = ssl.create_default_context()
    conn = http.client.HTTPSConnection(host, timeout=TIMEOUT_SECONDS, context=context)
    try:
        raw = socket.create_connection((ip, 443), timeout=TIMEOUT_SECONDS)
        raw.settimeout(TIMEOUT_SECONDS)
        conn.sock = context.wrap_socket(raw, server_hostname=host)
        conn.request("GET", path, headers={
            "User-Agent": USER_AGENT, "Accept": "text/html,text/plain;q=0.8",
            "Accept-Encoding": "identity", "Connection": "close",
        })
        response = conn.getresponse()
        mime = response.getheader("Content-Type", "").lower()
        body = response.read(MAX_BYTES + 1)
        if len(body) > MAX_BYTES:
            raise ValueError("response too large")
        return response.status, mime, body
    finally:
        conn.close()


class ContactAnchors(html.parser.HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.links: list[tuple[str, str]] = []
        self.href: str | None = None
        self.text: list[str] = []

    def handle_starttag(self, tag, attrs):
        # Many small businesses put contact wording in an icon's alt text
        # or an accessible link label instead of visible anchor text.
        values = dict(attrs)
        if tag.lower() == "a" and self.href is None:
            href = values.get("href")
            if isinstance(href, str):
                self.href = href
                self.text = [value for value in (
                    values.get("aria-label"), values.get("title"))
                    if isinstance(value, str) and value.strip()]
        elif tag.lower() == "img" and self.href is not None:
            alt = values.get("alt")
            if isinstance(alt, str) and alt.strip():
                self.text.append(alt)

    def handle_data(self, data):
        if self.href is not None:
            self.text.append(data)

    def handle_endtag(self, tag):
        if tag.lower() == "a" and self.href is not None:
            self.links.append((self.href, "".join(self.text).strip()))
            self.href = None
            self.text = []


def contact_link(base_url: str, html_text: str) -> str:
    """Read anchor destinations only; never submit an inquiry or collect email data."""
    host, _ = same_origin_page(base_url)
    parser = ContactAnchors()
    parser.feed(html_text[:MAX_BYTES])
    options: list[tuple[int, str]] = []
    for href, text in parser.links:
        if not href or href.startswith(("#", "mailto:", "tel:", "javascript:")):
            continue
        if any(ch in href for ch in "\r\n\t"):
            continue
        candidate = urlsplit(urljoin(base_url, href))
        if (candidate.scheme != "https" or (candidate.hostname or "").lower() != host
                or candidate.port not in (None, 443) or candidate.username
                or candidate.password or candidate.query or candidate.fragment or not candidate.path):
            continue
        decoded = unquote(candidate.path)
        if NO_DIRECT_CONTACT.search(decoded):
            continue
        path_match = bool(CONTACT_PATH.search(decoded))
        label_match = bool(CONTACT_TEXT.search(text))
        if not path_match and not (label_match and re.search(r"/(?:form|ask)(?:/|$|[._-])", decoded, re.I)):
            continue
        # Avoid home page, anchors, tracking tokens, cross-company and mailto URLs.
        if decoded == "/" or len(candidate.path) > 160:
            continue
        url = urlunsplit(("https", host, candidate.path, "", ""))
        options.append((int(path_match) * 5 + int(label_match) * 3
                        - min(candidate.path.count("/"), 8), url))
    return sorted(options, key=lambda x: (-x[0], x[1]))[0][1] if options else ""


def read_official_contact_url(website: str) -> str:
    """Respect robots rules; fetch *only* robots.txt and initial page, no redirects."""
    host, path = same_origin_page(website)
    ip = public_address(host)
    robots_code, _, robots = request_pinned(host, "/robots.txt", ip)
    if robots_code != 404:
        if robots_code != 200:
            return ""
        policy = RobotFileParser()
        policy.parse(robots.decode("utf-8", errors="replace").splitlines())
        if not policy.can_fetch(USER_AGENT, "https://" + host + path):
            return ""
    code, mime, body = request_pinned(host, path, ip)
    if code != 200 or not ("text/html" in mime or "application/xhtml+xml" in mime):
        return ""
    charset = re.search(r"charset\s*=\s*([a-z0-9_-]+)", mime, re.I)
    encoding = (charset.group(1) if charset else "utf-8").lower()
    if encoding in ("shift_jis", "shift-jis", "sjis", "windows-31j"):
        encoding = "cp932"
    if encoding not in ("utf-8", "cp932", "euc-jp", "iso-8859-1"):
        encoding = "utf-8"
    return contact_link("https://" + host + path, body.decode(encoding, errors="replace"))


def enrich_archive(archive: Path, recent: Path, *, day: dt.date, batch: int,
                   limit: int = MAX_PER_RUN, discover=read_official_contact_url) -> dict:
    if not 0 <= batch < 8 or not 0 <= limit <= MAX_PER_RUN:
        raise ValueError("out-of-bounds batch/limit")
    with archive.open(encoding="utf-8-sig", newline="") as handle:
        rows = [{k: row.get(k, "") for k in FIELDS} for row in csv.DictReader(handle)]
    def scan_due(row):
        # A scan is not verified contact evidence. Never use checked_at as
        # proof of email permission or suppress an unrelated valid review.
        try:
            last = dt.date.fromisoformat(row.get("contact_scanned_at", ""))
        except ValueError:
            return True
        age = (day - last).days
        return not (0 <= age < 30)

    possible = [i for i, row in enumerate(rows)
                if not row["contact_url"] and not row["email"]
                and row["solicitation_prohibited"].strip().lower() not in ("true", "1", "yes")
                and row["name"]
                and row["service"] in ("CARE", "SPARK", "PLAY")
                and next(safe_websites({"websites": [row["website"]]}), None)
                and scan_due(row)]
    if not possible or limit == 0:
        return {"checked": 0, "contact_links_found": 0,
                "skipped_recent_scans": sum(
                    1 for row in rows if row.get("contact_scanned_at") and not scan_due(row)),
                "total_archive_rows": len(rows), "mail_send_authorized": 0}
    start = (((day - dt.date(2026, 1, 1)).days * 8 + batch) * limit) % len(possible)
    chosen = [possible[(start + i) % len(possible)] for i in range(min(limit, len(possible)))]
    checked = found = 0
    for index in chosen:
        row = rows[index]
        checked += 1
        try:
            result = discover(row["website"])
            if result:
                source_host, _ = same_origin_page(row["website"])
                target_host, target_path = same_origin_page(result)
                if target_host == source_host and CONTACT_PATH.search(unquote(target_path)):
                    row["contact_url"] = result
                    row["checked_at"] = day.isoformat()
                    found += 1
        except (OSError, ValueError, TimeoutError, ssl.SSLError, UnicodeError):
            # Individual malformed/unreachable websites do not stop other sites.
            pass
        # An unsuccessful, blocked or invalid response is not legal verification.
        # Remember only the scan date, then allow a bounded revisit in 30 days.
        row["contact_scanned_at"] = day.isoformat()
    if checked:
        archive.parent.mkdir(parents=True, exist_ok=True)
        with tempfile.NamedTemporaryFile("w", encoding="utf-8", newline="",
                                         dir=archive.parent, delete=False) as handle:
            tmp = Path(handle.name)
            writer = csv.DictWriter(handle, fieldnames=FIELDS)
            writer.writeheader()
            writer.writerows(rows)
        os.replace(tmp, archive)
        write_recent_csv(archive, recent)
    return {"checked": checked, "contact_links_found": found,
            "scanned_without_link": checked - found,
            "skipped_recent_scans": sum(
                1 for row in rows if row.get("contact_scanned_at") and not scan_due(row)),
            "total_archive_rows": len(rows), "mail_send_authorized": 0}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--archive", default="data/mate_overture_discovery.csv")
    parser.add_argument("--recent", default="data/mate_overture_recent.csv")
    parser.add_argument("--limit", type=int, default=MAX_PER_RUN)
    parser.add_argument("--day", default=dt.datetime.now(dt.timezone.utc).date().isoformat())
    parser.add_argument("--batch", type=int, choices=range(8), default=None)
    args = parser.parse_args()
    now = dt.datetime.now(dt.timezone.utc)
    batch = args.batch if args.batch is not None else min(7, now.hour // 3)
    outcome = enrich_archive(Path(args.archive), Path(args.recent),
                             day=dt.date.fromisoformat(args.day),
                             batch=batch, limit=args.limit)
    print(json.dumps(outcome | {
        "mode": "public first-party contact links only; no outreach or email extraction",
        "contact_links_are_send_approval": False,
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()
