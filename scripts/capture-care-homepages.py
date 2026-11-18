#!/usr/bin/env python3
"""Capture the top of each provider's own official homepage, without third-party screenshots.

Usage: python scripts/capture-care-homepages.py
The output is a provider-id-specific .webp, not a shared or fabricated stock tile.
"""
import asyncio
import io
import json
import ipaddress
from pathlib import Path
from urllib.parse import urlsplit
from PIL import Image
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets/editorial-thumbnails/care"
OUT.mkdir(parents=True, exist_ok=True)
MANIFEST = OUT / "homepage-manifest.json"

def homepage(value):
    try:
        p = urlsplit(value)
        if p.scheme != "https" or not p.hostname or p.username or p.password:
            return None
        host = p.hostname.lower()
        if host == "localhost" or host.endswith((".local", ".internal")):
            return None
        try:
            ipaddress.ip_address(host)
            return None
        except ValueError:
            pass
        return "https://" + host + "/"
    except (ValueError, TypeError):
        return None

def entries():
    sources = [ROOT / "editorial-care.json", ROOT / "data.json"]
    known = {}
    for file in sources:
        if not file.exists():
            continue
        data = json.loads(file.read_text(encoding="utf-8"))
        if isinstance(data, dict):
            data = data.get("providers", data.get("data", []))
        for item in data:
            key = str(item.get("id", ""))
            if not key or not all(c.isascii() and (c.isalnum() or c in "-_") for c in key):
                continue
            url = homepage(item.get("official_url") or item.get("url") or item.get("website"))
            if url:
                known[key] = url
    return known

async def capture(browser, semaphore, key, url, previous):
    dest = OUT / (key + ".webp")
    if previous.get(key) == url and dest.exists() and dest.stat().st_size > 3000:
        return True
    async with semaphore:
        context = await browser.new_context(viewport={"width": 1280, "height": 960}, device_scale_factor=1, locale="ja-JP", java_script_enabled=True, service_workers="block")
        page = await context.new_page()
        try:
            response = await page.goto(url, wait_until="domcontentloaded", timeout=20000)
            if not response or response.status >= 400:
                raise RuntimeError("HTTP " + str(response.status if response else "no response"))
            await page.wait_for_timeout(1200)
            final = urlsplit(page.url)
            if final.scheme != "https" or not final.hostname:
                raise RuntimeError("invalid redirect")
            pixels = await page.screenshot(type="png", full_page=False, animations="disabled", timeout=12000)
            image = Image.open(io.BytesIO(pixels)).convert("RGB")
            image.save(dest, format="WEBP", quality=72, method=5)
            print("OK", key, url, dest.stat().st_size, flush=True)
            return True
        except Exception as exc:
            print("SKIP", key, url, str(exc)[:180], flush=True)
            dest.unlink(missing_ok=True)
            return False
        finally:
            await context.close()

async def main():
    items = entries()
    try:
        previous = json.loads(MANIFEST.read_text(encoding="utf-8"))
    except (FileNotFoundError, ValueError):
        previous = {}
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(headless=True, args=["--disable-dev-shm-usage"])
        semaphore = asyncio.Semaphore(3)
        results = await asyncio.gather(*(capture(browser, semaphore, key, url, previous) for key, url in items.items()))
        await browser.close()
    MANIFEST.write_text(json.dumps({key: url for (key, url), ok in zip(items.items(), results) if ok}, ensure_ascii=False, indent=2)+"\\n", encoding="utf-8")
    print("Captured or existing:", sum(results), "/", len(results), flush=True)

if __name__ == "__main__":
    asyncio.run(main())
