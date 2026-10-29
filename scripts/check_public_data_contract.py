#!/usr/bin/env python3
"""Validate ONLY public CARE/SPARK datasets. No credentials, emails, CRM or network access."""
import datetime as dt
import json
import re
from pathlib import Path
from urllib.parse import urlsplit

ROOT=Path(__file__).resolve().parents[1]
BLOCKED={"email","e-mail","mail","phone","telephone","tel","contactemail","contact_email","guardian","submission_id","consentproof","consent_proof","consent_evidence","gmail","token","password","secret","担当者","連絡先","保護者","同意証拠","gmailメッセージid"}

class PublicDataError(ValueError): pass

def public_url(raw):
    if not isinstance(raw,str) or len(raw)>1000 or re.search(r"\s",raw):return False
    try:
        p=urlsplit(raw)
        return p.scheme=="https" and bool(p.hostname) and "." in p.hostname and not p.username and not p.password
    except ValueError:return False

def check_rows(rows,service):
    if not isinstance(rows,list):raise PublicDataError(f"{service}: expected array")
    seen=set()
    for i,row in enumerate(rows):
        if not isinstance(row,dict):raise PublicDataError(f"{service} row {i}: invalid record")
        fields={str(k).lower().replace("-","").replace(" ","") for k in row}
        if any(any(blocked in k for blocked in BLOCKED) for k in fields):
            raise PublicDataError(f"{service} row {i}: private field in public JSON")
        ident=row.get("id")
        if not isinstance(ident,str) or not 1<=len(ident)<=120 or ident in seen:
            raise PublicDataError(f"{service} row {i}: missing/duplicate ID")
        seen.add(ident)
        if row.get("demo") or ident.startswith(("demo-","qa_unit_test")):
            raise PublicDataError(f"{service} row {i}: demo or QA record leaked to public")
        if not isinstance(row.get("name"),str) or not row["name"].strip():
            raise PublicDataError(f"{service} row {i}: no name")
        if service=="CARE":
            if row.get("verified") is not True or row.get("status")!="掲載許可" or not public_url(row.get("official_url")):
                raise PublicDataError(f"CARE row {i}: approval/HTTPS gate failed")
            verified=row.get("verified_at")
        else:
            if row.get("approved") is not True or not public_url(row.get("url")):
                raise PublicDataError(f"SPARK row {i}: approval/HTTPS gate failed")
            verified=row.get("verifiedAt")
        try:
            day=dt.date.fromisoformat(verified)
            if day>dt.datetime.now(dt.timezone(dt.timedelta(hours=9))).date():
                raise ValueError("future verification date")
        except (ValueError,TypeError):
            raise PublicDataError(f"{service} row {i}: invalid verification date")
        if any("@" in str(v) for v in row.values() if isinstance(v,str)):
            raise PublicDataError(f"{service} row {i}: email-like value")
    return len(rows)

def check_demo(rows):
    if not isinstance(rows,list):raise PublicDataError("SPARK demo must be list")
    for row in rows:
        if not isinstance(row,dict) or row.get("demo") is not True or not str(row.get("id","")).startswith("demo-"):
            raise PublicDataError("SPARK demo dataset contains real or unmarked listing")
    return len(rows)

def main():
    care=json.loads((ROOT/"data.json").read_text(encoding="utf-8"))
    spark=json.loads((ROOT/"spark/schools.json").read_text(encoding="utf-8"))
    demo=json.loads((ROOT/"spark/demo-schools.json").read_text(encoding="utf-8"))
    counts={"CARE":check_rows(care,"CARE"),"SPARK":check_rows(spark,"SPARK"),"SPARK_DEMO_ONLY":check_demo(demo)}
    print("PUBLIC_DATA_CONTRACT_PASS",json.dumps(counts,ensure_ascii=False))

if __name__=="__main__":main()
