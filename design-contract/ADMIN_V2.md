# ADM-002 — account and operator website rebuild

Status: approved for implementation, not deployed. Applies to the `web` account
and administration application, not viewing clients or `/tv`.

## Visual contract

Reuse the current token source, local fonts and assets; do not create a second
palette. Ground #0B0B0C, primary surface #161618, secondary surface #212124,
primary text #F4F2EE, muted text #B6B4AF and default accent #F5C542 correspond to
the canonical tokens. Bricolage is for headings; Onest for rows, forms and status.
The distinctive management language is compact provider/gateway state rows with
clear causes and next actions, not decorative dashboards or promotional heroes.

Desktop reference is 1440x900: 240px labelled navigation, 36px content gutters,
48px controls, existing card/sheet radii and off-white keyboard focus. Below
768px use a 56px header and navigation drawer, 16px gutters and 44px minimum
targets. Dialogs use the existing centred desktop / bottom mobile pattern. No
horizontal overflow at 390px; large data rows collapse into labelled fields.

## Routes and permissions

Account navigation: Account/Profiles, Devices, Continue Watching, My List,
History, Add-ons, Xtream Connections, VOD Matches, Gateways. Operator-only section:
Overview, Accounts, Gateway Grants/Capacity. Remove Family Lineup and Service
Setup. Account-owned registration does not require global operator status;
restricted-profile management retains the existing parent-unlock boundary.

Rebuild sign-in, registration, recovery, account/profile management and device
activation while preserving their tested authentication state machines, URL code
handoff, cookie/CSRF rules and session revocation. No new application login mode.
Configuration forms never pre-fill stored secrets; replacement is explicit.

## VOD matches

Keep the feature. Present Provider, Type, Title, Year, Match status and an action.
Search is debounced 250ms; provider/type filters cancel stale requests and reset
the cursor. Load 50 rows initially and another page near the viewport end; keep
rendered rows bounded. Show no expensive exact-total counter. Opening `Match
title` retains list position and filters and moves focus into its dialog.

Dialog copy: `Match to metadata`, `Metadata ID`, `Type`, `Save match`, `Cancel`.
Save only the selected account-owned source mapping. Disable duplicate submits;
show field/server errors in place. On success say `Metadata match saved`, update
that row without refreshing the entire catalog and return focus to its opener.
Cancel/Back/Escape perform no mutation and restore the originating row. Empty
copy is `No unmatched titles` and filtered-empty copy is `No matching titles`.

### ADM-002-VOD-WINDOW — bounded bidirectional browsing

Status: proposed for web issue 5; functional and rendered acceptance pending.
Applies only to the account/admin VOD matches list at 390x844 and 1440x900.
Retain the visual contract above: native labelled Search titles, Provider and
Type controls; compact rows; existing dialog and focus ring. Desktop rows are
112px tall and phone rows 184px tall in a 60vh scrolling region (minimum 320px).
Long names wrap within the fixed row without horizontal overflow. No new assets.

- Follow every owned-provider metadata page before treating the selection as
  complete, including providers beyond the first 200. Keep raw provider IDs as
  option values. During loading retain available options; a failed metadata page
  shows its safe cause with `Try again`, preserving the selected filter.
- Retain at most three 50-title pages (150 rows), with at most 20 row elements.
  Evict from the opposite edge; retain only scalar visited extent and the three
  pages' cursor metadata. Scroll spacers preserve the travelled range. Scrolling
  back reloads evicted pages via ownership/filter/catalog-revision-scoped opaque
  reverse cursors. No exact-total count, full-catalog copy or historical page map.
- Near either edge load the adjacent page automatically; keyboard Page Up/Down,
  arrows and touch scrolling use the same region. A jump into an evicted spacer
  refills toward the requested position one adjacent page at a time. Keep
  existing rows visible while pending. Announce local `Loading titles…` status.
  A failure preserves rows and position; `Try again` retries the failed direction.
  A stale catalog requires refreshing the list instead of silently skipping rows.
- Search (250ms debounce), Provider or Type changes cancel old requests and
  reset list position. Account changes cancel pending reads and saves, clear
  prior-account rows/provider options/dialog state, and never apply late results.
- Opening `Match title`/`Edit match` freezes paging and retains filters, position
  and its opener. Tab follows the visual controls and rows. Escape, Cancel and
  browser Back close an idle or failed match dialog, make no save, and restore
  position and opener focus. While `Saving…`, disable Cancel/Escape/Back until
  the request settles; a submitted save cannot be undone by dismissing its dialog.
  Bound a stalled save to 30 seconds, then retain edits with an actionable
  timeout and retry. Save errors retain edits; success updates only that row and
  announces `Metadata match saved`. If a removed opener cannot regain focus,
  focus the labelled list region. No hold/repeat-only actions are introduced.

Acceptance IDs: VOD-WINDOW-01 traverses a synthetic encrypted 100k-title catalog
forward and backward with no omitted/duplicate rows and the stated row/DOM and
cursor bounds; VOD-WINDOW-02 selects the 208th owned provider and excludes foreign
providers; VOD-WINDOW-03 covers filter cancellation, retry, stale revision and
account change; VOD-WINDOW-04 covers modal edit/save/error/Cancel/Escape/Back and
scroll/focus restoration at both reference sizes. Record real trusted-HTTPS
backend, functional, visual and browser/device evidence separately. Browser
viewports do not establish physical phone acceptance or production deployment.

## Other interaction requirements

- Add-on rows show the declared icon with a safe placeholder, name and enabled
  state; manifest URLs remain configuration, not diagnostic/log material.
- Xtream connections show sync/availability state and identify the account
  default live playlist. Default changes are explicit and do not stop playback.
- Gateways show authorized registrations/grants and their last verified state.
  Secrets are write-only. Public users cannot see private operator registrations.
- Use actual error reasons and explicit retry/recovery; failed saves retain
  edits. Delete/revoke actions require confirmation and describe their effects.
- No artificial loading cover. Use local row/form loading, preserved data on
  refresh, visible empty/error states and accessible live-region feedback.
- Keyboard Tab order follows visual reading order. Escape closes only the top
  modal/drawer and restores focus. Respect reduced motion.

Acceptance: every account/operator route at 390x844 and 1440x900; keyboard/modal
return; slow/error/empty data; secret redaction; protected-account transitions;
VOD paging with 100k backend rows and bounded DOM. This document scopes the
account/admin app; viewing-client UI changes are permitted under the updated
BE-002 scope and their owning design contracts.
