# MATE SPARK Phase 6 — Local workflow QA (2026-10-23)

**Dev branch only. Do not merge or deploy.** The production `main`, Firebase live site and live data are unchanged.

## What was completed offline
- A small local-only React route `/qa-workflow?qa=1` for a **synthetic** listing-review / publication / trial-booking walkthrough. The route is guarded to development mode; no external calls or permanent storage.
- Three fictional school applications: consent missing => cannot approve; reviewed & documented consent => eligible for mock listing.
- Two-seat mock trial capacity and idempotency checks; duplicates and cross-school request keys rejected.
- Pure typed helper maps the current React booking form fields to the existing Firebase `submitTrialSandbox` domain input shape, including consent version `2026-10-09`.
- **13 / 13 offline tests passed**, TypeScript strict compiled for pure helpers. **4 / 4 new TS/TSX files parsed**.
- Mock form output was accepted by the existing Phase-4 `validateTrialRequest` backend domain validator.
- Local add-only patch script successfully applied to an isolated fake React directory and refused a second attempt that would overwrite existing files.

## Still NOT implemented or verified
- No actual Firebase Functions / App Check / Auth request has been wired from the React browser.
- The UI represents fake approvals: these are NOT verified admin permissions or real partner consents.
- The user previously confirmed real Firestore Emulator reservation test `pass:true` with 12 parallel test requests, accepted 2 for 2 slots; this is separate from this UI.
- The modified React app's full build and live localhost visual interactions remain unverified in this environment.
- Public data projection, private applications storage, original D1 route replacement and audited administrator operations all remain a future implementation.

## Security / storage
The phase-6 React source is kept in a private local ZIP only. **Do not commit to this public repository**; the repo contains only this high-level note. No PII, secrets, applicant lists, portraits, customer contacts or fake published records have been uploaded. Keep production unchanged until reviewed end-to-end tests and explicit go-live approval.

References: https://firebase.google.com/docs/functions/callable ; https://firebase.google.com/docs/app-check/cloud-functions ; https://firebase.google.com/docs/emulator-suite/connect_auth
