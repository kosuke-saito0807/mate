# MATE CARE / SPARK / PLAY — public release assessment
Date: 2026-10-24 (Japan). **Read-only assessment; no new production deployment.**

## Verified public baseline
| Service | Currently used public URL | Source/platform | Evidence |
|---|---|---|---|
| MATE CARE | https://kosuke-saito0807.github.io/mate/ | GitHub Pages, `mate` main root | live 3-site read-only audit 39917906498: HTTP 200 desktop+mobile, no JS exceptions/broken images/horizontal overflow |
| MATE SPARK | https://mate-spark.web.app/ | Firebase Hosting, `mate` main `spark/` | same live audit: HTTP 200 desktop+mobile; Github production SPARK workflow 39909215106 succeeded |
| MATE PLAY | https://mate-play.kosuke-saito0807.chatgpt.site/ | ChatGPT Sites, independent CMS | same live audit: HTTP 200 desktop+mobile. Warnings: external listing CTA and missing shared contact/NextEdu on home view |

Audit: https://github.com/kosuke-saito0807/mate/actions/runs/39917906498 (2026-10-23, latest checked in this assessment).
Note: The audit suppresses FormSubmit and analytics requests and **never sends any form**, so passing does not verify end-to-end inquiry delivery.

## Decision
1. **Keep all three EXISTING sites publicly available as limited/baseline launches**. This is preservation of previously published endpoints, NOT a new deployment by the assistant.
2. **Do not merge SPARK phase-10 React sandbox to main**: its Firebase backend hard-codes demo IDs / emulator, App Check is disabled, a fictional agreement API exists, trial booking hasn't completed real operational tests. The same applies to PLAY's v19 Vinext/Cloudflare D1 export. Static Hosting cannot substitute for the private API automatically.
3. **Do not change the public PLAY site** from Github: its live CMS is separate and cannot be safely overwritten with a scraped/static placeholder.
4. Main HEAD verified during review: `4193afd50bec1a81fef529d7e0d14ad8b4f5cb71`. This assessment is written only to dev branch.

## Remaining material production gates
- Confirm FormSubmit recipient `kosodatemate@gmail.com` is authorized, inbound mail from each form actually arrives, consent text and privacy page are correct; prevent a misleading 'sent' message when delivery is unverified. No production end-to-end submission has been observed.
- Verify operator/legal pages and **personally identifying legacy image, URLs and Git history** against the user's nonpublic-profile preference; be mindful that a public GitHub URL itself embeds an individual username and history is retained. Privacy removal may require a separate repo/domain and archival/history response, not just a UI text edit.
- Confirm publication consent/real contract, independent trial-referral consent, administrator rights, deletion/retention, rate limiting/App Check, and personal data handling before switching from **contact/listing inquiries** to live trial booking.
- CARE static site and SPARK static site have an existing Google Sheets/FormSubmit management path; its Gmail Apps Script and inbound mailbox authorization are not independently verified.
- PLAY CMS listing-review auto publication is not wired to the shared CRM; the v19 private source is available for migration but requires API/auth/Data separation and validated deploy credentials.
- Review analytics/cross-site footer linkage, mobile full flows, accurate operator info, and localStorage origin change strategy.

## Rollback
Keep existing CARE GitHub Pages, SPARK Firebase static hosting and PLAY ChatGPT Sites endpoints as the known running baseline. Before any change: capture current deployment refs and backups, stage isolated preview, test public GET, false listing/capacity and form receipt; deploy only after gates pass with an approved rollback ref. Do not upload PRIVATE_PROFILE or application/customer records to public GitHub.

## Next deliverable, when production readiness verified
Separate final release for each service, preserving its branding, provider data and consents. GitHub/Firebase migration for PLAY and React SPARK is a **separate migration project**; do not describe the current public sites as the migrated implementations.
