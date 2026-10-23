# MATE SPARK Phase 5 — Local QA data (2026-10-23)

**Status: offline/local preview only. NOT for release, merge, Firebase deployment, or public source hosting.**

The user confirmed the unmodified React preview renders on their Mac and the Firestore Emulator-only security test completed with `pass:true` and exit code 0 (12 simulated simultaneous attempts for capacity 2). Those checks do **not** establish real app/backend integration.

## Built (kept PRIVATE, not committed to this public repo)
- React v27 local preview source based on privacy-reviewed export, with only three existing files patched and three helper files added.
- Development-only `?qa=1` mode: 47 prefectures × 5 **clearly fictional** test schools (235 total), no real partner/customer data or form submission for demo schools.
- National prefecture filter and maximum-five comparison parity, plus same-origin favorites key synchronization (`mateSparkFavIds` and `naraico-favorites`). Browser localStorage **cannot** migrate across origins without an explicit export/import mechanism.
- A small SHA-verified backup-and-patch script for the user's existing private Mac development folder; avoids reinstalling all dependencies.
- Local Node/TypeScript test of generated fixture coverage, actual search predicate (prefecture, genre, price, weekday, keyword), favorite synchronization and demo no-submit branch: passed.
- Syntax parse: 116 TypeScript / TSX / JS source files, 0 parse diagnostics. Full typecheck, build, and browser interactions of modified preview remain **unverified** in the assistant's container.

## Release blockers
1. Reconcile other one-metropolitan-three-prefectures copy (provider page, terms, footer, metadata, sales drafts) with approved real service scope. **Do not silently broaden legal and commercial claims.**
2. Firebase Auth / App Check and real Firestore-backed API integration, unlike mock and isolated emulator checks.
3. Approved-only publication and no accidental public exposure of QA/test or private source.
4. Explicit same-origin favorites migration strategy when switching production origins.
5. Successful full build, responsive UI, acceptance tests, release plan and explicit production authorization.

Only this design note is saved to GitHub. The 6.3-MB React source, applicant data, private identity and personal media are **not** uploaded.

Production `main` / live Firebase / Cloudflare / GitHub workflows: untouched.
