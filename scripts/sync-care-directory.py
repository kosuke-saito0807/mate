#!/usr/bin/env python3
"""Synchronize the crawlable CARE directory with approved editorial reference JSON."""
import html
import json
import re
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "editorial-care.json"
TARGET = ROOT / "sitter-directory.html"

def official_url(raw):
    value = str(raw or "").strip()
    parsed = urlsplit(value)
    if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password:
        return ""
    return value

def main():
    records = json.loads(SOURCE.read_text(encoding="utf-8"))
    valid = []
    for entry in records:
        url = official_url(entry.get("url"))
        if entry.get("editorial") is not True or entry.get("approved") is not False or not url:
            continue
        valid.append((entry, url))
    def e(s):
        return html.escape(str(s or ""), quote=True)
    cards = "\n".join(
        '<article class="provider" id="{id}"><a class="directory-thumb" href="{url}" target="_blank" rel="noopener noreferrer" aria-label="{name}の公式サイトを開く">'\n        '<img src="assets/editorial-thumbnails/care/{id}.webp" alt="{name}の公式サイトトップページ" loading="lazy" decoding="async" onerror="this.hidden=true">'\n        '<span class="directory-thumb-title">{name}</span></a><h2>{name}</h2><p class="meta">{region} ・ {category}</p>'
        '<p>{description}</p><a href="{url}" target="_blank" rel="noopener noreferrer">公式サイトで詳細を見る ↗</a></article>'.format(
            id=e(entry["id"]), name=e(entry["name"]), region=e(entry.get("region")),
            category=e(entry.get("category")), description=e(entry.get("description")), url=e(url)
        ) for entry, url in valid
    )
    source = TARGET.read_text(encoding="utf-8")
    pattern = r'(<div class="list" id="directory">)[\s\S]*?(</div>\s*<p id="empty")'
    source, changes = re.subn(pattern, lambda m: m.group(1)+"\n"+cards+"\n"+m.group(2), source, count=1)
    if changes != 1:
        raise RuntimeError("Directory list anchor missing")
    pattern = r'公開情報による参考紹介：\d+件'
    source, changes = re.subn(pattern, f'公開情報による参考紹介：{len(valid)}件', source, count=1)
    if changes != 1:
        raise RuntimeError("Count anchor missing")
    pattern = r'(<script type="application/ld\+json">)([\s\S]*?)(</script>)'
    match = re.search(pattern, source)
    if not match:
        raise RuntimeError("JSON-LD anchor missing")
    structured = json.loads(match.group(2))
    listing = next(obj for obj in structured["@graph"] if obj["@type"] == "ItemList")
    listing["numberOfItems"] = len(valid)
    listing["itemListElement"] = [
        {"@type":"ListItem","position":index,"name":entry["name"],"url":url}
        for index,(entry,url) in enumerate(valid, start=1)
    ]
    source = source[:match.start(2)] + json.dumps(structured, ensure_ascii=False, separators=(",", ":")).replace("<", "\\u003c") + source[match.end(2):]
    TARGET.write_text(source, encoding="utf-8")
    print(f"Updated crawlable directory with {len(valid)} independent references")

if __name__ == "__main__":
    main()
