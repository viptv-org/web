# Extraction validation

All application source files match vynxc/viptv@7d6b413. Only root documentation/ignore configuration differs from the dashboard extraction, as recorded in MIGRATION.json. Local npm ci, all 95 tests and production build passed. Initial GitHub CI run: https://github.com/viptv-org/web/actions/runs/34704298024 (success).

The existing app remains account/admin UI. React content browsing and playback parity are future work, not functionality added by this split. Backend promotion uses a pinned source commit and checksummed dist bundle; no production deployment occurred.
