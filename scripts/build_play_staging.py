#!/usr/bin/env python3
"""Generate a *staging-only* public PLAY listing feed from reviewed Sheets rows.

No Google credentials, network access, or production CMS mutation.
Input JSON must be a list of dicts keyed by the existing Japanese sheet headers.
"""
import argparse
import datetime as dt
import json
from pathlib import Path
from urllib.parse import urlparse

REQUIRED = ("申請ID", "サービス", "審査状態", "担当者権限の確認",
            "審査者", "掲載申請の意思", "情報確認日",
            "教室・事業者名", "公式URL", "ジャンル", "紹介文")
ACCEPTED = {"承認"}
BLOCKED_MARKERS = ("内部接続テスト", "内部テスト", "公開禁止", "非公開")
PUBLIC_KEYS = ("id", "title", "region", "area", "category",
               "description", "url", "verifiedAt", "nextDate")

def valid_https(url):
    try:
        p = urlparse(url)
        return p.scheme == "https" and bool(p.hostname) and "." in p.hostname and not p.username and not p.password
    except ValueError:
        return False

def build_public(rows, today=None):
    today = today or dt.date.today()
    out, seen = [], set()
    for item in rows:
        if not isinstance(item, dict):
            raise ValueError("Each application must be an object")
        if item.get("サービス") != "PLAY" or item.get("審査状態") not in ACCEPTED:
            continue
        if item.get("担当者権限の確認") != "確認済み" or not str(item.get("審査者") or "").strip():
            continue
        consent = str(item.get("掲載申請の意思") or "")
        if not consent or any(word in consent for word in BLOCKED_MARKERS):
            continue
        try:
            checked = dt.date.fromisoformat(str(item.get("情報確認日") or ""))
        except ValueError:
            continue
        if checked > today or (today - checked).days > 180:
            continue
        title = str(item.get("教室・事業者名") or "").strip()
        desc = str(item.get("紹介文") or "").strip()
        url = str(item.get("公式URL") or "").strip()
        application_id = str(item.get("申請ID") or "").strip()
        if any(word in title + desc for word in BLOCKED_MARKERS):
            continue
        if not (application_id.startswith("MATE-WEB-") and title and 25 <= len(desc) <= 500 and valid_https(url)):
            continue
        if application_id in seen:
            raise ValueError("Duplicate approved PLAY application: " + application_id)
        seen.add(application_id)
        start = str(item.get("次回体験予定日") or "").strip()
        try:
            when = dt.date.fromisoformat(start) if start else None
        except ValueError:
            when = None
        row = {
            "id": "mate-play-" + application_id[9:],
            "title": title[:160],
            "region": str(item.get("都道府県") or "")[:50],
            "area": str(item.get("市区町村・対応エリア") or "")[:140],
            "category": str(item.get("ジャンル") or "")[:70],
            "description": desc,
            "url": url,
            "verifiedAt": checked.isoformat(),
        }
        if when is not None and when >= today:
            row["nextDate"] = when.isoformat()
        if row["region"] and row["category"]:
            out.append(row)
    return sorted(out, key=lambda row: row["id"])

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, help="LOCAL PRIVATE JSON INPUT ONLY")
    parser.add_argument("--output", default="staging/play-approved.json")
    args = parser.parse_args()
    source, dest = Path(args.input), Path(args.output)
    if not dest.as_posix().startswith("staging/"):
        raise SystemExit("Refusing non-staging output")
    data = json.loads(source.read_text(encoding="utf-8"))
    if not isinstance(data, list):
        raise SystemExit("Input must be a list")
    approved = build_public(data)
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(json.dumps(approved, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("Staging-only approved PLAY listings:", len(approved))

if __name__ == "__main__":
    main()
