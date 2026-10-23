# MATE SPARK development branch: phase 1

This branch is separate from production `main`. **Do not merge, deploy, or add production secrets**.

## Baseline and scope
- Production: https://mate-spark.web.app/ (not modified).
- GitHub baseline commit: `4193afd50bec1a81fef529d7e0d14ad8b4f5cb71`.
- Existing static site under `spark/` remains the reference for 47-prefecture search, maximum five comparisons, approved-only school publication and Google Sheets integration.
- React v27 came from a separate ChatGPT Sites export and uses Vinext / Cloudflare Workers / D1 / platform identity headers; it **cannot** replace Firebase static hosting as-is.
- React export is intentionally **not committed** to this public repository. Keep its source archive private while verifying identity, assets, licenses, dependencies and API migration.

## Safe code staged here
- `compat.mjs`: standalone read-only-friendly compatibility helpers for local favorites and approved public school JSON. No external calls.
- `compat.test.mjs`: dependency-free unit tests.

Run from repo root:
```sh
node --test integration/spark/compat.test.mjs
python3 -m unittest discover -s tests -p 'test_spark*.py' -v
```

## Required before any production release
1. Replace spoofable ChatGPT Sites auth headers with server-verified Firebase Auth/custom authorization. Never trust client-supplied administrator identity.
2. Design server-side API and database, with approval gates, booking capacity, idempotency and privacy retention rules. Static Hosting alone cannot run the D1 routes.
3. Preserve nationwide search, five-way comparison, existing URLs, and browser favorites.
4. Confirm personally identifying content in old public pages, Git history, asset metadata and operator details; existing GitHub owner and URLs remain identifiable.
5. Test in an isolated preview with nonproduction data. No changes to `main` or live Firebase without a separate release decision.

No authentication credentials, private-profile backups, or applicant records are committed in this directory.
