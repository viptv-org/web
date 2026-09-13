# viptv web

Extracted from `vynxc/viptv@7d6b413`. `MIGRATION.json` records every original file and SHA-256; the original repository retains history. This repository owns the existing React account and administration web app.

The [design repository](https://github.com/viptv-org/design) is the product source of truth. Read [SPEC.md](SPEC.md), [AGENTS.md](AGENTS.md), and the pinned `DESIGN_REF` before implementation. Future platform work must inherit its interaction contracts.


## Viewing UI ownership

The responsive viewing client (phone browser and desktop webview) is implemented in `viptv-org/tv-web`, sharing the real Rust-backed TV application controller, profile/session restoration, catalog and playback implementation. Its default browser layout follows the approved responsive VIPTV design; `?platform=tizen`, `?platform=vizio` or `?layout=tv` retain the TV presentation. This repository continues to own account/admin screens. Deploy the viewing bundle alongside this application at its configured base path; do not copy viewing business logic into the dashboard. See tv-web issue #3 and design/RESPONSIVE_PRODUCTION.md.
