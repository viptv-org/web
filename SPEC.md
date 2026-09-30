# Web extraction and playback roadmap

## Approved account-management cutover

ADM-002 and BE-002 at design 4e153a7 supersede the extraction-only roadmap below.
This branch rebuilds account/operator management with account-owned encrypted
Xtream/addon connections, explicit gateway grants and bounded v2 VOD matching.
Authentication, cookie/CSRF, device approval, profile and history identities stay
intact. Family lineup/pools, Service setup and the maximum-quality UI are retired;
production data migration/deployment is not authorized by this source change.

Current acceptance requires every navigation route at phone/desktop dimensions,
keyboard modal return, retained error drafts, safe secret handling and bounded
rendered VOD rows. Source extraction hashes remain historical provenance, not a
requirement to retain superseded implementations as dead executable modules.

## Delivered extraction
The existing React/TypeScript account and administration app is moved verbatim from dashboard/ to this repository root. Preserve cookie authentication, CSRF/exact-origin rules, device approval, profiles/PIN, account addons, library/history/queue, owner providers/lineup/health and settings. No new playback UI is claimed by this extraction.

## Acceptance
- Every migrated source hash matches MIGRATION.json.
- npm ci, npm test -- --run, and npm run build pass.
- CI uploads a web-dist artifact; version tags publish a checksum-bearing release archive only after validation.
- Backend pins an exact revision as dashboard; it serves the bundle on the existing authenticated origin.

## Next implementation
Build React browse/player routes from design without removing account/admin routes. Evaluate viptv-org/video and Mediabunny against actual container/codec/device support; prefer native decode, then local demux/decode when supported, then remux/audio-only conversion, and full server transcode only as a last resort. Match queue, next episode, hold alternatives, source intent, tracks and focus acceptance scenarios. No unverified universal codec claim.
