# Extraction validation

Baseline: the application source was extracted verbatim from vynxc/viptv@7d6b413, and MIGRATION.json records every original file, its SHA-256 and its current content hash. 15 of its 60 entries are re-pinned against that baseline in three categories: 4 changed by the RUI-027 centered-authentication work, 9 changed by the dead-code cleanup (534b3cb), and 2 recorded removals (src/ProfileManagement.test.tsx, src/components/ui/label.tsx). Every re-pinned entry keeps its original sha256 and adds the current extracted_sha256 with a reason. Verification: `python3 scripts/verify-migration.py`; `NODE_OPTIONS=--max-old-space-size=256 npx vitest run` (18 files, 95 tests); `NODE_OPTIONS=--max-old-space-size=384 npx tsc -b && NODE_OPTIONS=--max-old-space-size=384 npx vite build`. Initial GitHub CI run: https://github.com/viptv-org/web/actions/runs/34704298024 (success).

The existing app remains account/admin UI. React content browsing and playback parity are future work, not functionality added by this split. Backend promotion uses a pinned source commit and checksummed dist bundle; no production deployment occurred.


## RUI-027 centered account authentication — 2026-09-14

Design f8ca89d2c3d039fa4b6b51bd095131aa9e870374 supplies the graphite authentication styling and unchanged viptv mark. Sign-in, registration and recovery share a viewport-centered card; viewing and playback remain owned by tv-web.

All 95 unit tests and the production TypeScript/Vite build passed at that revision. Browser inspection of the built output, with unauthenticated status mocked, measured centering error zero on both axes at 390×844 (350×714 card) and 1440×900 (440×730 card), with loaded logo, no overflow and no page exceptions. Separately, tv-web's real LAN inline login/device-approval/profile-picker flow passed against the current backend, and both temporary sessions were signed out. This account website source has not been deployed to production.
