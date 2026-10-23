# MATE SPARK Phase 8: React → Firebase Local Emulator (2026-10-24)

**Development-only. Never merge this branch or deploy the local test API as-is.**

## Grounded baseline
- User's Mac confirmed phase-7 `Auth + Functions + Firestore` emulators with actual emulated ID tokens, server-verified admin claim, local application approval, and private-field-free projection: `pass:true`.
- Current local React v27 demo includes 47-prefecture QA fixtures, five-school comparison, and a separate in-memory `/qa-workflow?qa=1` demo. Neither is the live production Firebase implementation.
- Production still points at static `spark/` and independently managed Google Sheets publication.

## Phase-8 code delivered privately (NOT uploaded to public GitHub)
- Local-only React page `/qa-firebase?qa=1`: Firebase browser SDK connects to the **demo** Auth emulator on 9099 and callable Functions emulator on 5002 (asia-northeast1).
- `submitListingSandbox`, `listPendingSandbox`, `recordFakeAgreementSandbox`, `approveListingSandbox`, `listPublishedSandbox` for a fictional partner/admin review sequence.
- `listPendingSandbox` filters admin-visible pending applications to a strict preview; real applicant details are never returned to the demo UI.
- `recordFakeAgreementSandbox` is explicitly **fictional, local-only test data**. Real contracts/consent must be separately verified and cannot be synthesized by users. Runtime hard guard enforces local demo emulators.
- Script creates random `@example.test` Auth emulator accounts, one partner and one administrator with server-side `sparkAdmin` claim.
- Demo client cannot be used in production; local-only page has an additional runtime dev/localhost guard.
- Patch script checks original backend SHA-256 and exact local directory names, backs up two replaced functions files, adds seven files, and refuses a second application. It never uses GitHub or Firebase deploy APIs.

## Verification results
- Phase-7 existing + new phase-8 offline Node domain tests: **22 / 22 passed**.
- TypeScript transpile parse across the 3 phase-8 React/SDK TSX/TS files: **0 syntax diagnostics**.
- Patch script applied successfully to an isolated copy of the phase-5 React project plus phase-6 files and phase-7 backend, then rejected a second invocation without overwriting files.
- Package ZIP integrity and source SHA-256 manifest checked; no private keys or real applicant/profile data detected in the patch.
- **New phase-8 live emulator smoke run, browser flows, App Check and React full build have not been executed by assistant.** The user must verify these in their local Mac environment.

## Release blockers
1. **Remove the fictional-agreement API**, replace with real audited proof of listing consent/contracts, retention/revocation rules and robust back-office authorization.
2. Enforce App Check and appropriate abuse protections, validate Auth/Functions/Firestore integration with production security policies.
3. Integrate real React forms and the current static Firebase/Sheets publishing pipeline; `/qa-firebase` does not supersede those.
4. Ensure no identifiable operator details or historical personal assets remain on public GitHub and domain links.
5. End-to-end tests with responsive UI, actual Firebase deployment plan, feature parity and explicit go-live approval.

Production `main`, firebase host and live applications remain untouched.
