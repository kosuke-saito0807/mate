#!/usr/bin/env python3
import json, os, urllib.request

SHEET_ID = os.environ.get("SMARTSHEET_SHEET_ID", "2878110904307588")
TOKEN = os.environ["SMARTSHEET_ACCESS_TOKEN"]
req = urllib.request.Request(
    f"https://api.smartsheet.com/2.0/sheets/{SHEET_ID}",
    headers={
        "Authorization": f"Bearer {TOKEN}",
        "Accept": "application/json",
        "smartsheet-integration-source": "SCRIPT,MATE,MATE-GitHub-Sync",
    },
)
with urllib.request.urlopen(req, timeout=30) as resp:
    sheet = json.load(resp)
cols = {c["id"]: c["title"] for c in sheet.get("columns", [])}
public = []
for row in sheet.get("rows", []):
    v = {cols[c["columnId"]]: c.get("value") if c.get("value") is not None else c.get("displayValue", "")
         for c in row.get("cells", []) if c.get("columnId") in cols}
    if v.get("掲載許可") != "許可":
        continue
    official = str(v.get("公式サイト") or "").strip()
    if not official:
        continue
    public.append({
        "id": str(v.get("ID") or row.get("id")),
        "name": str(v.get("事業者名") or "").strip(),
        "area": str(v.get("エリア") or "").strip(),
        "facility_no": str(v.get("東京都施設番号") or "").strip(),
        "official_url": official,
        "verified": True,
        "data_as_of": str(v.get("公開一覧掲載基準日") or "2026-04-01"),
        "status": "掲載許可",
    })
public.sort(key=lambda x: (x["area"], x["name"]))
with open("data.json", "w", encoding="utf-8") as f:
    json.dump(public, f, ensure_ascii=False, indent=2)
    f.write("\n")
print(f"Published providers: {len(public)}")
