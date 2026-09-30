# viptv web

Actions delivery: main pushes and manual builds produce sideloading artifacts
(Android universal APK; desktop Windows/Linux installers; Roku ZIP; TV WGT/IPK).
Other repositories have no Actions workflows. Local checks remain; previous
CI/release-publication descriptions below are historical. No automatic deploys.

Extracted from `vynxc/viptv@7d6b413`. `MIGRATION.json` records every original file and SHA-256; the original repository retains history. This repository owns the existing React account and administration web app.

The [design repository](https://github.com/viptv-org/design) is the product source of truth. Read [SPEC.md](SPEC.md), [AGENTS.md](AGENTS.md), and the pinned `DESIGN_REF` before implementation. Future platform work must inherit its interaction contracts.


## Viewing UI ownership

The responsive viewing client (phone browser and desktop webview) is implemented in `viptv-org/tv-web`, sharing the real Rust-backed TV application controller, profile/session restoration, catalog and playback implementation. Its default browser layout follows the approved responsive VIPTV design; `?platform=tizen`, `?platform=vizio` or `?layout=tv` retain the TV presentation. This repository continues to own account/admin screens. Deploy the viewing bundle alongside this application at its configured base path; do not copy viewing business logic into the dashboard. See tv-web issue #3 and design/RESPONSIVE_PRODUCTION.md.

The public `/device` page accepts the code shown on a TV, then carries it through
the existing sign-in and device approval flow. Its design-system token snapshot
has a separate lock under `design-contract/link-tv/`; the account/admin theme
remains pinned to `DESIGN_REF`.

## Account and operator management

ADM-002 implements account-owned Xtream connections, add-ons, private playback
gateways, operator gateway grants, and cursor-paged VOD matching against BE-002.
The default live playlist is explicit; other owned providers remain available
for movie and series sources. Retired family-lineup, provider-pool, repair and
Service setup screens are no longer shipped. This does not delete server data.

Credentials are write-only: connection passwords and gateway keys are never
prefilled from saved records. Gateway checks display only actual backend
capacity hints, including zero or unavailable capacity. VOD results are fetched
in pages of 50, debounced and cancelled when filters change, with at most 20
rendered rows; saving a match preserves the current viewport.

Run `npm test`, `npm run build`, and `python3 scripts/verify-migration.py`.
The optional local-HTTPS acceptance harness is
`node tests/admin-v2.e2e.mjs`; it requires the workspace's TV-web Playwright
installation and the reviewed dashboard build staged in the local HTTPS host.
Every API call in that harness is intercepted; it must not mutate production.
See [VALIDATION.md](VALIDATION.md) for evidence and remaining qualification.

## License

Copyright (C) 2026 viptv contributors.

This program is free software; you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation; version 2 of the License. See [LICENSE](LICENSE). The playback adapters (`viptv-org/video`, `viptv-org/tauri-video-plugin`) and the Android repository remain under their existing MIT OR Apache-2.0 terms.
