#!/usr/bin/env python3
"""Package approved free Pexels photos as same-origin CARE assets.

Run only during static-site build, never in a browser or for a user form.
The original photo pages and license are documented in docs/care-photo-credits.md.
No tracking URLs appear in the published CARE HTML.
"""
from __future__ import annotations
import html
import pathlib
import urllib.request

ROOT=pathlib.Path(__file__).resolve().parents[1]
SITE=ROOT/"_site"
SOURCES={
    "urgent": "5691816",
    "pickup": "7971448",
    "sick": "8376257",
}

def main():
    index=SITE/"index.html"
    if not index.is_file():
        raise SystemExit("Expected packaged _site/index.html, not repository source.")
    data=index.read_text(encoding="utf-8")
    (SITE/"assets").mkdir(parents=True,exist_ok=True)
    for name,photo_id in SOURCES.items():
        url=f"https://images.pexels.com/photos/{photo_id}/pexels-photo-{photo_id}.jpeg?auto=compress&cs=tinysrgb&w=960"
        tag=html.escape(url,quote=True)
        path=f"assets/care-scene-{name}-photo.jpg"
        if tag not in data or f'data-published-asset="{path}"' not in data:
            raise SystemExit(f"CARE image {name} source marker missing from published HTML")
        req=urllib.request.Request(url,headers={"User-Agent":"Mozilla/5.0 MATE-CARE-StaticPublisher/1.0","Accept":"image/jpeg,*/*"})
        with urllib.request.urlopen(req,timeout=35) as response:
            binary=response.read(2_500_000)
        if len(binary)<10_000 or binary[:2]!=b"\xff\xd8":
            raise SystemExit(f"Invalid CARE JPEG source {name} ({len(binary)} bytes)")
        (SITE/path).write_bytes(binary)
        data=data.replace(tag,path)
        print(f"Packaged first-party {path}, {len(binary):,} bytes")
    index.write_text(data,encoding="utf-8")
    assert "images.pexels.com" not in data, "External photo URLs must not remain in published CARE HTML"

if __name__=="__main__":
    main()
