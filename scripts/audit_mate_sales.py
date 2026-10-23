#!/usr/bin/env python3
"""Read-only, privacy-preserving readiness monitor for MATE's existing private CRM.

NEVER drafts or sends email, changes CRM rows, assumes site permission, or logs lead PII.
"""
from __future__ import annotations

import datetime as dt
import json
import os
from collections import Counter
from pathlib import Path
from zoneinfo import ZoneInfo

SERVICES=("CARE","SPARK","PLAY")
KEY="1CLJeXuznctRtH8Y3AMZ2XyOu3dQedmh9obBDrPlIEuQ"
FRESH_DAYS=14


def rows_by_header(values):
    if not values:
        return []
    headers=[str(x).strip() for x in values[0]]
    return [{key:str(row[i]).strip() if i<len(row) else ""
             for i,key in enumerate(headers) if key}
            for row in values[1:] if any(str(v).strip() for v in row)]


def summarize(master,queue,inquiries,contracts,today):
    result={
        "dateJST":today.isoformat(),
        "mode":"read_only_no_send",
        "services":{s:{"candidates":0,"publishedConsentClaims":0,"contactFresh":0,
                         "contactStaleOrMissing":0,"draftApproved":0,
                         "sendApprovedInQueue":0,"sentInQueue":0}
                    for s in SERVICES},
        "inquiryProgress":{},
        "inquiriesPending":0,
        "activeWrittenContracts":0,
        "safety":{"outboundAutomationEnabled":False,"autoSendPerformed":False}
    }
    for row in master:
        service=row.get("サービス","")
        if service not in SERVICES:
            continue
        x=result["services"][service];x["candidates"]+=1
        if row.get("掲載許諾") in ("許可","許諾済","承諾済"):
            x["publishedConsentClaims"]+=1
        # No website content is fetched or guessed here; this is freshness of an
        # existing review date only, not a legal permission to contact anyone.
        try:
            checked=dt.date.fromisoformat(row.get("確認日",""))
        except ValueError:
            checked=None
        if checked and 0 <= (today-checked).days <= FRESH_DAYS:
            x["contactFresh"]+=1
        else:
            x["contactStaleOrMissing"]+=1
        if row.get("送信承認","").lower() in ("true","はい","承認"):
            x["draftApproved"]+=1
    for row in queue:
        service=row.get("サービス","")
        if service not in SERVICES:
            continue
        x=result["services"][service]
        if row.get("実送信承認","").lower() in ("true","承認","はい") and row.get("承認ハッシュ"):
            x["sendApprovedInQueue"]+=1
        if row.get("状態") in ("送信済","SENT"):
            x["sentInQueue"]+=1
    counts=Counter(row.get("進捗") or "空欄" for row in inquiries)
    result["inquiryProgress"]=dict(sorted(counts.items()))
    result["inquiriesPending"]=sum(counts.get(x,0) for x in ("受付","確認","教室へ取次","結果確認"))
    for row in contracts:
        if row.get("状態") in ("有効","掲載中") and row.get("契約ID") and row.get("掲載先ID"):
            result["activeWrittenContracts"]+=1
    return result


def main():
    import gspread
    from google.oauth2.service_account import Credentials
    secret=os.environ.get("GOOGLE_SERVICE_ACCOUNT_JSON")
    if not secret:
        raise SystemExit("Missing existing read-only Google Sheets credential")
    creds=Credentials.from_service_account_info(
        json.loads(secret),scopes=["https://www.googleapis.com/auth/spreadsheets.readonly"])
    book=gspread.authorize(creds).open_by_key(os.getenv("GOOGLE_SHEETS_ID",KEY))
    tabs={
        "master":"3サービス営業リスト",
        "queue":"自動営業キューV3",
        "inquiries":"問い合わせ管理",
        "contracts":"掲載契約"
    }
    raw={key:rows_by_header(book.worksheet(tab).get_all_values())
         for key,tab in tabs.items()}
    today=dt.datetime.now(ZoneInfo("Asia/Tokyo")).date()
    report=summarize(raw["master"],raw["queue"],raw["inquiries"],raw["contracts"],today)
    out=Path("artifacts/sales-readiness");out.mkdir(parents=True,exist_ok=True)
    (out/"aggregate-only.json").write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",
                                           encoding="utf-8")
    lines=["## MATE営業 運用準備（機密連絡先非表示）",
           f"実行日（JST）: {today.isoformat()} / 読み取り専用、**送信なし**",
           "| サービス | 営業候補 | 確認日14日以内 | 要再確認 | 下書き承認 | キュー実送信承認 | 送信済キュー |",
           "|---|---:|---:|---:|---:|---:|---:|"]
    for key in SERVICES:
        x=report["services"][key]
        lines.append(f"| {key} | {x['candidates']} | {x['contactFresh']} | "
                     f"{x['contactStaleOrMissing']} | {x['draftApproved']} | "
                     f"{x['sendApprovedInQueue']} | {x['sentInQueue']} |")
    lines.extend([f"対応待ち問い合わせ（CRM記録上）: {report['inquiriesPending']} 件",
                  f"有効契約の台帳記載（全サービス合計）: {report['activeWrittenContracts']} 件",
                  "※ 連絡先の確認日が新しくても、受信同意・営業連絡の法的適否・サイト掲載許諾が確認された意味ではありません。",
                  "※ PLAYは独立CMS。閲覧・編集・公開権限はこのCRMでは証明できません。",
                  "※ 自動メール送信はこのワークフローにはなく、Apps Script V3の個別承認と所有者側設定が必要です。"])
    summary="\n".join(lines)+"\n"
    print("MATE_SALES_READ_ONLY_COUNTS "+json.dumps({
        "dateJST":report["dateJST"],"services":report["services"],
        "inquiriesPending":report["inquiriesPending"],
        "activeWrittenContracts":report["activeWrittenContracts"]},ensure_ascii=False))
    if os.getenv("GITHUB_STEP_SUMMARY"):
        with open(os.environ["GITHUB_STEP_SUMMARY"],"a",encoding="utf-8") as f:
            f.write(summary)
    else:
        print(summary)


if __name__=="__main__":
    main()
