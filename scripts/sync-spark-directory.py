#!/usr/bin/env python3
"""Synchronize the SPARK crawlable directory from the separate editorial JSON.

These are independent, UNAPPROVED references to public official pages, not
approved MATE partner listings. The script never reads or publishes private DB.
Run before CI SEO checks, Firebase publication and GitHub Pages packaging.
"""
from __future__ import annotations
import html
import json
import re
from collections import Counter
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "spark/editorial-schools.json"
TARGET = ROOT / "spark/school-directory.html"


def esc(value: object) -> str:
    return html.escape(str(value or ""), quote=True)


def validated() -> list[dict]:
    records = json.loads(SOURCE.read_text(encoding="utf-8"))
    if not isinstance(records, list):
        raise ValueError("SPARK editorial source must be a list")
    seen = set()
    approved = []
    for item in records:
        if not isinstance(item, dict):
            continue
        if item.get("editorial") is not True or item.get("approved") is not False:
            continue
        url = urlsplit(str(item.get("url", "")))
        source = urlsplit(str(item.get("source", "")))
        if (
            url.scheme != "https" or not url.hostname or url.username or url.password
            or source.scheme != "https" or not source.hostname or source.username or source.password
            or not all(str(item.get(k, "")).strip() for k in ("id", "name", "region", "category", "description"))
        ):
            continue
        identifier = str(item["id"])
        if not re.fullmatch(r"editorial-[A-Za-z0-9_-]{2,90}", identifier):
            raise ValueError("Invalid public reference ID: " + identifier)
        if identifier in seen:
            raise ValueError("Duplicate SPARK reference ID: " + identifier)
        seen.add(identifier)
        approved.append(item)
    if not approved:
        raise ValueError("Refuse to publish empty SPARK reference directory")
    return approved


def replace_marked(text: str, name: str, fragment: str) -> str:
    start = f"<!-- {name}:begin -->"
    end = f"<!-- {name}:end -->"
    if text.count(start) != 1 or text.count(end) != 1:
        raise ValueError("Directory template marker missing: " + name)
    left, remaining = text.split(start, 1)
    _, right = remaining.split(end, 1)
    return left + start + fragment + end + right


def build() -> int:
    entries = validated()
    counts = Counter(entry["category"] for entry in entries)
    categories = sorted(counts, key=lambda label: (-counts[label], label))
    links = "".join(
        f'<a href="#cat-{i}">{esc(category)} <small>{counts[category]}件</small></a>\n'
        for i, category in enumerate(categories, 1)
    )
    groups = []
    for i, category in enumerate(categories, 1):
        cards = []
        for entry in entries:
            if entry["category"] != category:
                continue
            official = esc(entry["url"])
            src = esc(entry["source"])
            evidence = (
                f'<a class="evidence" href="{src}" target="_blank" rel="noopener noreferrer">情報の出典を見る</a>'
                if src != official else ""
            )
            cards.append(
                f'<article class="provider" id="{esc(entry["id"])}">'
                f'<h3>{esc(entry["name"])}</h3>'
                f'<p class="meta">{esc(entry["region"])} ・ {esc(category)}</p>'
                f'<p>{esc(entry["description"])}</p>'
                '<p class="source">編集部の参考情報（事業者未承認）</p>'
                f'<a href="{official}" target="_blank" rel="noopener noreferrer">事業者の公式サイトで確認 ↗</a>{evidence}'
                '</article>'
            )
        groups.append(
            f'<section class="group" id="cat-{i}" aria-labelledby="heading-{i}">'
            f'<h2 id="heading-{i}">{esc(category)} <small>{counts[category]}件</small></h2>'
            f'<div class="cards">{"".join(cards)}</div></section>'
        )
    page = TARGET.read_text(encoding="utf-8")
    page = replace_marked(page, "categories", links)
    page = replace_marked(page, "directory", "\n".join(groups))
    page, matches = re.subn(
        r'(<strong id="directory-count">)\d+(</strong>)',
        lambda m: m.group(1) + str(len(entries)) + m.group(2),
        page, count=1,
    )
    if matches != 1:
        raise ValueError("SPARK directory count marker missing")
    pattern = r'(<script type="application/ld\+json" id="directory-jsonld">)(.*?)(</script>)'
    match = re.search(pattern, page, re.S)
    if not match:
        raise ValueError("Directory schema marker missing")
    schema = json.loads(match.group(2))
    nodes = schema["@graph"]
    item_list = next(node for node in nodes if node.get("@type") == "ItemList")
    item_list["numberOfItems"] = len(entries)
    item_list["itemListElement"] = [
        {"@type": "ListItem", "position": i, "name": entry["name"], "url": entry["url"]}
        for i, entry in enumerate(entries, 1)
    ]
    page_node = next(node for node in nodes if node.get("@type") == "CollectionPage")
    dates = [entry.get("reviewedAt", "") for entry in entries if re.fullmatch(r"\d{4}-\d{2}-\d{2}", str(entry.get("reviewedAt", "")))]
    if dates:
        page_node["dateModified"] = max(dates)
    serialized = json.dumps(schema, ensure_ascii=False, separators=(",", ":")).replace("<", r"\u003c")
    page = page[:match.start(2)] + serialized + page[match.end(2):]
    if page.count('class="provider"') != len(entries):
        raise ValueError("Generated record count differs from source")
    TARGET.write_text(page, encoding="utf-8")
    print(f"SPARK crawlable directory ready: {len(entries)} independent official references, {len(categories)} genres")
    return len(entries)


if __name__ == "__main__":
    build()
