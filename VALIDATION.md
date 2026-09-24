# Extraction validation

## Link your TV — 2026-09-23

The `/device` and `/activate` routes without a code now show the design system's
WebLinkTv code-entry screen. A valid 6–12 character code continues through the
existing account sign-in and device confirmation flow. The new screen imports
only the generated design variables from revision
`5740c91d6e9cb7616626bdbb0f635cb62f6ec0c2`; the older account/admin
tokens retain their separate pin in `DESIGN_REF`. Both integrity checks run in
`npm run build`.

Evidence: 96 unit tests pass; TypeScript and production Vite build pass. The
local HTTPS `/device` page rendered at 1280×800 with a 440 px card at x=420,
y=220 and loaded bundled fonts, matching the reference layout. The code-entry
to sign-in transition passed in the account test. No production deploy or
physical TV pairing was performed.

Baseline: the application source was extracted verbatim from vynxc/viptv@7d6b413, and MIGRATION.json records every original file, its SHA-256 and its current content hash. Changed entries keep their original sha256 and add the current extracted_sha256 with a reason, including the RUI-027 authentication work, cleanup and Link your TV additions. Verification: `python3 scripts/verify-migration.py`; `npm test`; `npm run build`. Initial GitHub CI run: https://github.com/viptv-org/web/actions/runs/34704298024 (success).

The existing app remains account/admin UI. React content browsing and playback parity are future work, not functionality added by this split. Backend promotion uses a pinned source commit and checksummed dist bundle; no production deployment occurred.


## RUI-027 centered account authentication — 2026-09-14

Design f8ca89d2c3d039fa4b6b51bd095131aa9e870374 supplies the graphite authentication styling and unchanged viptv mark. Sign-in, registration and recovery share a viewport-centered card; viewing and playback remain owned by tv-web.

All 95 unit tests and the production TypeScript/Vite build passed at that revision. Browser inspection of the built output, with unauthenticated status mocked, measured centering error zero on both axes at 390×844 (350×714 card) and 1440×900 (440×730 card), with loaded logo, no overflow and no page exceptions. Separately, tv-web's real LAN inline login/device-approval/profile-picker flow passed against the current backend, and both temporary sessions were signed out. This account website source has not been deployed to production.
