# MATE SPARK Phase 4 security review — DEV BRANCH ONLY

Date: 2026-10-23. Current production `main`, Firebase Hosting and live data were intentionally not modified.

## Offline progress
- A separate phase-4 **local ZIP kit** now contains a hardened prototype domain service, transaction adapter, sandbox-only Cloud Functions code, Firestore rules and emulator-test script.
- Phase-4 Node tests: **34 / 34 passed** (offline mocks and static rules/config checks).
- Separate browser fixture: 1280px + 390px, demo 12 schools, 47 prefectures, 5 comparisons; no network and **not** a real React/browser integration test.
- TypeScript syntax parsing across privacy-reviewed React v27: **114 files, 0 parse diagnostics**. This is **not** a successful full app build.
- Actual Firebase Emulator / Auth / App Check / Firestore transaction tests have **not** run: Firebase packages unavailable (npm registry DNS `EAI_AGAIN`).
- **No React source, user applications, private photos, secrets or service account keys** are committed.

## Fixes prepared in local kit (not yet integrated into public branch)
1. Idempotency keys now bind to the exact validated booking payload via HMAC. Reuse against a different school/slot is denied.
2. Expired agreements are excluded from the public school projection.
3. Malformed email types produce controlled validation errors.
4. Function entrypoint requires demo project ID and loopback Firestore emulator port.
5. Firestore real-emulator test script: 12 simultaneous synthetic reservations into 2 seats, replay tests and default-deny direct reads. Script not yet executed.

## Gate to continue
Run local `npm test` (no dependencies), then install `firebase-tools` and `firebase-admin` on a network-connected machine and run emulator-only tests against `demo-mate-spark-local`. Verify production constraints before any source merge or release. Do not enable or modify `firebase-spark-live.yml`.

**No production merge or deployment is authorized in this phase.**
