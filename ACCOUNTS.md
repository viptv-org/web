# Public account dashboard

The dashboard is account-only. It has no shared API-token field, bootstrap claim, Advanced workspace, or bearer fallback. Browser credentials remain in Secure/HttpOnly/SameSite cookies; JavaScript keeps only the current CSRF value in memory. Account or recovery secrets and device codes are never written to localStorage or sessionStorage.

## Public gateway

- `GET /auth/status` determines whether an HttpOnly browser session can be restored.
- `POST /auth/register {username,name,password}` is public and returns a browser session plus one-time recovery material. The user must explicitly acknowledge those codes before continuing.
- `POST /auth/login {username,password}` and `POST /auth/recover {username,recovery_code,password}` provide sign-in and recovery.
- A fresh account has zero profiles and proceeds to avatar-backed profile creation.

`/device?code=…` is the canonical TV QR destination; `/activate?code=…` is accepted for compatibility. A bounded alphanumeric code is held only in React/router memory and remains visible through login or registration. An authenticated visitor goes directly to authenticated lookup/review, then `POST /device/approve {user_code}`. The account comes from the browser session—there is no target-account or grant selector. Invalid or expired codes offer a safe return to profiles.

## Profiles and avatars

- `GET /profiles` returns account-owned profiles. `POST /profiles {name,avatar_style}` creates one; no profile is synthesized during registration.
- Imported profiles with `setup_complete:false` must be renamed and assigned an avatar with `PATCH /profiles/:id {name,avatar_style,setup_complete:true}` without changing their ID or history.
- The allowlist is `critters`, `pixel-art`, `pixel-art-neutral`, `moods`, `thumbs`, `lorelei`, and `notionists` from DiceBear 10.x. The browser accepts only matching `https://api.dicebear.com/10.x/.../png` URLs, sends `Referrer-Policy: no-referrer`, and falls back to profile initials on failure. It never sends cookies or account credentials to DiceBear.
- `POST /auth/profile {profile_id}` makes the server session selection. The browser does not persist profile IDs or credentials in web storage.

## Signed-in workspace

The responsive workspace groups Discover, Live guide, My library, and Settings around the active profile. Settings presents account identity, profile/privacy/accessibility guidance, and account-owned television sessions. Owners retain separate service-health, provider, addon, metadata-match, account, and service-default administration sections. Signing out calls the server and clears all in-memory account/profile state.

The document head declares `<meta name="referrer" content="no-referrer">`; production should also return the HTTP `Referrer-Policy: no-referrer` header.
