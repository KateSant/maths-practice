# Sign in with Google

**Status:** built. See §7 for what is verified, and what still needs a browser or the infra workstream.

Small terminology note: this is "Sign in with Google" (OIDC), not Gmail. It works for
`@gmail.com` accounts, Google Workspace school accounts, and Google accounts on third-party
addresses. That last case matters later (see §7).

---

## 1. Which Google flow, and why

Two ways to do this, and they are not interchangeable.

| | A. Browser gets an ID token, posts it to us | B. Server-side redirect flow (`oauth2Login`) |
|---|---|---|
| How | Google Identity Services renders the button in our page; on success we POST the ID token to `POST /api/auth/google`; we verify it and issue our own JWT. | Backend redirects to Google, Google redirects back, backend exchanges the code using the client secret, then issues a JWT. |
| Session | **None.** Stateless, as now. | Needs a session (or cookie) for the `state` parameter and the callback. |
| CSRF | Stays **disabled** — no cookies involved. | Cookies come back, so CSRF protection has to come back too. |
| Secret | None. Public client. | Client secret to store and rotate. |
| Fits current code | Exactly. Bearer token, `SecurityConfig` unchanged in spirit. | Requires reworking the stateless assumption. |
| Gives us | Identity only. | Identity **plus** access/refresh tokens for Google APIs. |

**Recommendation: A.** The existing auth design is stateless JWT with `csrf` disabled *because*
no cookie is used — option B would undo that and drag CSRF back into every mutating endpoint,
including the new admin ones. A gives up nothing we need, because we only want identity.

The one thing B would buy is refresh tokens for calling Google APIs later. The plausible future
reason is Google Classroom integration (importing a class list, pushing scores). If that becomes
a real goal, we would add the authorization-code flow *alongside* A, with a separate incremental
consent prompt — not replace A. Worth knowing, not worth building now.

### The shape that matters

Google is only a way to obtain or create the local `users` row. Everything downstream — points,
streaks, progress, `role`, the admin gate — is untouched. `JwtService.issueFor(user)` keeps
issuing *our* HS256 token, so `JwtToUserPrincipalConverter` does not change at all, and neither
does any existing test.

---

## 2. What you need to set up in Google

Roughly ten minutes. No billing, no verification, and the client secret is never needed.

### 2.1 Create a project

1. <https://console.cloud.google.com> → project picker → **New project** (e.g. "Real Maths").
2. No APIs need enabling for sign-in. Billing is not required.

### 2.2 Configure the consent screen ("Google Auth Platform")

The old "OAuth consent screen" page is now **Google Auth Platform**. Click **Get started**.

| Field | Value |
|---|---|
| App name | Real Maths |
| User support email | Her email |
| **Audience / User type** | **External** — *Internal* is only an option if she has a Workspace org and we want to restrict sign-in to that organisation. |
| Contact information | Her email |

Then, under **Audience → Test users**, add her Gmail and anyone else who needs to try the demo.

**Keep publishing status as "Testing".** This matters:
- No verification process, no review, no privacy-policy paperwork.
- Up to 100 test users, listed explicitly.
- Sign-in only works for accounts on that list, which is a useful accidental safety net.

She may see a "Google hasn't verified this app" notice during sign-in. That is normal while in
Testing and is not a problem to click through in a demo.

We only request `openid`, `email` and `profile`. Those are **non-sensitive** scopes, so even if
we later publish, Google's sensitive-scope verification does not apply. This is the reason to
resist any future scope creep: adding "just read their calendar" changes the compliance story
completely.

### 2.3 Create the OAuth client

**Clients → Create client** (or **Create credentials → OAuth client ID**):

| Field | Value |
|---|---|
| Application type | **Web application** |
| Name | Real Maths web |
| **Authorized JavaScript origins** | `http://localhost:5174` now; `https://<prod-domain>` when deployed |
| Authorized redirect URIs | **Leave empty** |

Two details that catch people out:
- Origins are **scheme + host only** — no trailing slash, no path. `http://localhost:5174`,
  not `http://localhost:5174/`.
- Redirect URIs are only needed for the redirect-based flow (option B). For the button +
  ID-token flow they are genuinely unused, and leaving them empty is correct.

Then copy the **Client ID**. It looks like `1234567890-abc123.apps.googleusercontent.com`.

### 2.4 What to send me

- The **Client ID**.
- ~~Confirmation of the eventual production hostname~~ — deferred; she'll add `https://<domain>` to the
  same client's JavaScript origins once the domain is settled.

### 2.5 Setup status

Done in the Google Cloud project **Real Maths**:

- [x] Project created
- [x] Google Auth Platform wizard completed: app name *Real Maths*, audience **External**
- [x] Publishing status **Testing**, owner added as a test user
- [x] OAuth client created, type *Web application*, no redirect URIs
- [x] JavaScript origins: `http://localhost:5174` and `https://maths.thinktalkbuild.com`
- [x] Client ID captured:
      `570846584369-dm7ev6ff9gil8h3krc9a37ur47uvt149.apps.googleusercontent.com`
      (the `570846584369` prefix is the Cloud project number — also public)
- [x] Sign-in verified live with an account that is on **no** test-user list
- [ ] Optional: verify `thinktalkbuild.com` and publish the app — not required, see §7

**The test-user list turned out not to matter.** Publishing status is still *Testing*, the
Console still warns that only listed accounts can sign in, and sign-in nevertheless works for
anyone. An app requesting only basic identity scopes is exempt from that restriction. So
there is no allowlist step before a demo.

Config keys it has to land in, and they must match — the backend rejects a token whose `aud` is not
this value:

```
VITE_GOOGLE_CLIENT_ID              # frontend, inlined at BUILD time — see §6
REALMATHS_GOOGLE_CLIENT_ID         # backend, checked against the token's aud claim
```

This is a **public** identifier, not a credential: it is visible in the browser bundle and in every
consent request. Committing it is fine, and nobody should later mistake it for a leak or try to
rotate it. The matching *client secret* was deliberately never created.

A 2-step verification prompt when first opening Cloud Console is expected: Google requires it on
all accounts.

The client ID is **public by design** — it ships in the browser bundle. It is not a secret and
neither of us should treat it like one (contrast `REALMATHS_JWT_SECRET`, which is). It still
needs to be configured in two places and they must match: the frontend build
(`VITE_GOOGLE_CLIENT_ID`) and the backend (`realmaths.google.client-id`), because the backend
checks the token's `aud` claim against it.

**Don't create or download a client secret.** We have nowhere to put it and no use for it.

---

## 3. Backend plan

### 3.1 Migration (`V3`)

```sql
-- Passwords go away entirely: no hash, no bcrypt, no reset flow, no breach exposure.
alter table users drop column password_hash;

create table user_identities (
    id                integer primary key autoincrement,
    user_id           integer      not null references users (id) on delete cascade,
    provider          varchar(30)  not null,   -- 'google'
    subject           varchar(255) not null,   -- Google's 'sub'
    email_at_provider varchar(255),
    created_at        timestamp    not null default (unixepoch() * 1000),
    last_login_at     timestamp,
    unique (provider, subject)
);

create index user_identities_user_idx on user_identities (user_id);
```

`unique (provider, subject)` is the load-bearing constraint. It is what makes "same Google
account, twice" provably one user row.

SQLite has supported `drop column` since 3.35 and `sqlite-jdbc` here is 3.49, so that is fine.
**Coordinate this migration with whoever is touching `users`** so we don't end up with two
competing `V3`s.

Dropping the column — rather than making it nullable — is the right call given there are no
users yet. It deletes the whole class of problem the user is trying to escape. Break-glass
access is `sqlite3` on the box.

### 3.2 Verify the ID token

Google's own checklist, which we should implement literally:

- **Signature** — Google's public keys at `https://www.googleapis.com/oauth2/v3/certs`. Rotated
  regularly; Nimbus caches them and honours `Cache-Control`.
- **`aud` equals our client ID.** Not optional: without it, an ID token minted for *any other
  app* could be replayed at our endpoint.
- **`iss` is `accounts.google.com` *or* `https://accounts.google.com`.** Both forms occur in the
  wild, so accept both. A single-value issuer check here is a real, easy bug.
- **`exp` has not passed.**
- **`email_verified` is true**, if we use the email at all.

Implementation: `NimbusJwtDecoder.withJwkSetUri(...)`, constructed inside the verifier service.
No new dependency — `spring-boot-starter-oauth2-resource-server` already brings `oauth2-jose`.

### 3.3 The pitfall to avoid

`JwtConfig` defines **one** `JwtDecoder` bean, and `oauth2ResourceServer().jwt()` consumes it.
Adding a second `JwtDecoder` bean for Google is a trap: with two candidates, either Spring fails
to start with an ambiguous dependency, or we wire it explicitly and risk making Google's decoder
the one that authenticates *API* requests — at which point any Google ID token becomes a valid
API credential.

So: **build the Google decoder inside the verifier as a plain field, not as a bean.** Exactly one
`JwtDecoder` bean continues to exist, and there is no way to wire it up wrongly.

Guard it with a test anyway (§5), because this is precisely the kind of thing a future refactor
reintroduces while looking tidy.

### 3.4 Sign-in and account linking

`POST /api/auth/google` with `{ "idToken": "..." }`, in one transaction:

1. Verify the token (above). Any failure → 401, with no detail about which check failed.
2. Look up `user_identities` by `(provider='google', subject=sub)`.
   - **Found** → that user. Refresh `email_at_provider` and `last_login_at`.
   - **Not found** → continue.
3. Optionally link to an existing user by email — **only if Google is authoritative for the
   address.** Google's rule, which is more subtle than it first appears: Google is authoritative
   when the address is `@gmail.com`, *or* when `email_verified` is true **and** the `hd` (hosted
   domain) claim is present. Otherwise the user attached a third-party email to a Google account
   at some point and ownership may have changed since — linking on that is an account-takeover
   vector.
4. Otherwise create a `users` row (`displayName` from `name`, `role = STUDENT`) plus the
   `user_identities` row.
5. Issue our own JWT and return the same `AuthResponse` shape as today.

**Key on `sub`, never on email.** `sub` is Google's stable per-account identifier; email is
mutable and reassignable. The `unique (provider, subject)` constraint enforces this rather than
leaving it to discipline.

Optional: a `realmaths.google.allowed-domains` list, checked against `hd`, to lock sign-in to one
school domain. Cheap to add, and useful if she wants only her students. Default: empty (any
Google account).

### 3.5 Guest accounts

The current "Quick start as a guest" fakes a `guest_xxx@realmaths.local` email and password. With
passwords gone it needs its own endpoint: `POST /api/auth/guest` creating a user with no identity
row and no email, and issuing a JWT.

This is a genuine improvement — guest accounts become explicit rather than a synthetic email
pretending to be one. Two rules:
- A guest can never be promoted to `ADMIN`. Holds automatically: the promotion path is us
  running SQL against a real email.
- Guests are not linkable to a Google identity for now. Which surfaces a product question in §6.

### 3.6 What gets deleted

- `/api/auth/register` and `/api/auth/login`.
- `AuthService`'s bcrypt comparison, the `dummyHash` timing-attack defence, and
  `PasswordEncoder` in `SecurityConfig`.
- The corresponding tests, replaced by the Google ones.

Worth noting this is a net deletion of security-sensitive code: no password storage, no
credential stuffing surface, no reset flow, no breach notification. That is the real win, more
than the convenience.

Also: `users.email` becomes nullable (guests have none). And `email` stays unique where present —
SQLite permits multiple NULLs in a unique column, which is what we want, but worth an explicit
test since it is exactly the sort of thing that differs between databases.

---

## 4. Frontend plan

- `frontend/src/auth/google.ts` — loads `https://accounts.google.com/gsi/client` **dynamically**
  (not a hard-coded tag in `index.html`) so load failure is catchable and tests don't need the
  script. Exposes `renderGoogleButton(element, { clientId, onCredential })`.
- `LoginPage` — the email/password form and the signin/register toggle come out; the Google
  button goes in, above a still-present "Quick start as a guest". If
  `VITE_GOOGLE_CLIENT_ID` is missing, or the script fails to load (ad blocker, offline), show a
  plain message and leave the guest path working, rather than an empty box.
- `AuthContext` — `login`/`register` are replaced by `signInWithGoogle(idToken)` and
  `continueAsGuest()`. Otherwise unchanged.
- `api/client.ts` — two new calls; `AuthResponse` and the `types.ts` contract do not change.
- **`session.ts` does not change at all** — we still store our own JWT. That is the payoff of
  option A: Google never touches token storage.

Use the explicit rendered button rather than One Tap / auto-prompt. One Tap adds FedCM
behaviour, browser-specific prompt suppression, and a UI we don't control, which is a poor trade
for a prototype we want to demo predictably.

---

## 5. Tests

Backend, using a locally generated RSA keypair and an in-memory JWK set so nothing touches the
network:

- Verifier: valid token accepted; wrong `aud` rejected; wrong `iss` rejected; expired rejected;
  tampered signature rejected; `email_verified: false` rejected.
- Both issuer forms (`accounts.google.com` and `https://accounts.google.com`) accepted — a
  single-value check passes every other test and fails only in production.
- Identity: same `sub` twice → one user, one identity row; new `sub` → new user; authoritative
  email collision → linked; non-authoritative email collision → not linked.
- Email uniqueness: several guest accounts with `NULL` email coexist.
- **A valid Google ID token is rejected as an `Authorization: Bearer` credential.** The §3.3
  guard, asserted rather than assumed.
- `/api/auth/google` and `/api/auth/guest` are `permitAll`; no auth payload can set `role`.

Frontend: a stubbed `window.google` to assert the button posts the credential and that script
failure degrades to a message rather than a blank panel.

---

## 6. Config and build plumbing

This is the one part that crosses into the infra workstream, so it is worth agreeing early.

The client ID has to reach two processes by two different mechanisms:

| | Mechanism | Why |
|---|---|---|
| Frontend | **Build-time** env var `VITE_GOOGLE_CLIENT_ID` | Vite inlines `import.meta.env.*` into the bundle at build time. It is *not* available at runtime, so setting it on the container does nothing. |
| Backend | Runtime env var `REALMATHS_GOOGLE_CLIENT_ID` | Read by Spring at startup to validate the `aud` claim. |

The frontend one is the awkward bit and the reason this section exists:

- `frontend/Dockerfile` needs `ARG VITE_GOOGLE_CLIENT_ID` + `ENV` set **before** `npm run build`.
- The GitHub Actions workflow needs to pass it as a **build arg**, not an `environment:` entry on the
  compose service — a runtime env var silently yields a bundle with a missing client ID, and the
  Google button then just renders an error instead of failing the build.
- Failing loudly is better: if `VITE_GOOGLE_CLIENT_ID` is unset at build time, `npm run build` should
  fail rather than ship a broken login page. Worth an explicit check.

Deploy-order note: **register the production origin in Google before the first deploy**, not after. A
missing origin is a client-side rejection from Google's own script, so it presents as a broken button
with nothing useful in our logs — an unpleasant thing to debug on a live box.

Because the value is baked into the frontend image, changing the client ID means rebuilding and
redeploying the web image. That is fine (it will effectively never change), but it is the reason not
to treat this like a normal runtime setting.

---

## 7. Implementation status

Built and passing: 43 backend tests (up from 18), 13 frontend, `tsc` clean.

| | |
|---|---|
| `V3__google_sign_in.sql` | Drops `password_hash`, adds `user_identities` with `unique (provider, subject)` |
| `GoogleIdTokenVerifier` | Signature, `aud`, `iss`, `exp`, `email_verified`, optional `hd` domain check |
| `AuthService` | Identity resolution, linking, guest accounts |
| `AuthController` | `POST /api/auth/google`, `POST /api/auth/guest` |
| Deleted | `/auth/register`, `/auth/login`, bcrypt, `PasswordEncoder`, `LoginRequest`, `RegisterRequest` |
| Frontend | `auth/google.ts`, rewritten `LoginPage`, `AuthContext`, two new client calls |

Two bugs surfaced while building, both worth recording:

1. **`jwt.getIssuer()` rejected real Google tokens.** Spring models the issuer as a `URI`,
   and Google issues the scheme-less `accounts.google.com` form as well as the URL form. The
   verifier now reads the raw `iss` claim. This would have failed in production and passed
   every test that only used the URL form — one test now covers both.
2. **Unknown paths returned 500, not 404** (pre-existing, unrelated to Google).
   `NoResourceFoundException` was being swallowed by `GlobalExceptionHandler`'s catch-all,
   logging a stack trace at ERROR for every mistyped URL. Fixed in the exception handler,
   with an assertion in `AuthWiringTest`.

A third was found only by signing in on the live site, after a green deploy:

3. **The API container never received the client ID.** The web bundle had it — the button
   rendered and Google issued a credential — so every token was refused at the last hop with
   "Google sign-in is not configured on this server." Two causes: `docker-compose.prod.yml`
   had no `REALMATHS_GOOGLE_CLIENT_ID`, and the deploy step only `sed`-replaced keys already
   present in the host's `.env`, so `sed` silently did nothing for a key that was absent.
   Now upserted (replace if present, append if not) and set as a *required* variable, so a
   future omission fails the container start rather than half-working sign-in.

   The lesson is about the smoke test, not the config: it only fetched URLs, and GETs answer
   normally with a blank client ID. It now POSTs a junk token to `/api/auth/google` and
   requires 401 ("tried to verify and refused") rather than 503 ("not configured"), which is
   the difference a green deploy was hiding.

### Verified

- `V3` applies to an **existing** database (v2 → v3) — the real deployment path, not just a
  fresh one.
- The app boots with `ddl-auto: validate`, so the entities match the migrated schema.
- Guest sign-in → our JWT → `/api/me` → dealing a quiz, end to end against a running server.
- A junk Google token is rejected with 401, and a valid Google token cannot be used as a
  `Bearer` credential (only one `JwtDecoder` bean exists, asserted).

### Verified in the browser

Sign-in works end to end on `https://maths.thinktalkbuild.com` with a real Google account,
including the live round trip to Google's JWKS endpoint and the rendered button. Spot-check
it again after any change to the verifier's claim handling, since that path is the one the
unit tests cannot fully stand in for.
### Still needs doing

Nothing blocking. All three items originally listed here are resolved:

- ~~`VITE_GOOGLE_CLIENT_ID` in the CI build~~ — added, and now smoke-tested, since a
  missing client ID was invisible to the old checks.
- ~~The production origin in Google~~ — added; sign-in verified live on the real domain.
- ~~The teacher's Gmail on the test-user list~~ — **not needed, and this was the open
  question this document kept hedging on.** Publishing status stays *Testing* and sign-in
  still works for an account that is on no list, because an app requesting only basic
  identity scopes is exempt from the trusted-list restriction. Confirmed empirically by
  signing in with an account that was never added.

So there is no allowlist step before a demo: send the link and it works. The tradeoff
worth remembering is that **the exemption is attached to the scopes we request.** The
day we ask for anything beyond `openid`, `email` and `profile` — Google Classroom being the
plausible future case — the app falls back under the restriction and the test-user list
bites again, now with 100-user cap. Publishing removes that tripwire, and is worth doing
before real students rather than during. It needs the `thinktalkbuild.com` TXT
verification, Branding links, and a privacy-policy contact address that actually resolves.

Two smaller notes:

- **Anyone with a Google account can sign in.** Fine, and probably what you want, but there
  is no invite gate. If access ever needs restricting to one school, `realmaths.google.
  allowed-domains` checks the `hd` claim and costs no code.
- **Every sign-in creates a real account in the production database.** Signing in as a
  friend or relative leaves a user row behind; harmless, but the database now has real
  accounts in it rather than only seed data.

## 8. Open questions

1. **Students without Google accounts.** This is the real product risk of Google-only sign-in.
   Some students have no Google account, and some schools block third-party sign-in entirely. The
   usual fallback that also avoids password hashes is **magic links** (email a one-time link) —
   still no passwords, but it needs SMTP, which is new infrastructure. Worth asking her what her
   students actually have before we lock this in.
2. **Does guest progress survive signing in with Google?** Today a student who plays as a guest
   and later signs in gets a fresh account — their streak and points are stranded. For a demo
   that's fine; for real use it's a "why did my points disappear?" email. The fix is an explicit
   "link this guest account" step, which is a feature, not a config change.
3. **Restrict to a school domain?** Optional `hd` check (§3.4). Only answerable once we know
   whether her students use Workspace accounts.
4. **Production origin registration timing.** The hostname has to be in Authorized JavaScript
   origins or sign-in fails on the deployed site. Whenever the domain is settled, that's a Google
   Console change ahead of the first deploy.
