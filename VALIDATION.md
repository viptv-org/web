# Extraction validation

## Bounded VOD window and auto-loading lists — 2026-09-30

VOD matching follows every owned connection page for the Provider filter (208
providers in the fixture) and retains at most three adjacent 50-title pages
(150 rows, 20 rendered) with forward and reverse cursors, per design
`1dc92f7b4a571df00f89cc3915aaf1165a42bf94` (ADM-002-VOD-WINDOW). The trusted-HTTPS
traversal evidence is recorded in the backend's
`docs/BOUNDED_VOD_ACCEPTANCE.md`.

My List, Continue Watching, History and approved titles no longer have
Previous/Next pagers. A sentinel at either end of the list loads the adjacent
offset page, a skeleton covers the first load and a "Loading more titles…" row
the rest. At most 100 rows (1,000 approvals) stay rendered; the first visible
row keeps its position when rows above it are evicted or reloaded. Confirmed
removals, restores and corrections adjust later offsets instead of refetching.

Evidence: 103 unit tests pass in a single Vitest fork, including auto-load,
eviction/reload, scroll anchoring, offset shift after removal, in-place queue
restore and legacy approvals beyond 500; TypeScript, production build, both
design locks and `python3 scripts/verify-migration.py` pass. Browser
qualification of the auto-loading lists, physical devices and deployment were
not run.

## ADM-002 / BE-002 management — 2026-09-30

Parent-required draft preservation now keeps already-authorized, same-account
and same-profile forms in memory while protected presentation is hidden/inert.
Protected portals are removed, new protected requests are blocked, and pending
protected requests are aborted. Successful PIN entry revalidates account,
profile and role before revealing drafts; saves are not automatically replayed.
Cancelling an ordinary challenge leaves the ready scope for profile selection
and discards drafts, retaining the existing cancel/logout behavior. Revocation
or changed authority also discards drafts. No draft or PIN is stored in browser
storage. Gateway-grant confirmation and match metadata/type drafts survive
temporary portal removal as well as connection/add-on/key form drafts.

Evidence for this narrow follow-up: all 88 unit tests pass, including twelve
new late-challenge, failed-PIN, cancellation, authority-change, duplicate-submit
and focus fixtures. TypeScript, production build, design locks and extraction
integrity pass. Fully mocked local HTTPS acceptance passed both 1440×900 and
390×844 against `index-DmjEsEGF.js`, exercising all twelve owner routes plus
late parent-required failures and explicit post-PIN retries for Xtream, add-on,
gateway and metadata-match forms. It found no page exceptions, horizontal
overflow, draft-storage writes or protected requests while locked. PIN fields
were focused and masked; protected portals were absent during the challenge.
Returned phone and desktop sheets were visually inspected with retained drafts
and the existing geometry. The full authentication/browser matrix remains open.

Follow-up integrity guards reject duplicate rows across fetched pages and
multi-page cursor cycles before publication. Empty terminal pages remain valid;
empty pages that claim continuation fail visibly. Failed continuation requests
can retry, and failed same-scope refreshes preserve the committed identity
guards. Five new hook fixtures pass; the current suite is 76 passing tests,
with build/design/extraction checks passing. The full local HTTPS acceptance
rerun passed both viewports against `index-CanwlKM-.js`, retaining the same
twenty-row DOM bound and route/error/focus scenarios described below.

Account/admin design adopts approved design revision
`4e153a7daca300389049e5fcfd5c3bc0af5edbee`. The independent Link TV snapshot
is unchanged. Local fonts, responsive labelled navigation, safe error states,
write-only credentials, and bounded VOD rendering replace the retired
organizer/setup screens. Historical extraction checksums are retained;
explicitly retired files are marked removed rather than losing their provenance.

At this revision: 71 unit tests passed; TypeScript, production build, both
design locks and extraction integrity passed. Local HTTPS browser acceptance
passed at 1440×900 and 390×844 against built asset `index-BUxkFkx7.js`:
all twelve owner routes rendered without page exceptions or horizontal
overflow, member navigation hid operator routes, and a synthetic 100,000-title
catalog fetched only cursor pages of 50 with at most 20 mounted rows. This is
not a claim that all 100,000 titles were fetched or tested. Tests traversed
18 continuation pages per viewport, restored match-dialog focus, saved a match
without losing its row, and exercised empty, slow, retry, grant-dialog and
zero-capacity states. API requests were fully mocked; external hosts were
blocked. Screenshots were inspected locally and remain private temporary QA
artifacts, not production data.

Remaining qualification at that revision: real backend/gateway integration and
the full browser authentication/recovery and parent-unlock transition matrix.
The prior uncertainty about same-scope unsaved drafts through a parent challenge
is superseded by the focused evidence above; this does not complete the full
authentication/recovery/parent-transition matrix. The provider-filter limit
(more than 200 connections) and VOD row retention are closed by the bounded VOD
window section above. No production migration, deployment, real-device pairing or gateway playback
was performed by this admin acceptance run.

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
## REL-001 API reasons — 2026-09-28

Account/admin errors retain safe validation and provider capacity reasons while
filtering credential-bearing URLs, headers and raw markup. Authentication copy
continues to avoid account enumeration. All 98 tests and the production build
passed. On Node 26, tests used NODE_OPTIONS=--no-experimental-webstorage so jsdom
owns browser storage; the unmodified test cleanup otherwise sees an undefined
Node storage global. Viewing header/navigation changes belong to tv-web. This
source update is not a production deployment.
