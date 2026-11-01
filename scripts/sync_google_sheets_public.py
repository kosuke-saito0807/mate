#!/usr/bin/env python3
"""Fail-closed, read-only Google Sheets export for consented MATE CARE listings."""
from __future__ import annotations

import datetime
import json
import os
import re
import tempfile
from pathlib import Path
from urllib.parse import urlparse

SPREADSHEET_ID = os.environ.get("GOOGLE_SHEETS_ID", "1CLJeXuznctRtH8Y3AMZ2XyOu3dQedmh9obBDrPlIEuQ")
WORKSHEET_NAME = os.environ.get("GOOGLE_SHEETS_WORKSHEET", "営業管理DB")
CONTRACT_SHEET = "掲載契約"
REQUIRED_HEADERS = {
    "ID", "事業者名", "掲載許可", "MATE掲載ステータス",
    "公式サイト", "掲載情報確認日",
}
REQUIRED_CONTRACT_HEADERS = {
    "契約ID", "サービス", "掲載先ID", "同意者", "同意日時", "条件版",
    "合意証拠URL・メールID", "開始日", "終了日", "状態",
}
PUBLIC_COLUMNS = {
    "ID": "id",
    "事業者名": "name",
    "エリア": "area",
    "東京都施設番号": "facility_no",
}


def as_text(x):
    return str(x).strip() if x is not None else ""


def verified_https(url):
    try:
        u = urlparse(url)
        return (u.scheme == "https" and bool(u.hostname) and "." in u.hostname
                and not u.username and not u.password and len(url) < 1024)
    except ValueError:
        return False


def signed_care_contracts(contracts, today):
    """Only effective, evidenced contracts inside their signed time window."""
    active = set()
    for row in contracts:
        if as_text(row.get("サービス")) not in {"CARE", "SITTER"}:
            continue
        if as_text(row.get("状態")) not in {"有効", "掲載中"}:
            continue
        if not all(as_text(row.get(key)) for key in REQUIRED_CONTRACT_HEADERS):
            continue
        # Drafts are never evidence, even if someone accidentally edits status.
        if as_text(row.get("契約ID")).startswith("DRAFT-"):
            continue
        try:
            start = datetime.date.fromisoformat(as_text(row["開始日"]))
            end = datetime.date.fromisoformat(as_text(row["終了日"]))
            signed_raw = as_text(row["同意日時"])
            if not re.fullmatch(r"\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}(?::\d{2})?)?", signed_raw):
                continue
            signed = datetime.date.fromisoformat(signed_raw[:10])
        except ValueError:
            continue
        if not (signed <= today and start <= today <= end and start <= end):
            continue
        provider_id = as_text(row["掲載先ID"])
        if provider_id in active:
            raise ValueError("Duplicate valid CARE contract for ID: " + provider_id)
        active.add(provider_id)
    return active


def build_public(rows, contracts=(), today=None):
    if today is None:
        today = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=9))).date()
    active = signed_care_contracts(contracts, today)
    result = []
    seen = set()
    for row in rows:
        # Permission is independent from general営業 status. Never publish a candidate.
        if as_text(row.get("掲載許可")) != "許可" or as_text(row.get("MATE掲載ステータス")) != "掲載許可":
            continue
        school_id = as_text(row.get("ID"))
        school_name = as_text(row.get("事業者名"))
        url = as_text(row.get("公式サイト"))
        checked = as_text(row.get("掲載情報確認日"))
        try:
            checked_date = datetime.date.fromisoformat(checked)
        except ValueError:
            continue
        if not 0 <= (today - checked_date).days <= 365:
            continue
        if not school_id or school_id not in active or not school_name or not verified_https(url):
            continue
        if school_id in seen:
            raise ValueError("Duplicate approved CARE provider ID: " + school_id)
        seen.add(school_id)
        provider = {
            "id": school_id[:120],
            "name": school_name[:180],
            "area": as_text(row.get("エリア"))[:300],
            "facility_no": as_text(row.get("東京都施設番号"))[:120],
            "official_url": url,
            "verified": True,
            "verified_at": checked_date.isoformat(),
            "status": "掲載許可",
        }
        # Only business-facing fields provided and verified by the approved business.
        for source,target,maxlen in (("掲載紹介文","description",500),("サービス区分","category",70),
                                     ("料金メモ","pricingNotes",140),("対応時間","openingHours",140),
                                     ("特徴タグ","tags",160)):
            entry=as_text(row.get(source))
            if entry:
                provider[target]=entry[:maxlen]
        source_date = as_text(row.get("公開一覧掲載基準日"))
        try:
            if source_date:
                provider["data_as_of"] = datetime.date.fromisoformat(source_date).isoformat()
        except ValueError:
            pass  # Unknown source date is omitted rather than guessed.
        result.append(provider)
    return sorted(result, key=lambda x: (x["area"], x["name"], x["id"]))


def main():
    secret = os.environ.get("GOOGLE_SERVICE_ACCOUNT_JSON", "")
    if not secret:
        raise SystemExit("Missing GOOGLE_SERVICE_ACCOUNT_JSON read-only Sheets secret")
    import gspread
    from google.oauth2.service_account import Credentials

    info = json.loads(secret)
    creds = Credentials.from_service_account_info(
        info, scopes=["https://www.googleapis.com/auth/spreadsheets.readonly"],
    )
    client = gspread.authorize(creds)
    book = client.open_by_key(SPREADSHEET_ID)
    sheet = book.worksheet(WORKSHEET_NAME)
    contract_sheet = book.worksheet(CONTRACT_SHEET)
    missing = REQUIRED_HEADERS - set(sheet.row_values(1))
    if missing:
        raise RuntimeError("CARE source missing columns: " + ", ".join(sorted(missing)))
    missing_contract = REQUIRED_CONTRACT_HEADERS - set(contract_sheet.row_values(1))
    if missing_contract:
        raise RuntimeError("CARE contract source missing columns: " + ", ".join(sorted(missing_contract)))
    records = sheet.get_all_records(default_blank="")
    contracts = contract_sheet.get_all_records(default_blank="")
    public = build_public(records, contracts)
    output = Path("data.json")
    with tempfile.NamedTemporaryFile(
        mode="w", encoding="utf-8", dir=output.parent,
        prefix=".care-", suffix=".tmp", delete=False
    ) as tmp:
        json.dump(public, tmp, ensure_ascii=False, indent=2)
        tmp.write("\n")
        tmp_path = Path(tmp.name)
    os.replace(tmp_path, output)
    print(f"Published MATE CARE providers with verified permission and active agreement: {len(public)}")


if __name__ == "__main__":
    main()
