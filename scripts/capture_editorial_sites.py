#!/usr/bin/env python3
"""Capture small, attributed previews of public operator home/service pages.

A successfully captured public site screenshot is the only artifact written.
When a page is inaccessible, the frontend shows a unique branded site tile
instead; we never create a misleading stock or synthetic "website screenshot".
No accounts, logins, private addresses or booking pages are accessed.
"""
from __future__ import annotations

import argparse
import ipaddress
import json
import os
import re
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlsplit

from PIL import Image, ImageOps
from playwright.sync_api import sync_playwright

ID_PATTERN = re.compile(r"^(?:editorial-[a-zA-Z0-9_-]{3,75}|mate_spark_[a-zA-Z0-9_-]{8,60})$")
MAX_AGE_FAILURE = 7 * 24 * 3600


def allowed_url(raw: object) -> str | None:
    if not isinstance(raw, str) or len(raw) > 1000:
        return None
    try:
        u = urlsplit(raw)
        host = (u.hostname or "").lower()
        if u.scheme != "https" or not host or u.username or u.password:
            return None
        if host in ("localhost", "localhost.localdomain") or host.endswith(".local"):
            return None
        try:
            if not ipaddress.ip_address(host).is_global:
                return None
        except ValueError:
            pass
        return raw
    except ValueError:
        return None


def read_attempts(path: Path) -> dict:
    try:
        x = json.loads(path.read_text(encoding="utf-8"))
        return x if isinstance(x, dict) else {}
    except (OSError, ValueError):
        return {}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--limit", type=int, default=140)
    parser.add_argument("--max-seconds", type=int, default=1050)
    args = parser.parse_args()
    records = json.loads(args.source.read_text(encoding="utf-8"))
    if not isinstance(records, list):
        raise SystemExit("Expected an editorial JSON array")
    args.output.mkdir(parents=True, exist_ok=True)
    failures_path = args.output / ".attempts.json"
    failures = read_attempts(failures_path)
    start = time.monotonic()
    now = int(time.time())
    completed = skipped = failed = 0

    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True, args=["--no-sandbox"])
        context = browser.new_context(
            viewport={"width": 880, "height": 505},
            device_scale_factor=1,
            locale="ja-JP",
            reduced_motion="reduce",
            is_mobile=False,
            ignore_https_errors=False,
        )
        for item in records:
            if completed + failed >= max(1, args.limit):
                break
            if time.monotonic() - start >= args.max_seconds:
                break
            if not isinstance(item, dict) or not ((item.get("editorial") is True and item.get("approved") is False) or (str(item.get("id", "")).startswith("mate_spark_") and item.get("approved") is True)):
                continue
            name = str(item.get("id", ""))
            target = args.output / (name + ".webp")
            url = allowed_url(item.get("url"))
            if not ID_PATTERN.fullmatch(name) or not url:
                skipped += 1
                continue
            if target.exists() and target.stat().st_size > 1200:
                skipped += 1
                continue
            attempt = failures.get(name, {})
            if isinstance(attempt, dict) and now - int(attempt.get("at", 0)) < MAX_AGE_FAILURE:
                skipped += 1
                continue
            page = context.new_page()
            temp = args.output / (name + ".temp.png")
            try:
                response = page.goto(url, wait_until="domcontentloaded", timeout=15500)
                if response is not None and response.status >= 400:
                    raise RuntimeError("HTTP " + str(response.status))
                if not allowed_url(page.url):
                    raise RuntimeError("Redirected off HTTPS/public domain")
                if any(x in page.url.lower() for x in ("/login", "/signin", "/account/", "/checkout")):
                    raise RuntimeError("Redirected to non-public page")
                page.wait_for_timeout(900)
                page.screenshot(path=str(temp), full_page=False, animations="disabled", timeout=8500)
                with Image.open(temp) as source:
                    photo = ImageOps.fit(source.convert("RGB"), (640, 368), method=Image.Resampling.LANCZOS)
                    photo.save(target, "WEBP", quality=72, method=5)
                if target.stat().st_size < 1200:
                    target.unlink(missing_ok=True)
                    raise RuntimeError("Empty screenshot")
                failures.pop(name, None)
                completed += 1
                print("CAPTURED", name, str(target), target.stat().st_size, flush=True)
            except Exception as exc:
                failed += 1
                failures[name] = {"at": now, "reason": str(exc)[:135]}
                print("SKIPPED", name, str(exc)[:135], flush=True)
            finally:
                page.close()
                temp.unlink(missing_ok=True)
        context.close()
        browser.close()

    failures_path.write_text(json.dumps(failures, ensure_ascii=False, sort_keys=True, indent=2) + "\n", encoding="utf-8")
    print("SUMMARY", json.dumps({"captured": completed, "skipped": skipped, "failed": failed, "source": str(args.source)}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
