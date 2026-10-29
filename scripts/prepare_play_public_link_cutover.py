#!/usr/bin/env python3
"""Reviewable, dry-run-by-default changeover for public CARE/SPARK -> PLAY links.

Must only be used AFTER independent PLAY production is live and validated.
Never touches private PLAY source, client data, Firebase, Google Sheets or Gmail.
"""
import argparse
import pathlib
import re
from urllib.parse import urlsplit

ROOT=pathlib.Path(__file__).resolve().parents[1]
OLD="https://mate-play.kosuke-saito0807.chatgpt.site"
CONFIRMATION="I_VERIFIED_INDEPENDENT_PLAY_PRODUCTION"
ALLOWED_PROD_ID=re.compile(r"mate-play-(?!.*test)[a-z0-9-]{4,20}$")

def validate_new(origin):
 try:
  u=urlsplit(origin)
  if u.scheme!="https" or not u.hostname or u.port or u.username or u.password or u.path not in ("","/") or u.query or u.fragment:
   raise ValueError("Only a bare HTTPS origin can be published")
  host=u.hostname.lower()
  firebase=host.endswith(".web.app") and bool(ALLOWED_PROD_ID.fullmatch(host.removesuffix(".web.app")))
  owned=host.startswith("play.") and host.count(".")>=2 and not host.endswith((".web.app",".firebaseapp.com",".github.io",".chatgpt.site"))
  if not (firebase or owned):raise ValueError("Must be dedicated independent PLAY Firebase project or owned play subdomain")
  return "https://"+host
 except ValueError:raise

def planned_changes(origin,root=ROOT):
 new=validate_new(origin)
 results={}
 for page in list(root.glob("*.html"))+list((root/"spark").glob("*.html")):
  s=page.read_text(encoding="utf-8")
  if OLD in s:
   results[page]=s.replace(OLD,new)
 return results

def main():
 p=argparse.ArgumentParser()
 p.add_argument("--origin",required=True,help="Verified new PLAY production origin")
 p.add_argument("--apply",action="store_true",help="Write reviewable public HTML changes")
 p.add_argument("--confirmation",default="",help="Explicit post-deploy and post-mail-test confirmation")
 a=p.parse_args()
 changes=planned_changes(a.origin)
 for page in sorted(changes):
  print("PLAY_PUBLIC_LINK",str(page.relative_to(ROOT)))
 print("Candidate files:",len(changes),"Mode:","WRITE" if a.apply else "DRY_RUN")
 if a.apply:
  if a.confirmation!=CONFIRMATION:
   raise SystemExit("Refusing link switch without verified production approval")
  for path,next_content in changes.items():
   path.write_text(next_content,encoding="utf-8")
  print("Applied only public CARE/SPARK HTML links; review the diff before merging and publishing")

if __name__=="__main__":main()
