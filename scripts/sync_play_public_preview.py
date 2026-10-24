#!/usr/bin/env python3
"""MATE PLAY consent-verified publication STAGING export.

This does NOT publish to ChatGPT Sites, GitHub Pages or Firebase. It is an
allowlisted, read-only bridge until the original PLAY CMS can be migrated.
"""
from __future__ import annotations
import argparse
import datetime as dt
import json
import os
import re
from pathlib import Path
from urllib.parse import urlsplit

SHEET_ID = "1CLJeXuznctRtH8Y3AMZ2XyOu3dQedmh9obBDrPlIEuQ"
PREFECTURES = tuple("北海道 青森県 岩手県 宮城県 秋田県 山形県 福島県 茨城県 栃木県 群馬県 埼玉県 千葉県 東京都 神奈川県 新潟県 富山県 石川県 福井県 山梨県 長野県 岐阜県 静岡県 愛知県 三重県 滋賀県 京都府 大阪府 兵庫県 奈良県 和歌山県 鳥取県 島根県 岡山県 広島県 山口県 徳島県 香川県 愛媛県 高知県 福岡県 佐賀県 長崎県 熊本県 大分県 宮崎県 鹿児島県 沖縄県".split())
REQUIRED_APPS = {"申請ID","サービス","教室・事業者名","公式URL","都道府県","市区町村・対応エリア","ジャンル","紹介文","掲載申請の意思","審査状態","担当者権限の確認","審査者","公開ID","情報確認日"}
REQUIRED_CONTRACTS = {"契約ID","サービス","掲載先ID","同意者","同意日時","条件版","合意証拠URL・メールID","開始日","終了日","状態"}

def val(row, key):
    return str(row.get(key) or "").strip()

def dparse(raw):
    try: return dt.date.fromisoformat(raw)
    except ValueError: return None

def valid_url(url):
    try:
        u = urlsplit(url)
        return u.scheme == "https" and u.hostname and "." in u.hostname and not u.username and not u.password and len(url) < 1024 and not re.search(r"\s", url)
    except ValueError: return False

def amount(raw):
    s = raw.replace(",", "")
    if not re.fullmatch(r"\d{1,8}(?:\.0)?", s): return None
    v = int(float(s))
    return v if v <= 10_000_000 else None

def years(raw):
    if not re.fullmatch(r"\d{1,2}(?:\.0)?", raw): return None
    v = int(float(raw))
    return v if v <= 18 else None

def build_public(applications, contracts, today=None):
    """Safe PLAY staging fields, NEVER a direct replacement for old PLAY /api/schools."""
    today = today or dt.datetime.now(dt.timezone(dt.timedelta(hours=9))).date()
    active = {}
    for c in contracts:
        if val(c,"サービス") != "PLAY" or val(c,"状態") not in {"有効","掲載中"}: continue
        if not all(val(c,k) for k in ("契約ID","掲載先ID","同意者","同意日時","条件版","合意証拠URL・メールID")): continue
        start, end = dparse(val(c,"開始日")), dparse(val(c,"終了日"))
        if not start or not end or not start <= today <= end or not dparse(val(c,"同意日時")[:10]): continue
        key = val(c,"掲載先ID")
        if key in active: raise ValueError("Duplicate active PLAY contract")
        active[key] = c

    records = []
    seen = set()
    for a in applications:
        if val(a,"サービス") != "PLAY": continue
        pid = val(a,"公開ID")
        if not re.fullmatch(r"[A-Za-z0-9_-]{3,120}",pid): continue
        if pid in seen: raise ValueError("Duplicate PLAY public ID")
        seen.add(pid)
        if pid not in active or val(a,"審査状態") != "承認" or val(a,"担当者権限の確認") != "確認済み" or not val(a,"審査者") or not val(a,"掲載申請の意思"): continue
        date = dparse(val(a,"情報確認日"))
        if not date or date > today: continue
        name, url, prefecture, city, category, description = (val(a,k) for k in ("教室・事業者名","公式URL","都道府県","市区町村・対応エリア","ジャンル","紹介文"))
        if not name or not city or not category or len(description) < 25 or prefecture not in PREFECTURES or not valid_url(url): continue
        low, high, fee = years(val(a,"対象最少年齢")), years(val(a,"対象最高年齢")), amount(val(a,"体験料金（税込円）"))
        if low is None or high is None or high < low or fee is None: continue
        weekdays = [w for w in re.split(r"[,，、/・;\s]+",val(a,"曜日")) if w in "月火水木金土日"]
        tags = [t.strip() for t in re.split(r"[,，、;]+",val(a,"タグ")) if 0 < len(t.strip()) <= 24][:8]
        public = {"id":pid,"name":name[:160],"prefecture":prefecture,"city":city[:140],
                  "station":val(a,"最寄駅")[:100],"category":category[:70],"description":description[:500],
                  "ageMin":low,"ageMax":high,"trialFee":fee,"weekdays":sorted(set(weekdays),key="月火水木金土日".index),
                  "tags":tags,"website":url,"updatedAt":date.isoformat(),"slots":[],"trialReferralEnabled":False}
        monthly = amount(val(a,"月謝（税込円）"))
        if monthly is not None: public["monthlyFee"] = monthly
        # No PII, consent proof, email, Gmail message ID or synthetic live bookings.
        records.append(public)
    return sorted(records,key=lambda x:(x["prefecture"],x["name"],x["id"]))

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--preview", default="artifacts/play-public-preview.json")
    args=p.parse_args()
    secret=os.environ.get("GOOGLE_SERVICE_ACCOUNT_JSON")
    if not secret: raise SystemExit("Missing read-only GOOGLE_SERVICE_ACCOUNT_JSON")
    import gspread
    from google.oauth2.service_account import Credentials
    cred=Credentials.from_service_account_info(json.loads(secret),scopes=["https://www.googleapis.com/auth/spreadsheets.readonly"])
    book=gspread.authorize(cred).open_by_key(os.environ.get("GOOGLE_SHEETS_ID",SHEET_ID))
    a=book.worksheet("掲載セルフ申請");c=book.worksheet("掲載契約")
    if REQUIRED_APPS-set(a.row_values(1)) or REQUIRED_CONTRACTS-set(c.row_values(1)): raise ValueError("Sheet headers changed; fail closed")
    result=build_public(a.get_all_records(default_blank=""),c.get_all_records(default_blank=""))
    out=Path(args.preview)
    if str(out).startswith("play/") or str(out).startswith("spark/"): raise ValueError("Preview cannot overwrite live publication assets")
    out.parent.mkdir(parents=True,exist_ok=True)
    out.write_text(json.dumps({"schools":result,"status":"preview_only","automatic_live_publication":False},ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(json.dumps({"play_preview_approved_count":len(result),"live_published":False}))
if __name__=="__main__": main()
