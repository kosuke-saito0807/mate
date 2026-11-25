#!/usr/bin/env python3
"""Separate, bounded OSM candidate discovery. Never authorizes or sends outreach.

Source data: © OpenStreetMap contributors, Open Database License (ODbL).
https://www.openstreetmap.org/copyright
Keep this database separate from Overture and CRM to preserve attribution
and review status. Website metadata is crowd-sourced, not ownership proof.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import re
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, urlsplit
from urllib.request import Request, urlopen

from collect_overture_growth import (
    CITIES, EXCLUDE, FIELDS, classify, safe_websites, update_csv, write_recent_csv
)

ATTRIBUTION = "© OpenStreetMap contributors (ODbL)"
LICENSE_URL = "https://www.openstreetmap.org/copyright"
ENDPOINT = "https://overpass.private.coffee/api/interpreter"
AGENT = "MATE-open-data-discovery/1.0 (+https://care.kosodatemate.jp/operator.html)"
MAX_BYTES = 2_500_000
MAX_ELEMENTS = 1500
# Two sites per day, one small rectangular area per site.
NAME_RE = (
    "子ども|こども|キッズ|幼児|親子|教室|スクール|体験|"
    "ワークショップ|アトリエ|シッター|リトミック|水泳|"
    "陶芸|ガラス|絵付け|書道|ピアノ|習字|科学|農業"
)


def tiles(day: dt.date) -> list[tuple[str, tuple[float, float, float, float]]]:
    """Cover all 50 known city centres in 25 days, then nearby bounded tiles."""
    tick = max(0, (day - dt.date(2026, 11, 25)).days)
    selected = tick % 25
    cycle = tick // 25
    shifts = ((0.0, 0.0), (0.10, 0.0), (-0.10, 0.0),
              (0.0, 0.09), (0.0, -0.09), (0.10, 0.09),
              (-0.10, -0.09), (0.10, -0.09), (-0.10, 0.09))
    lat_delta, lon_delta = shifts[cycle % len(shifts)]
    result = []
    for index in (selected, selected + 25):
        name, lat, lon = CITIES[index]
        la, lo = lat + lat_delta, lon + lon_delta
        result.append((name + " OSM " + str(cycle + 1),
                       (la - 0.035, lo - 0.055, la + 0.035, lo + 0.055)))
    return result


def query_for_bbox(bbox: tuple[float, float, float, float]) -> str:
    south, west, north, east = bbox
    if not (20 < south < north < 47 and 120 < west < east < 154
            and north - south <= 0.071 and east - west <= 0.111):
        raise ValueError("Unbounded or invalid OSM query rectangle")
    b = ",".join(f"{v:.5f}" for v in (south, west, north, east))
    # Only named places with a website, bounded geographically and by output.
    # No OSM user history, changesets, contact emails or phone attributes.
    return (
        "[out:json][timeout:24][maxsize:18000000];("
        'nwr["name"~"' + NAME_RE + '"]["website"](' + b + ');'
        'nwr["name"~"' + NAME_RE + '"]["contact:website"](' + b + ');'
        'nwr["craft"~"pottery|glassblower|ceramics"]["website"](' + b + ');'
        ');out tags ' + str(MAX_ELEMENTS) + ";"
    )


def download(bbox: tuple[float, float, float, float]) -> dict:
    request = Request(
        ENDPOINT, data=urlencode({"data": query_for_bbox(bbox)}).encode("utf-8"),
        headers={"User-Agent": AGENT, "Accept": "application/json",
                 "Content-Type": "application/x-www-form-urlencoded"},
        method="POST",
    )
    with urlopen(request, timeout=40) as response:
        if response.status != 200 or "json" not in response.headers.get("Content-Type", "").lower():
            raise ValueError("OSM service did not return JSON")
        raw = response.read(MAX_BYTES + 1)
    if len(raw) > MAX_BYTES:
        raise ValueError("OSM response exceeded bounded download limit")
    payload = json.loads(raw)
    if not isinstance(payload, dict) or not isinstance(payload.get("elements"), list):
        raise ValueError("Unexpected OSM response")
    if len(payload["elements"]) > MAX_ELEMENTS:
        raise ValueError("OSM response exceeded element limit")
    return payload


def select_candidates(payload: dict, region: str):
    """Accept only business-like OSM features with plausible HTTPS websites."""
    for element in payload.get("elements", []):
        if not isinstance(element, dict):
            continue
        osm_type, osm_id = element.get("type"), element.get("id")
        if osm_type not in ("node", "way", "relation") or type(osm_id) is not int or osm_id <= 0:
            continue
        tags = element.get("tags")
        if not isinstance(tags, dict):
            continue
        name = tags.get("name:ja") or tags.get("name") or ""
        if not isinstance(name, str) or not 4 <= len(name) <= 130 or EXCLUDE.search(name):
            continue
        if any(tags.get(k) in ("no", "closed", "disused", "abandoned")
               for k in ("disused", "abandoned", "shop")):
            continue
        # OSM tags such as 'amenity=school' alone are not enough: reuse the
        # carefully scoped, child-oriented name/category rules from Overture.
        taxonomy = " ".join(str(tags.get(k) or "") for k in (
            "amenity", "craft", "leisure", "sport", "club", "office"))
        service = classify({"names": {"primary": name},
                            "taxonomy": {"primary": taxonomy}})
        if service not in ("CARE", "SPARK", "PLAY"):
            continue
        site = tags.get("website") or tags.get("contact:website")
        if not isinstance(site, str):
            continue
        url = next(safe_websites({"websites": [site]}), None)
        if not url:
            continue
        try:
            parsed = urlsplit(url)
            if (parsed.query or parsed.fragment or parsed.username or
                    parsed.password or parsed.port not in (None, 443)):
                continue
        except ValueError:
            continue
        yield {
            "service": service, "name": name, "website": url, "region": region,
            "email": "", "contact_url": "",
            "source_url": f"https://www.openstreetmap.org/{osm_type}/{osm_id}",
            "mail_basis": "UNVERIFIED", "checked_at": "",
            "solicitation_prohibited": "false",
        }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--day", default=dt.datetime.now(dt.timezone.utc).date().isoformat())
    parser.add_argument("--output", default="data/mate_osm_discovery.csv")
    parser.add_argument("--recent", default="data/mate_osm_recent.csv")
    args = parser.parse_args()
    day = dt.date.fromisoformat(args.day)
    new_records = []
    failed = []
    for name, bounds in tiles(day):
        try:
            payload = download(bounds)
            new_records.extend(select_candidates(payload, name))
        except (OSError, HTTPError, URLError, ValueError, TimeoutError) as exc:
            failed.append({"area": name, "error_type": type(exc).__name__})
    if len(failed) == 2:
        raise RuntimeError("Both bounded OSM query areas failed (no data persisted)")
    added, count = update_csv(Path(args.output), new_records, cap=30000)
    recent = write_recent_csv(Path(args.output), Path(args.recent))
    print(json.dumps({
        "source": ATTRIBUTION, "license": LICENSE_URL,
        "new_candidates": added, "total_archive": count,
        "recent_feed": recent, "areas_requested": 2,
        "areas_failed": failed, "mail_send_authorized": 0,
        "not_verified_for_outreach": True,
        "extracted_emails": 0, "extracted_phones": 0,
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()
