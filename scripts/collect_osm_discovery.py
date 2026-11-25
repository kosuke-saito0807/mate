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
# Documented public Overpass instance: use at most ONCE per daily job, only if
# both primary areas time out or have transient 5xx errors; never evade 429.
FALLBACK_ENDPOINT = "https://overpass-api.de/api/interpreter"
AGENT = "MATE-open-data-discovery/1.0 (+https://care.kosodatemate.jp/operator.html)"
MAX_BYTES = 1_500_000
MAX_ELEMENTS = 800
# Two sites per day, one small rectangular area per site.


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
                       (la - 0.020, lo - 0.025, la + 0.020, lo + 0.025)))
    return result


def query_for_bbox(bbox: tuple[float, float, float, float]) -> str:
    south, west, north, east = bbox
    if not (20 < south < north < 47 and 120 < west < east < 154
            and north - south <= 0.041 and east - west <= 0.051):
        raise ValueError("Unbounded or invalid OSM query rectangle")
    b = ",".join(f"{v:.5f}" for v in (south, west, north, east))
    # Overpass's Unicode name-regex scan was timing out in bounded city
    # rectangles. The indexed existence selectors are lighter; apply the
    # child-facing name/category check locally after downloading only tags.
    # No OSM user history, changesets, contact emails or phone requests.
    return (
        "[out:json][timeout:18][maxsize:8000000];("
        'nwr["website"]["name"](' + b + ');'
        'nwr["contact:website"]["name"](' + b + ');'
        ');out tags ' + str(MAX_ELEMENTS) + ";"
    )


def download(bbox: tuple[float, float, float, float], endpoint: str = ENDPOINT) -> dict:
    if endpoint not in (ENDPOINT, FALLBACK_ENDPOINT):
        raise ValueError('Unapproved OSM endpoint')
    request = Request(
        endpoint, data=urlencode({"data": query_for_bbox(bbox)}).encode("utf-8"),
        headers={"User-Agent": AGENT, "Accept": "application/json",
                 "Content-Type": "application/x-www-form-urlencoded"},
        method="POST",
    )
    with urlopen(request, timeout=25 if endpoint == FALLBACK_ENDPOINT else 30) as response:
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
        if (any(str(tags.get(k, "")).lower() in ("yes", "true", "1")
                for k in ("disused", "abandoned"))
                or str(tags.get("shop", "")).lower() in ("closed", "disused", "abandoned")
                or str(tags.get("access", "")).lower() == "no"):
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
        # Inspect the ORIGINAL crowd-sourced URL before safe_websites() strips
        # userinfo, query strings or fragment identifiers during normalization.
        # OSM records can contain credentials/tracking identifiers.
        try:
            original = urlsplit(site)
            if (original.scheme != "https" or original.username or
                    original.password or original.query or original.fragment or
                    original.port not in (None, 443)):
                continue
        except ValueError:
            continue
        url = next(safe_websites({"websites": [site]}), None)
        if not url:
            continue
        yield {
            "service": service, "name": name, "website": url, "region": region,
            "email": "", "contact_url": "",
            "source_url": f"https://www.openstreetmap.org/{osm_type}/{osm_id}",
            "mail_basis": "UNVERIFIED", "checked_at": "",
            "solicitation_prohibited": "false",
        }



def retryable_source_failure(exc: Exception) -> bool:
    """Never bypass a denied/rate-limited source by switching providers."""
    if isinstance(exc, HTTPError):
        return exc.code in (500, 502, 503, 504)
    return isinstance(exc, (TimeoutError, URLError, OSError))


def collect_day(day: dt.date, *, fetch=None) -> dict:
    """At most 2 primary queries plus 1 fallback query TOTAL per day.

    The alternate endpoint only runs if *both* primary locations fail with
    transient/network errors. 429, 403 and other denials never trigger
    failover. No exponential retry loop; no personal data in telemetry.
    """
    if fetch is None:
        fetch = download
    areas = tiles(day)
    records = []
    failures = []
    query_stats = []
    blocked_by_provider = False
    for name, bounds in areas:
        try:
            data = fetch(bounds)
            accepted = list(select_candidates(data, name))
            records.extend(accepted)
            query_stats.append({"area": name, "elements": len(data["elements"]),
                                "eligible_candidates": len(accepted)})
        except (OSError, HTTPError, URLError, ValueError, TimeoutError) as exc:
            failures.append((name, bounds, exc))
            if isinstance(exc, HTTPError) and exc.code in (403, 429):
                # Respect an explicit provider refusal/rate limit immediately;
                # do not query the second area or switch public instances.
                blocked_by_provider = True
                break
    fallback_used = False
    if (not blocked_by_provider and len(failures) == len(areas)
            and all(retryable_source_failure(exc) for _, _, exc in failures)):
        # One attempt for the first failed area, never one per failed site.
        name, bounds, _ = failures[0]
        fallback_used = True
        try:
            data = fetch(bounds, endpoint=FALLBACK_ENDPOINT)
            accepted = list(select_candidates(data, name))
            records.extend(accepted)
            query_stats.append({"area": name, "elements": len(data["elements"]),
                                "eligible_candidates": len(accepted), "fallback": True})
            failures = failures[1:]
        except (OSError, HTTPError, URLError, ValueError, TimeoutError) as exc:
            failures[0] = (name, bounds, exc)
    return {
        "records": records,
        "areas_failed": [{
            "area": name, "error_type": type(exc).__name__,
            # Expose HTTP codes only, never response body, URL parameters,
            # user-provided names, or private error contents.
            **({"http_status": exc.code} if isinstance(exc, HTTPError) else {})
        } for name, _, exc in failures],
        "query_stats": query_stats,
        "fallback_used": fallback_used,
        "blocked_by_provider": blocked_by_provider,
    }

def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--day", default=dt.datetime.now(dt.timezone.utc).date().isoformat())
    parser.add_argument("--output", default="data/mate_osm_discovery.csv")
    parser.add_argument("--recent", default="data/mate_osm_recent.csv")
    args = parser.parse_args()
    day = dt.date.fromisoformat(args.day)
    result = collect_day(day)
    if result["blocked_by_provider"] or len(result["areas_failed"]) == 2:
        print(json.dumps({
            "source": ATTRIBUTION, "status": "unavailable",
            "areas_failed": result["areas_failed"],
            "query_stats": result["query_stats"],
            "fallback_used": result["fallback_used"],
            "blocked_by_provider": result["blocked_by_provider"],
            "mail_send_authorized": 0, "extracted_emails": 0,
            "extracted_phones": 0,
        }, ensure_ascii=False))
        raise RuntimeError("OSM source inaccessible or rate-limited; no data persisted")
    added, count = update_csv(Path(args.output), result["records"], cap=30000)
    recent = write_recent_csv(Path(args.output), Path(args.recent))
    print(json.dumps({
        "source": ATTRIBUTION, "license": LICENSE_URL,
        "new_candidates": added, "total_archive": count,
        "recent_feed": recent, "areas_requested": 2,
        "areas_failed": result["areas_failed"],
        "query_stats": result["query_stats"],
        "fallback_used": result["fallback_used"],
        "mail_send_authorized": 0, "not_verified_for_outreach": True,
        "extracted_emails": 0, "extracted_phones": 0,
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()
