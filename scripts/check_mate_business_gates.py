#!/usr/bin/env python3
"""Read-only check of listing, contract, invoice and outbound evidence gates.

This script never emails, approves, publishes, contracts, bills, or writes Sheets.
Only anonymous counts and rule names are printed. Does not inspect GAS properties.
"""
from __future__ import annotations
import json
import os
import re
from collections import Counter

SHEET_ID = "1CLJeXuznctRtH8Y3AMZ2XyOu3dQedmh9obBDrPlIEuQ"
SHEETS = {
    "applications": "掲載セルフ申請",
    "contracts": "掲載契約",
    "approval": "掲載公開承認V1_運営専用",
    "paid": "有料掲載申込・請求V1",
    "sendlog": "営業送信ログV4",
    "outreach": "自動営業キューV3",
}
ACTIVE = {"有効", "掲載中", "契約成立", "成約"}
APPROVED = {"承認", "掲載承認", "公開", "公開済み", "承認済み"}
YES = {"はい", "確認済み", "同意", "同意済み", "承認", "true", "yes", "on"}
TEST = re.compile(r"テスト|ダミー|架空|非公開|内部接続|あああ|sample|dummy|\be2e\b", re.I)


def records(values):
    if not values:
        raise ValueError("missing header")
    headers = [str(c).strip() for c in values[0]]
    if not headers or len(headers) != len(set(headers)):
        raise ValueError("missing or duplicate columns")
    return [{h: str(row[i]).strip() if i < len(row) else ""
             for i, h in enumerate(headers) if h}
            for row in values[1:] if any(str(c).strip() for c in row)]


def analyse(data):
    issues = Counter()
    counts = Counter()
    apps = data["applications"]
    contracts = data["contracts"]
    approvals = data["approval"]
    paid = data["paid"]
    sendlog = data["sendlog"]
    outreach = data["outreach"]
    counts["applications"] = len(apps)
    counts["contracts"] = len(contracts)
    counts["paid_requests"] = len(paid)
    counts["outreach_log_rows"] = len(sendlog)
    counts["approved_applications"] = 0
    counts["approved_publication_rows"] = 0

    contracts_by_id = {}
    for c in contracts:
        public_id = c.get("掲載先ID", "")
        active = c.get("状態", "") in ACTIVE
        if active:
            counts["active_contracts"] += 1
            if not all(c.get(x) for x in ("契約ID", "掲載先ID", "同意者", "同意日時", "合意証拠URL・メールID")):
                issues["active_contract_missing_evidence"] += 1
        if public_id and active and all(c.get(x) for x in ("契約ID", "同意者", "同意日時", "合意証拠URL・メールID")):
            contracts_by_id[public_id] = c

    for app in apps:
        if app.get("審査状態", "") not in APPROVED:
            continue
        counts["approved_applications"] += 1
        if TEST.search(app.get("教室・事業者名", "") + " " + app.get("紹介文", "") + " " +
                       app.get("保留・差戻し理由", "")):
            issues["test_application_approved"] += 1
        if app.get("担当者権限の確認") != "確認済み" or not app.get("審査者") or not app.get("公開ID"):
            issues["approved_application_missing_authority_or_id"] += 1
        if not app.get("掲載申請の意思"):
            issues["approved_application_missing_intent"] += 1
        if app.get("公開ID") not in contracts_by_id:
            issues["approved_application_no_evidence_contract"] += 1

    for a in approvals:
        action = a.get("操作", "")
        finished = a.get("進捗", "") in {"完了", "公開済み", "通知済み"}
        if action not in APPROVED and action != "掲載承認" and not finished:
            continue
        counts["approved_publication_rows"] += 1
        if TEST.search(a.get("事業者名", "") + " " + a.get("備考", "")):
            issues["test_publication_approved"] += 1
        if not all(a.get(x) for x in ("権限確認証跡", "審査担当者", "公開用ID")):
            issues["publication_missing_evidence"] += 1
        if finished and not a.get("公開URL"):
            issues["completed_publication_missing_url"] += 1

    for p in paid:
        state = p.get("有料契約状態", "")
        sent = p.get("請求書送付状態", "")
        is_charge = state in ACTIVE or p.get("有料掲載可否") in YES or sent in {"送付済", "送信済"}
        if not is_charge:
            continue
        counts["paid_or_billed_rows"] += 1
        if p.get("明示同意") not in YES or p.get("MATE承諾") not in YES or not p.get("申請ID") or not p.get("条件版"):
            issues["paid_without_explicit_bilateral_consent"] += 1
        try:
            amount = float(str(p.get("税込金額", "")).replace(",", ""))
        except ValueError:
            amount = 0
        if amount <= 0:
            issues["paid_without_valid_amount"] += 1

    for row in sendlog:
        if row.get("状態") in {"送信済", "SENT", "送信成功"}:
            counts["logged_outbound_sent"] += 1
            if not row.get("送信根拠") or not row.get("根拠URL"):
                issues["outbound_sent_without_evidence"] += 1
    for row in outreach:
        if row.get("実送信承認", "").strip().lower() in {"true", "はい", "承認"} and not row.get("承認ハッシュ"):
            issues["outbound_approval_missing_hash"] += 1

    return {
        "mode": "read_only",
        "counts": dict(sorted(counts.items())),
        "alerts": dict(sorted(issues.items())),
        "sourceLimitations": [
            "Apps Script script properties and real email sending switch are not inspected",
            "A successful review does not grant publication, outreach, contract, or billing permission",
            "This audit does not create or validate real provider consent",
        ],
    }


def main():
    import gspread
    from google.oauth2.service_account import Credentials
    raw = os.environ.get("GOOGLE_SERVICE_ACCOUNT_JSON", "")
    if not raw:
        raise SystemExit("Missing read-only Google Sheets service account")
    creds = Credentials.from_service_account_info(
        json.loads(raw), scopes=["https://www.googleapis.com/auth/spreadsheets.readonly"]
    )
    book = gspread.authorize(creds).open_by_key(os.environ.get("GOOGLE_SHEETS_ID", SHEET_ID))
    data = {key: records(book.worksheet(name).get_all_values())
            for key, name in SHEETS.items()}
    report = analyse(data)
    print("MATE_BUSINESS_GATES_ANONYMOUS " + json.dumps(report, ensure_ascii=False, sort_keys=True))
    if report["alerts"]:
        raise SystemExit("BLOCKED: one or more safety gates require owner review")
    print("PASS: no evidence of an unsafe approval, publication, outbound log, or paid request in inspected Sheets")


if __name__ == "__main__":
    main()
