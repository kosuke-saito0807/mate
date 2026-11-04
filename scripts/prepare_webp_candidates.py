#!/usr/bin/env python3
"""Create review-only WebP candidates for large MATE photos.

No HTML is modified; existing hero/scene pictures remain untouched until
desktop/mobile screenshot diffs and Core Web Vitals are checked.
Usage: python -m pip install pillow
       python scripts/prepare_webp_candidates.py
Outputs into artifacts/webp-candidates (not deployed).
"""
from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]
TARGET = ROOT / "artifacts" / "webp-candidates"
SOURCE_DIRS = [ROOT / "assets", ROOT / "spark" / "assets"]
MIN_BYTES = 400_000

def main():
    try:
        from PIL import Image, ImageOps
    except ImportError as exc:
        raise SystemExit("Pillow is required: pip install pillow") from exc
    TARGET.mkdir(parents=True, exist_ok=True)
    report = []
    for folder in SOURCE_DIRS:
        if not folder.exists():
            continue
        for p in folder.rglob("*"):
            if not p.is_file() or p.suffix.lower() not in {".jpg",".jpeg",".png"}:
                continue
            if p.stat().st_size < MIN_BYTES:
                continue
            relative = p.relative_to(ROOT)
            dest = TARGET / relative.with_suffix(".webp")
            dest.parent.mkdir(parents=True,exist_ok=True)
            try:
                with Image.open(p) as image:
                    img=ImageOps.exif_transpose(image)
                    if img.mode not in {"RGB","RGBA"}:
                        img=img.convert("RGBA" if "A" in img.mode else "RGB")
                    img.save(dest, "WEBP", quality=82, method=6)
                original=p.stat().st_size
                optimized=dest.stat().st_size
                report.append({"source":str(relative),"candidate":str(dest.relative_to(ROOT)),
                               "originalBytes":original,"candidateBytes":optimized,
                               "savingPct":round((original-optimized)*100/original,1),
                               "recommendReview":optimized<original})
            except Exception as exc:
                report.append({"source":str(relative),"error":str(exc)})
    manifest=TARGET/"manifest.json"
    manifest.write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(f"Reviewed {len(report)} candidates. Report: {manifest}")
    print("NO original files, deployment, or HTML references were changed.")

if __name__=="__main__":
    main()
