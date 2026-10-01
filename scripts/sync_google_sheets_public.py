#!/usr/bin/env python3
import json
import os

import gspread
from google.oauth2.service_account import Credentials

SPREADSHEET_ID = os.environ.get("GOOGLE_SHEETS_ID", "1CLJeXuznctRtH8Y3AMZ2XyOu3dQedmh9obBDrPlIEuQ")
WORKSHEET_NAME = os.environ.get("GOOGLE_SHEETS_WORKSHEET", "営業管理DB")
SERVICE_ACCOUNT_JSON = os.environ["GOOGLE_SERVICE_ACCOUNT_JSON"]

info = json.loads(SERVICE_ACCOUNT_JSON)
creds = Credentials.from_service_account_info(
    info,
    scopes=["https://www.googleapis.com/auth/spreadsheets.readonly"],
)
client = gspread.authorize(creds)
worksheet = client.open_by_key(SPREADSHEET_ID).worksheet(WORKSHEET_NAME)
rows = worksheet.get_all_records(default_blank="")

public = []
for row in rows:
    # Publish only when both the operator's permission and MATE status are approved.
    if str(row.get("掲載許可", "")).strip() != "許可":
        continue
    if str(row.get("MATE掲載ステータス", "")).strip() != "掲載許可":
        continue

    official = str(row.get("公式サイト", "")).strip()
    if not official:
        continue

    public.append({
        "id": str(row.get("ID", "")).strip(),
        "name": str(row.get("事業者名", "")).strip(),
        "area": str(row.get("エリア", "")).strip(),
        "facility_no": str(row.get("東京都施設番号", "")).strip(),
        "official_url": official,
        "verified": True,
        "data_as_of": str(row.get("公開一覧掲載基準日", "") or "2026-04-01"),
        "status": "掲載許可",
    })

public.sort(key=lambda x: (x["area"], x["name"]))
with open("data.json", "w", encoding="utf-8") as f:
    json.dump(public, f, ensure_ascii=False, indent=2)
    f.write("\n")

print(f"Published providers: {len(public)}")
