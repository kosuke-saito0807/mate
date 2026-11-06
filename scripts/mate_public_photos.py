"""MATE public listing photo serializer. Never expose reviewer notes or applicant PII."""
from __future__ import annotations
import re
from urllib.parse import urlsplit

IMAGE_HEADERS=("申請ID","サービス","画像URL1","画像URL2","画像URL3","画像URL4","画像URL5","画像掲載権限の申告","画像審査状態")
_ALLOWED=re.compile(r"\.(?:jpg|jpeg|png|webp|avif)$",re.I)

def safe_image_url(value):
    if not isinstance(value,str) or len(value)>450 or any(ch.isspace() for ch in value):
        return False
    try:
        u=urlsplit(value)
        if u.scheme!="https" or not u.hostname or "." not in u.hostname:
            return False
        if u.username or u.password or u.port not in (None,443):
            return False
        if not _ALLOWED.search(u.path) or u.fragment or len(u.query)>150:
            return False
        if u.hostname.lower().endswith((".local",".internal")) or u.hostname in ("127.0.0.1","localhost"):
            return False
        return True
    except ValueError:
        return False

def public_photos(public_id, service, records, category, media_map=None):
    """Return safe published images only when independently reviewed as licensed."""
    key="fallback-"+service.lower()
    raw=re.sub(r"\s+","-",str(category or "").strip().lower())
    if raw:
        key += "-"+raw[:50]
    result={"images":[],"thumbnail":None,"fallbackImageKey":key}
    if not records:
        return result
    rows=[r for r in records if str(r.get("申請ID") or "").strip()==public_id and
          str(r.get("サービス") or "").strip()==service]
    # The sheet is keyed by application ID (not public ID). Exporters pass the
    # immutable application ID from the signed publisher source.
    if len(rows)!=1:return result
    r=rows[0]
    images=[str(r.get("画像URL"+str(i)) or "").strip() for i in range(1,6)]
    images=[u for u in images if u]
    if not images:return result
    media_map=media_map or {}
    if (r.get("画像掲載権限の申告")!="掲載権限あり" or
        r.get("画像審査状態")!="確認済み" or
        len(set(images))!=len(images)):
        return result
    resolved=[media_map.get(u,u) for u in images]
    for original,final in zip(images,resolved):
        if original.startswith("DRIVE:"):
            if original not in media_map or not re.fullmatch(
                r"/(?:assets/partner-media/(?:care|spark)|partner-media/play)/[0-9a-f-]{36}/[0-9]{2}-[0-9a-f]{16}\.jpg",
                final):
                return result
        elif not safe_image_url(final):
            return result
    result["images"]=resolved
    result["thumbnail"]=resolved[0]
    return result
