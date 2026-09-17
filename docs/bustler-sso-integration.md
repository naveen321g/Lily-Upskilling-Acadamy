# Bustler ↔ LUA SSO Integration Contract

Status: **not implemented — this is the contract to hand to Bustler's engineering
team before any code here can be finished.** LUA has no OAuth client ID,
secret, or signing key for Bustler today. Nothing in this document is live.

## What already works today

Bustler can already deep-link a user into LUA with a skill/category
pre-filled, once that user is signed in to LUA:

```
https://<lua-host>/assessments?skill=<catalog-slug>&category=<category-name>
```

`skill` matches LUA's internal catalog `slug` (see `src/lib/assessment-shared.ts`
/ the `skills` table), not a Bustler-side ID. This pre-fills the search box,
scrolls to and highlights the matching skill, and shows a "Continuing your
verification" banner. See `src/routes/_authenticated/assessments.index.tsx`.

What's missing is the actual **"Bustler account, no separate registration"**
part — today a user still has to sign up/sign in to LUA separately (email or
Google) before that deep link is useful.

## Proposed flow: signed assertion, not full OAuth

Because Bustler and LUA are a first-party partnership (not LUA consuming a
public third-party OAuth provider), a full OAuth2 authorization-code dance is
more machinery than the trust relationship needs. The simpler, standard
pattern for this ("service A already has the user logged in, hands them to
service B with a signed proof of identity") is a short-lived signed JWT
assertion:

1. A Bustler user, already signed in to the Bustler app, taps "Verify Skill"
   for a category+skill they've entered.
2. **Bustler's backend** mints a short-lived JWT (suggest 2–5 minute expiry)
   signed with an asymmetric key (RS256/ES256 — Bustler holds the private
   key, LUA only ever holds the public key) containing the claims below.
3. Bustler redirects the user's browser/webview to:
   ```
   https://<lua-host>/auth/bustler?token=<jwt>&skill=<slug>&category=<name>
   ```
4. LUA verifies the JWT (signature, `exp`, `aud`), then either finds an
   existing LUA account linked to that Bustler user or provisions one, and
   establishes a normal Supabase session — after which the user lands on
   `/assessments?skill=...&category=...`, already signed in.

### Required JWT claims

| Claim | Type | Meaning |
|---|---|---|
| `iss` | string | Fixed value identifying Bustler, e.g. `"bustler"` |
| `aud` | string | Fixed value identifying LUA, e.g. `"lily-upskilling-academy"` |
| `sub` | string | Bustler's stable internal user ID — this is the identity LUA links against, **not** email (emails can change/be reused) |
| `email` | string | Current email on the Bustler account, used only to prefill/display, not as the link key |
| `full_name` | string | Display name |
| `iat` / `exp` | number (unix ts) | Issued-at / expiry — LUA rejects anything with `exp` more than ~5 minutes out or already expired |
| `jti` | string | Unique token ID — LUA should track recently-seen `jti`s briefly to reject replay of a captured URL |

### What LUA needs from Bustler to implement this

- [ ] Bustler's JWT signing public key (or a JWKS URL LUA can fetch/cache it from)
- [ ] The fixed `iss` string Bustler will use
- [ ] Confirmation of signing algorithm (RS256 or ES256 preferred over HS256 —
      asymmetric means LUA never holds a secret that could mint fake Bustler
      identities if leaked)
- [ ] A staging/sandbox signing key + a way to mint test tokens, before
      production credentials are exchanged

### What LUA still has to build once the above exists

- `src/routes/auth.bustler.tsx` — receives `?token=&skill=&category=`,
  verifies the JWT server-side (a `.server.ts` file, never in a
  `.functions.ts`/client-reachable module — this must never accept an
  unsigned or client-supplied identity claim)
- Account linking: add a `bustler_user_id text unique` column to `profiles`
  (new migration), looked up on every assertion; if no match, provision a new
  Supabase auth user via the service-role admin API
  (`supabaseAdmin.auth.admin.createUser`) and create the linked `profiles` row
- Session establishment for an already-verified identity — likely
  `supabaseAdmin.auth.admin.generateLink` (magic-link style) redeemed
  server-side, since there's no password to check
- Replay protection (track `jti`, e.g. a short-TTL table or cache)
- Decide the account-conflict story: what happens if the Bustler-supplied
  email already belongs to a LUA account that signed up independently
  (matching by `sub` avoids most of this, but a first-link flow still needs a
  clear decision)

## Reverse sync: LUA → Bustler (badge events)

The spec also wants verified badges to show on the Bustler profile. That
direction needs the mirror image of this contract — a webhook LUA calls when
a badge is issued or revoked:

```
POST https://<bustler-host>/webhooks/lua-badge-event
{
  "bustlerUserId": "...",   // from profiles.bustler_user_id
  "skillSlug": "...",
  "badgeType": "ai" | "certificate",
  "status": "active" | "revoked",
  "occurredAt": "2026-08-14T12:00:00Z"
}
```
signed the same way in reverse (LUA holds a private key, Bustler holds LUA's
public key), so Bustler can trust the event actually came from LUA. The call
sites already exist and are unambiguous: `issueBadge()` and
`revokeBadgeAdmin()`/`reissueBadgeAdmin()` in `src/lib/badges.server.ts` are
exactly where this webhook call would be added once Bustler's endpoint and
public key exist.

## Summary checklist before this can be built

- [ ] Bustler's public signing key or JWKS URL
- [ ] Agreed `iss`/`aud` strings and token TTL
- [ ] Bustler's webhook endpoint + public key for the reverse badge-sync direction
- [ ] A decision on the account-conflict case above
- [ ] Sandbox credentials to build and test against before going live
