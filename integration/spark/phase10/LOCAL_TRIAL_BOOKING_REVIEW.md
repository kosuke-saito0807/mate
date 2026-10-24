# MATE SPARK Phase 10 — Local trial intake integration (2026-10-24)

**Status: development / offline verification only. Do not merge or deploy.**

Phase 8 React-to-Firebase demo was previously verified by the user with real Auth/Functions/Firestore Emulators and a passing API smoke test. Phase 9 source was built but not yet applied on their Mac. Phase 10 is a cumulative Phase 9+10 developer update.

## Local implementation, kept off public GitHub
- Added four demo-only Firebase callable endpoints: `createTrialSlotSandbox`, `listTrialSlotsSandbox`, `submitTrialDemoSandbox`, `listTrialRequestsSandbox`.
- Added the original React admin page's slot creation and redacted trial request panel, plus synthetic trial booking UI on approved school detail pages.
- Staff-only slot creation requires a verified admin claim, an approved fictional school, active independent agreement evidence, and explicit trial consent.
- Transactional trial submission checks active agreement and published school, child age, slot availability, idempotency and duplicate applicant/slot membership. Data must be synthetic `@example.test` and any accepted booking is pending confirmation, not a reservation.
- Old 47-prefecture/5-school comparison and 235-fictional-school QA mode remain intact; no production Google Sheets or Cloudflare migration.

## Verification evidence
- **39/39** dependency-free Node tests passed (phase 9 29; phase 10 10).
- Local patch verified end-to-end on isolated copies both from phase 8 and phase 9, including backup, repeat-run guard and refusing unexpected file edits.
- Six changed React TS/TSX files parsed with TypeScript and zero syntax diagnostics.
- **Actual Phase-10 Auth/Functions/Firestore Emulator E2E, full React build, App Check and browser QA are NOT verified.** A Mac-only smoke script is included in the private kit.
- All local source and scripts packaged separately and **not uploaded to this public repository**.

## Release blockers
1. Remove fictitious agreement generator and demonstrate real verified provider consent / authorization.
2. Add real Firebase App Check, production auth-role provisioning, rate limits, privacy retention, support/notifications, cancellations.
3. Keep parent/minor contact information out of public JSON. Phase10 presently accepts no real parent PII.
4. Implement and test static Firebase/Google Sheets publication, trial follow-up and migration of old Cloudflare API routes.
5. Implement pagination (existing published school endpoint currently limits to 100), evaluate mobile accessibility and cross-origin favorites migration.
6. Resolve historical personal URLs/assets/metadata in public GitHub and obtain a separate explicit go-live decision.

Production Firebase `mate-spark`, Github `main` and the live website are unchanged.
