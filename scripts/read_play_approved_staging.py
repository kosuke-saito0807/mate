#!/usr/bin/env python3
"""Read reviewed MATE applications with readonly credentials and build staging PLAY JSON.
No POST, no CMS access, no public deploy. Requires repository secrets in Actions.
"""
import datetime as dt
import json
import os
from pathlib import Path
from build_play_staging import build_public

SHEET = "掲載セルフ申請"
EXPECTED_ID = "1CLJeXuznctRtH8Y3AMZ2XyOu3dQedmh9obBDrPlIEuQ"
HEADERS = {"申請ID","サービス","審査状態","担当者権限の確認","審査者",
           "掲載申請の意思","情報確認日","教室・事業者名","公式URL",
           "ジャンル","紹介文","都道府県"}

def main():
    raw = os.getenv("GOOGLE_SERVICE_ACCOUNT_JSON", "")
    sid = os.getenv("GOOGLE_SHEETS_ID", "")
    if not raw or sid != EXPECTED_ID:
        raise SystemExit("Missing read-only credentials or wrong spreadsheet")
    import gspread
    from google.oauth2.service_account import Credentials
    info = json.loads(raw)
    creds = Credentials.from_service_account_info(
        info, scopes=["https://www.googleapis.com/auth/spreadsheets.readonly"])
    book = gspread.authorize(creds).open_by_key(sid)
    tab = book.worksheet(SHEET)
    headers = set(tab.row_values(1))
    if not HEADERS.issubset(headers):
        raise RuntimeError("Source headers missing: " + repr(sorted(HEADERS - headers)))
    # Raw rows stay in process memory. Never write raw application data to files/artifacts/logs.
    rows = tab.get_all_records(default_blank="")
    today = dt.datetime.now(dt.timezone(dt.timedelta(hours=9))).date()
    public = build_public(rows, today=today)
    path = Path("staging/play-approved.json")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(public, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"PLAY staging public-only records: {len(public)}; no CMS writes or deploys")

if __name__ == "__main__":
    main()
