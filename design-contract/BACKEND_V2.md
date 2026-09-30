# BE-002 — account-owned Xtream and independent playback gateway

Status: approved for implementation on 2026-09-29; not deployed. This supersedes
local-only mode and embedded-transcoder proposals for the v2 cutover. The current
runtime remains baseline until the acceptance ledger records its replacement.

## Ownership and scope

- VIPTV owns accounts, profiles, grants, catalogs, source discovery and history.
- Add-ons and Xtream connections are account-owned. Profile ownership continues
  to protect viewing history, favorites, restrictions and playback preferences.
- The independent `playback-gateway` owns authenticated generic media jobs,
  input/output sharing, probing, proxying/remux/transcode and viewer leases.
- Xtream supplies live, movie and series data. No generic M3U or external XMLTV
  import is introduced. Existing Xtream-native guide reads remain supported.
- Advanced family-lineup/filtering/repair configuration is exported, not silently
  discarded. Building its independent organizer is deferred.
- Only the account/admin website is redesigned. Client layouts remain unchanged
  except removing local-only/max-quality controls and displaying v2 errors.

## Playback contract

The gateway's public contract is independent of VIPTV identifiers. It receives
an HTTP(S) input, required headers, live/VOD semantics, position and capabilities.
Input URLs and headers are secrets: no Debug/exception/log representation may
contain them. Arbitrary command arguments and local file inputs are prohibited.

`API_KEY` is a bootstrap administration credential. It provisions revocable
integration keys with authorized namespaces, operation scopes and quotas.
Viewer credentials are independent, short-lived and restricted to one session.
Keys are never returned by list APIs. Backend-stored source/gateway secrets are
encrypted with an operator-managed key. Unknown/revoked key and cross-scope ID
lookups must not disclose resource existence.

Control API v1:

| Route | Meaning |
| --- | --- |
| GET /health, /ready | Non-sensitive liveness/readiness |
| GET /v1/capabilities | Authenticated protocol/output support and own capacity |
| POST /v1/keys | Bootstrap-only issue; returns secret once |
| GET /v1/keys | Bootstrap-only redacted records |
| DELETE /v1/keys/:id | Revoke key and its viewer leases |
| POST /v1/sessions | Idempotent start with Idempotency-Key; returns viewer/job IDs |
| GET /v1/sessions/:id | Authorized session state and safe failure code |
| POST /v1/sessions/:id/renew | Renew this viewer only |
| DELETE /v1/sessions/:id | Idempotent viewer release |
| /media/... | Viewer-authorized media and dependent resources |

Viewer lease: 60 seconds; renewal: 20 seconds; zero-viewer input grace: 15 seconds;
startup deadline: 30 seconds. Operator configuration can override these bounds.
Source ingestion, output processing and viewers are distinct lifetimes. Sharing
includes authorization namespace, credentials/revision and routing requirements;
outputs additionally include the normalized media plan and timeline. Different
raw capability reports may share one identical output. Different VOD positions
are not promised one realtime job. Cleanup must retain admission reservations
until processes have actually terminated.

VIPTV chooses only account-authorized gateways. Existing-job affinity precedes
healthy priority/capacity selection. No hidden fallback to the family gateway,
no backend video-byte relay and no seamless cross-gateway migration in v1.
Native clients use direct delivery by default where compatible and permitted;
direct delivery discloses the input URL/required headers to that device. Roku and
Vizio require gateway delivery as product policy, not forced transcoding.
Remove the 1080p clamp and profile quality cap; retain actual decoder constraints.

SSRF protections apply to source/gateway registration, redirects, DNS resolution,
and every nested playlist resource. Private network access is operator-managed,
never enabled by arbitrary end-user URLs. HTTPS is required on public client /
backend-to-gateway connections. IPTV provider inputs may use HTTP or HTTPS:
HTTP-only providers remain supported, and the gateway can deliver their media
over HTTPS to clients. That does not encrypt the HTTP provider hop. Local
loopback fixtures are explicit test exceptions. Media authorization
must cover child playlists, segments, initialization data, subtitles and keys.

VIPTV playback v2 retains a backend playback ID for progress and renewal. Its
delivery discriminant is `direct` or `gateway`; clients never receive a gateway
administrative key. The coordinated cutover rejects old media/catalog protocol
clients with `client_update_required`; authentication need not be rewritten.

## Xtream, defaults and bounded discovery

The first enabled Xtream connection becomes a persisted account default. Adding
another never switches it. Removing/disabling it selects the oldest remaining
enabled connection for future default requests. An explicitly requested invalid
catalog fails, without silently serving another. API query overrides are per
request; a future per-app swap button is deferred. Source discovery always uses
all enabled connections authorized for the account, independent of live default.

Preserve provider-qualified IDs, ordering, logos and categories. Resolve movie
and exact-episode streams into existing Stremio-style discovery using metadata
IDs, conservative title/year evidence and bounded on-demand series details.
Retain valid VOD identity mappings; never guess ambiguous title/episode matches.

Catalog and unmatched-VOD page default: 50 items; maximum: 200. Use deterministic
opaque cursors bound to the account and filters. Filter in SQL before LIMIT,
never materialize the entire candidate library just to select unmatched rows.
Avoid synchronous full-library counts. Refresh indexes atomically in background,
serving the prior snapshot; clients never synchronize whole playlists.

## Migration and acceptance

### Guide cutover contract (implementation pending)

Existing phone/desktop/TV guide geometry, time window, channel actions, details,
700ms hold and Back/focus restoration stay unchanged. Entry uses the account
default raw playlist. `All channels`, `My channels`, `Recent` and provider
categories are the existing filters; remove US classification and exact counts.
Search matches channel names only: placeholder `Search channels`, empty copy
`No channels match your search.` No swap control or additional viewing UI is added.

Opaque next/previous cursors carry the same catalog/filter/profile/generation
binding. Remote page transitions keep the selected time slot and return to the
prior page's channel; scroll clients retain a bounded moving data/DOM window,
invisible spacers and the exact scroll anchor. Eviction must not trap backward
navigation or require rebuilding a local playlist index. Fetch EPG only for
visible rows plus bounded lookahead. A filter/profile change cancels old work;
late pages/EPG cannot publish into another scope. Snapshot/default changes show
the existing retry/error state, never mix rows or silently pick another playlist.

Watch resolves the exact raw channel to its opaque source, then starts/renews/
releases an ordinary v2 lease. Missing/composite channels remain unavailable;
Roku/Vizio without an authorized gateway show the existing safe error surface.
Guide paging does not change or stop an unrelated active playback. Partial EPG
failure retains playable channels and the existing schedule-gap treatment.

Acceptance: multiple forward/back page crossings, rapid filter/profile changes,
scroll past retained-window limits and back with no position/focus jump; bounded
row/EPG counts; default/snapshot invalidation; terminal/empty/parent/source/gateway
errors; provider order and HTTP logos; live renewal/expiry/foreground/exit. Record
each renderer and native/device evidence independently. No layout parity is
inferred from contract imports or host tests.

No automatic global-provider ownership assignment. An explicit legacy owner map
is required if ownership is ambiguous; unmapped providers cannot become public.
Preserve profile/account IDs, Continue Watching, favorites, history and exact
source identities. Removed composite-channel references remain unavailable
historical records, not guessed remaps. Export retired configuration with schema
version and source revision before operational deletion; never commit exports.

Required evidence: 10k/100k VOD baselines; tenant isolation; 3-provider Stremio
movie/episode resolution; persistent live default/override; five compatible live
viewers sharing one upstream input; distinct-scope isolation; bounded cancellation,
revocation, expiry and crash cleanup; 4K without arbitrary cap; no-gateway errors;
admin/browser/native tests; backup/migration/rollback fixture results. Production
deployment/destructive migration remain separately approved actions.
