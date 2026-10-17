#!/usr/bin/env python3
"""Export only explicitly contracted, approved MATE SPARK schools from Google Sheets.

Run with GOOGLE_SERVICE_ACCOUNT_JSON and GOOGLE_SHEETS_ID environment variables.
Pure build_public() is deliberately testable without access to Google Sheets.
"""
from __future__ import annotations

import datetime
import json
import os
import re
import tempfile
from pathlib import Path
from urllib.parse import urlparse

SPARK_SHEET = "SPARK営業候補"
CONTRACT_SHEET = "掲載契約"
PREFECTURES = ("東京都", "神奈川県", "埼玉県", "千葉県")
AGES = ("幼児", "小学生", "中学生", "高校生")
REQUIRED_SPARK = {
    "ID", "企業・教室名", "都県・対象", "ジャンル",
    "公式・窓口URL", "掲載許諾", "対象学年（カンマ区切り）",
    "最寄駅", "掲載紹介文", "体験受付許諾", "掲載内容確認日",
}
REQUIRED_CONTRACT = {
    "契約ID", "サービス", "掲載先ID", "同意者", "同意日時",
    "合意証拠URL・メールID", "状態",
}
ALLOWED_CONSENT = {"許可", "承諾済", "許諾済"}
ALLOWED_CONTRACT = {"有効", "掲載中"}


def value(row, key):
    return str(row.get(key) or "").strip()


def approved_url(url):
    try:
        u = urlparse(url)
        return (
            u.scheme == "https"
            and bool(u.hostname)
            and "." in u.hostname
            and not u.username
            and not u.password
            and len(url) < 1024
        )
    except ValueError:
        return False


def normalized_ages(raw):
    tokens = re.split(r"[,，、/・;\n]+", raw)
    result = []
    for token in tokens:
        token = token.strip()
        if token.startswith("小学"):
            token = "小学生"
        elif token.startswith("中学"):
            token = "中学生"
        elif token.startswith("高校"):
            token = "高校生"
        elif token in {"未就学", "未就学児", "年少", "年中", "年長"}:
            token = "幼児"
        if token in AGES and token not in result:
            result.append(token)
    return result


def build_public(candidates, contracts):
    """Return a sanitized public data set, failing closed on ambiguity."""
    active = {}
    for row in contracts:
        if value(row, "サービス") != "SPARK":
            continue
        if value(row, "状態") not in ALLOWED_CONTRACT:
            continue
        school_id = value(row, "掲載先ID")
        if not all(value(row, x) for x in (
            "契約ID", "掲載先ID", "同意者", "同意日時", "合意証拠URL・メールID"
        )):
            continue
        # At most one valid active contract per school: reject ambiguous ones.
        if school_id in active:
            raise ValueError(f"duplicate active contract for school: {school_id}")
        active[school_id] = row

    public = []
    seen = set()
    for row in candidates:
        school_id = value(row, "ID")
        if school_id in seen:
            raise ValueError(f"duplicate school ID: {school_id}")
        if school_id:
            seen.add(school_id)
        if not school_id or school_id not in active:
            continue
        if value(row, "掲載許諾") not in ALLOWED_CONSENT:
            continue
        name = value(row, "企業・教室名")
        category = value(row, "ジャンル")
        url = value(row, "公式・窓口URL")
        description = value(row, "掲載紹介文")
        station = value(row, "最寄駅")
        checked_at = value(row, "掲載内容確認日")
        try:
            datetime.date.fromisoformat(checked_at)
        except ValueError:
            continue
        areas = value(row, "都県・対象")
        region = next((p for p in PREFECTURES if areas.startswith(p)), "")
        ages = normalized_ages(value(row, "対象学年（カンマ区切り）"))
        if not all((name, category, region, description, ages)) or not approved_url(url):
            continue
        public.append({
            "id": school_id[:120],
            "name": name[:160],
            "region": region,
            "station": station[:100],
            "category": category[:60],
            "ages": ages,
            "description": description[:500],
            "url": url,
            "approved": True,
            "acceptsTrial": value(row, "体験受付許諾") == "可",
            "verifiedAt": checked_at,
        })
    return sorted(public, key=lambda s: (s["region"], s["name"], s["id"]))


def main():
    secret = os.environ.get("GOOGLE_SERVICE_ACCOUNT_JSON", "")
    spreadsheet_id = os.environ.get("GOOGLE_SHEETS_ID", "")
    if not secret or not spreadsheet_id:
        raise SystemExit("Missing Google Sheets read-only credentials or spreadsheet id")
    import gspread
    from google.oauth2.service_account import Credentials

    credentials = Credentials.from_service_account_info(
        json.loads(secret),
        scopes=["https://www.googleapis.com/auth/spreadsheets.readonly"],
    )
    client = gspread.authorize(credentials)
    book = client.open_by_key(spreadsheet_id)
    sheet_c = book.worksheet(SPARK_SHEET)
    sheet_agreements = book.worksheet(CONTRACT_SHEET)
    candidate_headers = set(sheet_c.row_values(1))
    agreement_headers = set(sheet_agreements.row_values(1))
    if not REQUIRED_SPARK.issubset(candidate_headers):
        raise RuntimeError("SPARK source headers missing: " + repr(sorted(REQUIRED_SPARK - candidate_headers)))
    if not REQUIRED_CONTRACT.issubset(agreement_headers):
        raise RuntimeError("Contract headers missing: " + repr(sorted(REQUIRED_CONTRACT - agreement_headers)))

    result = build_public(
        sheet_c.get_all_records(default_blank=""),
        sheet_agreements.get_all_records(default_blank=""),
    )
    # Never put the source's private contact columns or consent evidence in this public JSON.
    destination = Path("spark/schools.json")
    destination.parent.mkdir(parents=True, exist_ok=True)
    content = json.dumps(result, ensure_ascii=False, indent=2) + "\n"
    with tempfile.NamedTemporaryFile(
        mode="w", encoding="utf-8", dir=destination.parent,
        prefix=".schools-", suffix=".tmp", delete=False
    ) as tmp:
        tmp.write(content)
        tmp_path = Path(tmp.name)
    os.replace(tmp_path, destination)
    print(f"Published MATE SPARK schools: {len(result)}")


if __name__ == "__main__":
    main()
