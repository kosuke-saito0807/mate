#!/usr/bin/env python3
"""Free, bounded Overture Places discovery. Leads are NEVER email-send approved.

Uses Overture's public geospatial extract CLI (licensed source) only; no
search-engine scraping, guessed email addresses, or automated contact forms.
Monthly place data can be noisy; this creates discovery-only CSV records.
"""
import argparse
import csv
import datetime as dt
import json
import os
import re
import subprocess
import tempfile
from pathlib import Path
from urllib.parse import urlsplit

SOURCE_URL = "https://docs.overturemaps.org/guides/places/"
FIELDS = ("service", "name", "website", "region", "email", "contact_url",
          "source_url", "mail_basis", "checked_at", "solicitation_prohibited")
CITIES = (
 ("東京",35.680,139.735),("横浜",35.462,139.628),
 ("大阪",34.685,135.500),("名古屋",35.172,136.907),
 ("福岡",33.591,130.404),("札幌",43.063,141.352),
 ("神戸",34.689,135.195),("京都",35.011,135.768),
 ("川崎",35.530,139.699),("さいたま",35.861,139.645),
 ("千葉",35.607,140.107),("仙台",38.268,140.870),
 ("広島",34.395,132.456),("静岡",34.975,138.383),
 ("浜松",34.711,137.726),("岡山",34.665,133.919),
 ("熊本",32.803,130.708),("北九州",33.883,130.875),
 ("新潟",37.916,139.036),("金沢",36.561,136.656),
 ("宇都宮",36.558,139.883),("高松",34.342,134.046),
 ("鹿児島",31.597,130.558),("那覇",26.213,127.680),
)
BLOCKED = ("facebook.com", "instagram.com", "google.com", "tabelog.com",
           "youtube.com", "x.com", "ameblo.jp", "note.com", "line.me",
           "amazon.com", "amazon.co.jp", "rakuten.co.jp", "rakuten.com",
           "tripadvisor.com", "booking.com", "jalan.net", "hotpepper.jp")
EXCLUDE = re.compile(r"code\s*camp|コード\s*キャンプ|口コミ|ランキング|求人", re.I)
MAIL_RE = re.compile(r"^[a-z0-9.-]+$", re.I)


def safe_websites(props):
    value = props.get("websites", [])
    if isinstance(value, (str, dict)):
        value = [value]
    for item in value if isinstance(value, list) else []:
        url = item if isinstance(item, str) else (
            item.get("url") or item.get("value") or item.get("website") or ""
        ) if isinstance(item, dict) else ""
        if not isinstance(url, str) or not url.startswith("https://"):
            continue
        p = urlsplit(url)
        host = (p.hostname or "").lower()
        if (not host or not MAIL_RE.fullmatch(host)
                or host.startswith(("localhost", "127."))
                or any(host == b or host.endswith("." + b) for b in BLOCKED)
                or host.endswith((".lg.jp", ".go.jp", ".ac.jp"))
                or re.search(r"(^|\.)codecamp", host, re.I)):
            continue
        yield "https://" + host + (p.path if p.path else "/")


def get_name(props):
    n = props.get("names") or {}
    result = n.get("primary", "") if isinstance(n, dict) else ""
    return str(result).strip() if result else ""


def classify(props):
    name = get_name(props)
    t = props.get("taxonomy") or {}
    if isinstance(t, dict):
        primary = t.get("primary") or ""
        tax = str(primary.get("category", "")) if isinstance(primary, dict) else str(primary)
    else:
        tax = str(t)
    category = " ".join([tax, str(props.get("basic_category") or "")]).lower()
    # CARE is a sitter marketplace, NOT a general daycare directory.
    if re.search(r"baby.?sitt|nanny|home.?child.?care", category) or re.search(
        r"ベビーシッター|訪問保育|訪問型保育|家事育児サポート", name):
        return "CARE"
    # Generic category often misses distinctly named child-facing classes.
    if re.search(r"ピアノ教室|音楽教室|英会話|ロボット教室|プログラミング教室|"
                 r"体操教室|水泳教室|バレエ教室|ダンススクール|そろばん教室|"
                 r"子ども英語|こども英語", name):
        return "SPARK"
    if re.search(r"親子体験|工作体験|陶芸体験|農業体験|キッズワークショップ", name):
        return "PLAY"
    if re.search(r"tutor|learning.center|language.school|dance.school|music.school|"
                 r"art.school|martial.art|sports.academy|swim.school|"
                 r"coding|robot|school.of.music|music.lesson|"
                 r"dance.studio|dance.class|swimming.school|gymnastics|"
                 r"language.center|education.center|sports.school", category):
        return "SPARK"
    if re.search(r"craft|pottery|workshop|art.studio|horse.riding|"
                 r"kids.activity|creative.arts|museum|science.center|"
                 r"aquarium|zoo|amusement.park|theme.park|"
                 r"adventure.park|nature.center|visitor.center|"
                 r"botanical.garden|children.s.museum", category):
        return "PLAY"
    return None


def select_records(feature_collection, region):
    items = feature_collection.get("features", [])
    for item in items:
        p = item.get("properties") or {}
        name = get_name(p)
        if not (4 <= len(name) <= 130) or EXCLUDE.search(name):
            continue
        if p.get("operating_status") == "permanently_closed":
            continue
        if p.get("confidence") is not None:
            try:
                if float(p["confidence"]) < 0.6:
                    continue
            except (ValueError, TypeError):
                continue
        svc = classify(p)
        if not svc:
            continue
        website = next(safe_websites(p), None)
        if not website:
            continue
        yield dict(service=svc, name=name, website=website, region=region,
                   email="", contact_url="", source_url=SOURCE_URL,
                   mail_basis="UNVERIFIED", checked_at="",
                   solicitation_prohibited="false")


def site_key(rec):
    return (rec["service"], rec["name"].strip().casefold(),
            (urlsplit(rec["website"]).hostname or "").lower())


def cell_clean(x):
    x = str(x or "")
    # Protect spreadsheet from formula execution on CSV import.
    if x.startswith(("=", "+", "-", "@")):
        return "'" + x
    return x[:240]


def city_tile(day, slot):
    tick = day.toordinal() - dt.date(2026, 1, 1).toordinal()
    i = (tick * 16 + slot) % (len(CITIES) * 9)
    city, lat, lon = CITIES[i // 9]
    tile = i % 9
    lon += ((tile % 3) - 1) * 0.12
    lat += ((tile // 3) - 1) * 0.09
    return city + " " + str(tile + 1) + "/9", (
        lon - 0.055, lat - 0.040, lon + 0.055, lat + 0.040)


def update_csv(path, discovered, cap=30000):
    path.parent.mkdir(parents=True, exist_ok=True)
    records = []
    if path.exists():
        with path.open(encoding="utf-8-sig", newline="") as f:
            for row in csv.DictReader(f):
                if row.get("service") and row.get("website") and row.get("name"):
                    records.append({k: row.get(k, "") for k in FIELDS})
    seen = {site_key(r) for r in records}
    added = 0
    for rec in discovered:
        key = site_key(rec)
        if key in seen or len(records) >= cap:
            continue
        records.append({k: cell_clean(rec.get(k, "")) for k in FIELDS})
        seen.add(key)
        added += 1
    with path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=FIELDS)
        writer.writeheader()
        writer.writerows(records)
    return added, len(records)


def write_recent_csv(full_path, recent_path, limit=1200):
    """Keep hourly GAS CSV imports bounded without losing the source archive.

    The full archive is append-only and deduplicated; the recent window is
    discover-only and the GAS leads sheet maintains its own duplicate keys.
    """
    with full_path.open(encoding="utf-8-sig", newline="") as handle:
        records = list(csv.DictReader(handle))
    recent_path.parent.mkdir(parents=True, exist_ok=True)
    with recent_path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=FIELDS)
        writer.writeheader()
        writer.writerows(records[-limit:])
    return min(len(records), limit)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", default="data/mate_overture_discovery.csv")
    parser.add_argument("--day", default=dt.datetime.now(dt.timezone.utc).date().isoformat())
    parser.add_argument("--batch", type=int, default=None, choices=range(8))
    parser.add_argument("--recent-output", default="data/mate_overture_recent.csv")
    args = parser.parse_args()
    now = dt.datetime.now(dt.timezone.utc)
    day = dt.date.fromisoformat(args.day)
    batch = args.batch if args.batch is not None else min(7, now.hour // 3)
    discovered = []
    # Sixteen distinct bounded tiles/day in eight serial batches, no API key.
    for slot in range(batch * 2, batch * 2 + 2):
        label, bbox = city_tile(day, slot)
        with tempfile.TemporaryDirectory() as work:
            dst = os.path.join(work, "places.geojson")
            cmd = ["overturemaps", "download", "--type=place",
                   "--bbox=" + ",".join(f"{v:.5f}" for v in bbox),
                   "-f", "geojson", "-o", dst]
            subprocess.run(cmd, check=True, timeout=480, capture_output=True)
            with open(dst, encoding="utf-8") as f:
                data = json.load(f)
            discovered.extend(select_records(data, label))
    added, total = update_csv(Path(args.output), discovered)
    recent_count = write_recent_csv(Path(args.output),Path(args.recent_output))
    print(json.dumps({"source": "Overture Places", "new_candidates": added,
                      "total_candidates_in_feed": total,
                      "recent_feed_records": recent_count,
                      "mail_send_authorized": 0,
                      "privacy": "no extracted emails or personal phones", "batch": batch}))


if __name__ == "__main__":
    main()
