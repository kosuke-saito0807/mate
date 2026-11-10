"""Publish *approved* MATE applicant photos from private Drive as static JPGs.
No public read of Drive IDs; missing credentials/photos yield category fallbacks.
Caller MUST provide only applicant IDs that have an approved, active listing.
"""
from __future__ import annotations
import hashlib
import os
import re
from pathlib import Path

DRIVE_ID=re.compile(r"^DRIVE:([A-Za-z0-9_-]{20,128})$")
APP_ID=re.compile(r"^MATE-WEB-([0-9a-f-]{36})$",re.I)

def sync_approved_media(records, allowed_ids, service, destination, url_prefix, credentials):
    """Materialize private JPG assets and return map DRIVE:id -> static URL.
    Does not authorize anything: the publisher supplies allowlisted IDs.
    """
    folder=Path(destination)
    approved=set(allowed_ids)
    mapping={}
    expected_photos=0
    attempted_downloads=0
    failed_downloads=0
    failed_reasons={}
    def hold(reason):
        failed_reasons[reason]=failed_reasons.get(reason,0)+1
    # Even after all approvals are withdrawn, remove only previously generated
    # photo assets. They must not remain reachable by their old public URLs.
    if not approved:
        _prune_generated_media(folder, set())
        return mapping
    session=None
    for record in records:
        aid=str(record.get("申請ID") or "").strip()
        m=APP_ID.fullmatch(aid)
        if not m or aid not in approved or record.get("サービス")!=service:
            continue
        if record.get("画像審査状態")!="確認済み" or record.get("画像掲載権限の申告")!="掲載権限あり":
            continue
        urls=[str(record.get(f"画像URL{i}") or "").strip() for i in range(1,6)]
        if not any(urls):continue
        expected_photos+=sum(bool(item) for item in urls)
        if len(set(u for u in urls if u))!=len([u for u in urls if u]):continue
        for n,raw in enumerate(urls,1):
            photo=DRIVE_ID.fullmatch(raw)
            if not photo:continue
            if session is None:
                from google.auth.transport.requests import AuthorizedSession
                session=AuthorizedSession(credentials)
            file_id=photo.group(1)
            attempted_downloads+=1
            try:
                meta=session.get(
                  "https://www.googleapis.com/drive/v3/files/"+file_id,
                  params={"fields":"id,mimeType,size,trashed"},timeout=12)
                if meta.status_code!=200:
                    hold("metadata_http_"+str(meta.status_code));continue
                info=meta.json()
                if info.get("trashed"):
                    hold("trashed");continue
                if info.get("mimeType")!="image/jpeg":
                    hold("wrong_mime");continue
                if int(info.get("size") or 0)>240000:
                    hold("too_large");continue
                response=session.get(
                  "https://www.googleapis.com/drive/v3/files/"+file_id,
                  params={"alt":"media"},timeout=20)
                if response.status_code!=200:
                    hold("download_http_"+str(response.status_code));continue
                blob=response.content
                if not (64<=len(blob)<=240000 and blob[:3]==b"\xff\xd8\xff" and blob[-2:]==b"\xff\xd9"):
                    continue
                digest=hashlib.sha256(blob).hexdigest()[:16]
                name=f"{n:02d}-{digest}.jpg"
                relative=Path(m.group(1).lower())/name
                target=folder/relative
                target.parent.mkdir(parents=True,exist_ok=True)
                if not target.exists() or target.read_bytes()!=blob:
                    tmp=target.with_suffix(".tmp")
                    tmp.write_bytes(blob)
                    os.replace(tmp,target)
                mapping[raw]=url_prefix.rstrip("/")+"/"+relative.as_posix()
            except Exception:
                # Report only counts; never expose Drive IDs, applicant details,
                # auth tokens, filenames or sensitive service-account errors.
                failed_downloads+=1
                hold("transfer_exception")
                continue
    if expected_photos:
        print(f"MATE {service} approved private media: reviewed={expected_photos}, "
              f"downloads_attempted={attempted_downloads}, public_assets={len(mapping)}, "
              f"transfer_exceptions={failed_downloads}, failure_reasons={dict(sorted(failed_reasons.items()))}")
        if len(mapping)<expected_photos:
            print("WARNING: approved photos are absent from public assets. "
                  "Check the publish service account's Drive folder viewer role, "
                  "the file MIME/size and the media-ledger review status; "
                  "the listing will use category fallback until fixed.")
    _prune_generated_media(folder, set(mapping.values()), url_prefix)
    return mapping

def _prune_generated_media(folder, expected_urls, url_prefix=""):
    """Delete obsolete generated JPEGs only, never operator-uploaded source files.

    The publishing job must first derive expected media from currently approved,
    licensed records. Any former public JPEG outside that set is revoked.
    """
    if not folder.exists():
        return
    expected={u[len(url_prefix.rstrip("/"))+1:] for u in expected_urls
              if url_prefix and u.startswith(url_prefix.rstrip("/")+"/")}
    for file in folder.glob("*/*.jpg"):
        rel=file.relative_to(folder).as_posix()
        if not re.fullmatch(r"[0-9a-f-]{36}/[0-9]{2}-[0-9a-f]{16}\.jpg", rel):
            continue
        if rel not in expected:
            file.unlink()
    for child in folder.iterdir():
        if child.is_dir() and not any(child.iterdir()) and re.fullmatch(r"[0-9a-f-]{36}",child.name):
            child.rmdir()
