import csv, json, os

INPUT = os.environ.get("CRM_CSV", "crm.csv")
OUTPUT = os.environ.get("PUBLIC_JSON", "data.json")

PUBLIC_STATUS = "掲載許可"
PUBLIC_PERMISSION = "許可"

with open(INPUT, "r", encoding="utf-8-sig", newline="") as f:
    rows = list(csv.DictReader(f))

public = []
for row in rows:
    status = (row.get("MATE掲載ステータス") or "").strip()
    permission = (row.get("掲載許可") or "").strip()
    url = (row.get("公式サイト") or "").strip()
    if status != PUBLIC_STATUS or permission != PUBLIC_PERMISSION or not url:
        continue
    public.append({
        "id": (row.get("ID") or "").strip(),
        "name": (row.get("事業者名") or "").strip(),
        "area": (row.get("エリア") or "").strip(),
        "facility_no": (row.get("東京都施設番号") or "").strip(),
        "official_url": url,
        "verified": True,
        "data_as_of": (row.get("公開一覧掲載基準日") or "").strip(),
        "status": status
    })

public.sort(key=lambda x: (x["area"], x["name"]))
with open(OUTPUT, "w", encoding="utf-8") as f:
    json.dump(public, f, ensure_ascii=False, indent=2)
    f.write("\n")
print(f"Public providers: {len(public)} / CRM rows: {len(rows)}")
