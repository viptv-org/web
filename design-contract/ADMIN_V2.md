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
VOD paging with 100k backend rows and bounded DOM; no viewing-client redesign.
