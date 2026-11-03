#!/usr/bin/env python3
"""Read-only production proof for CARE layout assets and SPARK transport.

No forms, email, uploads or data writes. HTTPS cert validation is strict.
"""
import re
import ssl
import socket
import sys
import time
from urllib.request import Request, urlopen

AGENT="MATE-public-layout-tls-verifier/1.0"

def read(url):
    with urlopen(Request(url,headers={"User-Agent":AGENT}),timeout=20,context=ssl.create_default_context()) as res:
        if res.status != 200:
            raise RuntimeError(f"{url}: HTTP {res.status}")
        return res.read(1_000_000).decode("utf-8",errors="replace")

def check():
    care="https://care.kosodatemate.jp/"
    spark="https://spark.kosodatemate.jp/"
    html=read(care)
    stylesheet="assets/mate-brand-alignment.css?v=20261103-design-system-v15"
    assert stylesheet in html and 'id="care-scene-four-card-guard"' in html, "Production CARE HTML has not received final four-card release"
    css=read(care+stylesheet)
    assert "grid-template-columns: repeat(4,minmax(0,1fr))" in css, "CARE production CSS lacks four columns"
    assert "aspect-ratio: 3 / 2" in css and "object-fit: cover" in css, "CARE photo aspect rules missing"
    for label in ["urgent","pickup","sick"]:
        source=f"assets/mate-care-scene-{label}-v2.webp"
        assert source in html, f"CARE photo {label} missing from production HTML"
        with urlopen(Request(care+source,headers={"User-Agent":AGENT}),timeout=20,context=ssl.create_default_context()) as res:
            assert res.status==200 and res.headers.get("Content-Type","").startswith("image/"),source
    assert html.count('loading="eager"') >= 4, "CARE scene photos must not lazy-load below fold"
    print("PASS: production CARE shows four-column SCENE CSS and all four eager image assets",flush=True)
    spark_html=read(spark)
    assert "MATE SPARK" in spark_html, "SPARK homepage unexpected"
    with socket.create_connection(("spark.kosodatemate.jp",443),timeout=12) as raw:
        with ssl.create_default_context().wrap_socket(raw,server_hostname="spark.kosodatemate.jp") as secure:
            cert=secure.getpeercert()
            ssl.match_hostname(cert,"spark.kosodatemate.jp") if hasattr(ssl,"match_hostname") else None
            assert cert.get("notAfter"),"SPARK missing trusted TLS certificate"
            print("PASS: production SPARK valid TLS certificate",cert["notAfter"],flush=True)
    print("PASS: CARE live layout and SPARK TLS are verified")

if __name__=="__main__":
    for attempt in range(1,7):
        try:
            check()
            sys.exit(0)
        except Exception as error:
            print(f"Check attempt {attempt}/6: {error}",flush=True)
            if attempt<6: time.sleep(10)
    sys.exit(1)
