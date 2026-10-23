# MATE SPARK Phase 7 — Firebase Auth / Functions / Firestore local E2E

Date: 2026-10-23. **This is a LOCAL-EMULATOR-ONLY implementation and test kit**, not a release.

## Implemented offline
- Prototype Firebase Functions v2 callable operations:
  - `submitListingSandbox` (verified email Firebase Auth context required)
  - `approveListingSandbox` (server-verified `sparkAdmin` custom claim required)
  - `listPublishedSandbox` (explicit allowlisted public projection)
- Independent back-office `agreements/<schoolId>` evidence required for approval; no client-provided `approved` / admin / contract flags are accepted.
- Atomic application and approval writes in Firestore, request-ID idempotency, and private `listingApplications` separate from projected `publishedSchools`.
- Default-deny client Firestore rules and hard `demo-mate-spark-local` + loopback-emulator-only runtime guards.
- Real-emulator test script **prepared** to create fake Auth Emulator users, verify emulator-issued ID tokens with Admin SDK, call Functions Emulator endpoints, and verify Firestore stored data + authorization outcomes.
- Dependency-free offline Node tests: **16/16 passed**.
- 18-file distribution ZIP locally constructed with SHA-256 manifest, validated for integrity and common secrets/personal URLs.
- Real Auth/Functions/Firestore Emulator integration script **not executed by assistant**, because npm registry access from execution container failed with `EAI_AGAIN`. User's Mac successfully ran earlier phase-4 Firestore-only emulator testing, but this is a new test and results are still pending.

## Safety caveat
**App Check is deliberately not enforced for LOCAL testing** (`enforceAppCheck:false`) because this is a demo-only callable proof. This is explicitly **not production secure**. Auth custom claims are verified by the local Firebase Functions Emulator; real App Check integration, client error flow, abuse prevention and production rules still require implementation. A runtime guard rejects non-emulator and non-demo Firebase requests.

The Phase-6 React `/qa-workflow?qa=1` is still an in-memory simulator; it is **not connected to these callables**. Production-approved `spark/schools.json` and live publishing/sync are untouched.

## Local verification sequence
1. Unzip phase-7 kit in a new Mac folder (separate from existing React dev and phase-4).
2. `npm install`, `(cd functions && npm install)`, `npm test`.
3. `npm run emulator:listing-flow`: launch auth/firestore/functions with project `demo-mate-spark-local`, call real emulator endpoints, and report JSON `pass:true` if all verified.
4. Require later explicit go-live approval only after App Check, real admin UX, consent evidence process, private record retention and production deployment review.

No production `main`, Firebase site or data modified; no React source, applicant data or private-profile assets uploaded to public GitHub.
