# MATE SPARK Phase 9 — Operations integration (2026-10-24)

**DEVELOPMENT ONLY. Not approved for deployment or merging to main.**

## Implemented in private local developer kit
- Existing React pages **/for-schools**, **/admin**, **/**, and **/schools/[id]** route to Firebase emulator-backed operations in development, preserving the original Cloudflare paths for non-development builds.
- Applicant: verified Firebase Auth sign-in, complete original `SchoolForm` submission, private application status summaries.
- Admin: verified `sparkAdmin` custom claim; pending reviews, strictly fictional consent evidence, approval/publication, rejection with reason, and immediate unpublication.
- Public: explicitly allowlisted `publishedSchools` projection, with live re-check of agreement validity to avoid displaying expired/revoked records.
- Local search: Firebase callable publication projection shown within React nationwide search/five-school comparison. The synthetic 235-school QA mode is retained separately.
- Application address/contact fields are private and excluded from the public projection. Test submissions are frontend-restricted to `【架空】` businesses with `@example.test` emails.
- Firestore default-deny browser security rules remain intact.

## Verification
- **29/29 dependency-free Node tests** passed; the test suite covers application authorization, approval, privacy allowlist, reject/pause, and stale agreements.
- Nine patched TypeScript/TSX modules: **zero syntax parsing errors**.
- Full SHA-pinned patch applied to an isolated reconstruction of the user's previous phases: **8 replacements + 6 additions**. Duplicate invocation safely refused; ZIP CRC and SHA-256 manifest verified.
- Live phase-9 Auth/Functions/Firestore and modified React browser E2E remain **not yet executed** in the author's sandbox; only earlier phases 7/8 were confirmed live by the user.

## Safeguards and release blockers
- The backend has hard guard to `demo-mate-spark-local`, local emulators. App Check is **not enabled**. The fictional agreement test endpoint is absolutely forbidden in production.
- No real Google Sheets synchronization, real business contract evidence, protected email/notifications, trial booking UI, full Firebase deployment migration, privacy retention/deletion, or production credentials have been integrated.
- Old Cloudflare D1 API handlers still exist and must be retired/migrated before a release.
- Identifiable user or media remnants in existing public GitHub/history require remediation before any merge.
- No changes to live Firebase project `mate-spark`, deployed site, repository main, or production data.

**Code saved as local ZIP and private snapshot only.** No React editor source, private applicant records, or secrets committed to GitHub.
