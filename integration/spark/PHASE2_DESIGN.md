# MATE SPARK: Phase 2 integration contract (development only)

Status: **design + offline proof of concept; no production deployment**.

Source evidence: the React v27 export uses Vinext/Cloudflare Workers/D1 with its own privileged routes. The current Firebase Hosting site serves static `spark/`, including approved public `schools.json` and demo JSON. They are not interchangeable.

## Non-negotiable parity
- Search covers all 47 Japanese prefectures.
- Compare up to five schools (not the React export's original three).
- Preserve favorites stored under `mateSparkFavIds` on the Firebase origin; old React `naraico-favorites` may be read if it exists **on the same origin**. Browser localStorage cannot cross origins.
- Maintain existing public URLs and display only schools with verified listing consent and an active agreement. Trial intake needs separate approval.
- No contact emails, parent details, contract evidence, D1 data, or admin profiles in public JSON.

## Proposed backend, NOT created
- Firebase Auth with server-assigned `sparkAdmin` custom claim for management; **never** trust old `oai-authenticated-user-*` headers or client-supplied email/role.
- Callable Cloud Functions Gen 2 with App Check; server-owned Firestore data and default-deny Firestore client rules.
- Server-side review records and private applications, bookings, and agreements.
- Firestore transaction for reservation capacity, idempotency, slot/email uniqueness; post-commit outbox for any notifications.
- For now, keep `spark/schools.json` as the only public publication surface; continue the approved-only exporter policy.

## Phase 2 offline work / test results
- 13 dependency-free Node unit tests passed for the draft domain contract (role boundaries, published-only filtering, HMAC keys, capacity, simulated concurrent requests and idempotency).
- React v27 local patch prepared for 47 prefectures, five-item comparison and same-origin favorites. Do **not** place the private React source ZIP in this public repo.
- React's entire app build could NOT be run: node_modules and pnpm are unavailable, and npm registry resolution failed with EAI_AGAIN.
- No real Firebase SDK, emulator, D1 production data or mail service was exercised. The in-memory transaction test does not substitute for Firestore emulator concurrency testing.

## Release blockers
1. Implement and test actual Firebase Auth + App Check + Firestore Functions with isolated project/emulators.
2. Define cancellation/rescheduling, duplicate booking semantics, spam protections, data retention and cleanup.
3. Convert the legacy React API/CMS to an approved backend. React v27 must not be deployed as a static ZIP.
4. Verify photo rights, personal data in operator pages and old public Git history, and integration with the existing Sheets workflow.
5. Complete a dependency-installed React build and responsive browser preview, then parity/end-to-end tests.
6. Require a separate, explicit go-live decision before merging to main or deploying.

The original React v27 private data must stay off public GitHub.

Official references: https://firebase.google.com/docs/auth/admin/verify-id-tokens ; https://firebase.google.com/docs/app-check/cloud-functions ; https://firebase.google.com/docs/firestore/manage-data/transactions
