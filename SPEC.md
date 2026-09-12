# Web extraction and playback roadmap

## Delivered extraction
The existing React/TypeScript account and administration app is moved verbatim from dashboard/ to this repository root. Preserve cookie authentication, CSRF/exact-origin rules, device approval, profiles/PIN, account addons, library/history/queue, owner providers/lineup/health and settings. No new playback UI is claimed by this extraction.

## Acceptance
- Every migrated source hash matches MIGRATION.json.
- npm ci, npm test -- --run, and npm run build pass.
- CI uploads a web-dist artifact; version tags publish a checksum-bearing release archive only after validation.
- Backend pins an exact revision as dashboard; it serves the bundle on the existing authenticated origin.

## Next implementation
Build React browse/player routes from design without removing account/admin routes. Evaluate viptv-org/video and Mediabunny against actual container/codec/device support; prefer native decode, then local demux/decode when supported, then remux/audio-only conversion, and full server transcode only as a last resort. Match queue, next episode, hold alternatives, source intent, tracks and focus acceptance scenarios. No unverified universal codec claim.
