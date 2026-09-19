# Parked work

Things deliberately not done, with enough context to pick them up cold. Each entry says why it
was deferred, because that is usually the part that gets forgotten.

---

## Renaming the GitHub repository

The product is called **Joy for Maths**; the repository is still `KateSant/real-maths`, as are the
GHCR image paths. Renaming is a coordinated operation rather than a rename, and doing it while
another agent is working risks a failed deploy, so it waits.

**Order matters — the trust policy must permit the new name before the repository changes**, or CI
fails in the gap between the two:

1. **Add** the new subject to the IAM role's trust policy *alongside* the existing entries, so both
   names work:

   ```
   repo:KateSant@*/joy-for-maths@*:ref:refs/heads/main
   repo:KateSant@*/joy-for-maths@*:environment:production
   ```

   Check it with `aws iam get-role --role-name realmaths-github-ci --profile admin` first — the
   current policy hardcodes `real-maths`, and a renamed repo presents a different OIDC subject
   claim, so the role would simply refuse to be assumed.

2. **Rename** the repository (`gh repo rename joy-for-maths`).
3. **Update the remote in every worktree**, not just one. `git remote set-url origin …`, in
   `/Users/kate/maths` and `/Users/kate/maths-admin`.
4. **Trigger a deploy.** Images move to `ghcr.io/katesant/joy-for-maths/*`. The deploy step already
   rewrites `IMAGE_API`/`IMAGE_WEB` in the host's `.env`, so the host follows on its own.
5. **Remove** the old subjects from the trust policy once a deploy is green.
6. Old GHCR image paths can be deleted at leisure; nothing references them after step 4.

Nothing user-facing changes: `maths.thinktalkbuild.com` and the Lightsail instance are unaffected.

Not worth renaming at the same time, and probably not ever:

- `com.realmaths` across 76 files, the `realmaths.*` config prefix, `realmaths.db` and the
  `REALMATHS_*` environment variables. Invisible to users, and the env vars would mean touching the
  workflow, the host's `.env` and the compose file in step to change nothing anyone can see.
- The `realmaths.token` and `realmaths.theme` localStorage keys, which would sign everyone out and
  reset their theme.
- The Terraform state bucket, the Lightsail instance name and the CI role. These are baked into a
  live deployment; renaming them is a migration.

The README and the docs still say "Real Maths" in prose.

---

## The admin screens have no automated tests

The frontend suite is pure logic with no DOM environment, so the admin pages are verified by
typecheck, build and reading — not by assertion. Adding jsdom and a component-test library would
fix it, at the cost of the first new frontend dependency in the project.

Until then, anything touching the editor is worth a manual pass. The paths most worth checking are
listed in the section below.

---

## Publishing the Google OAuth app

Currently optional and deliberately skipped. An app requesting only basic identity scopes is exempt
from the trusted-list restriction, so sign-in works for anybody with the app still in *Testing* and
no branding filled in.

It stops being optional the day we request any scope beyond `openid`, `email` and `profile` — Google
Classroom being the plausible one — because the exemption is attached to the scopes. At that point:
verify `thinktalkbuild.com` with a TXT record at Squarespace, fill in Branding, publish. Google will
also want a homepage and privacy-policy URL, so **the privacy policy page would need to come back**
(it is in git history).

---

## The privacy policy

Removed at the product owner's request and not required while the app is unpublished. Worth
revisiting if it is ever used by a class: a service storing children's names, email addresses and
answers needs a privacy notice under UK GDPR regardless of what Google asks for.

---

## A case-insensitive unique index on `users.email`

SQLite's `UNIQUE` index is case-sensitive, so `Susan@x.com` and `susan@x.com` can coexist even
though the application treats them as one address. Every write path lowercases before storing, so it
has not happened — but the database does not enforce what the code assumes.

`make-admin.sh` refuses to act when a lookup matches more than one account, which turns a silent
overreach into an error. A `COLLATE NOCASE` unique index would close it properly: one migration and
a test.

---

## Guest progress is lost on signing in with Google

A student who practises as a guest and later signs in gets a fresh account — streak and points are
stranded, and there is no way back into the guest account because it has no identity row. Fine for a
prototype; a "why did my points disappear?" email in real use. The fix is an explicit
"link this guest account" step, which is a feature rather than a config change.

---

## Coverage dashboard

Questions per topic and difficulty, and "topics that cannot fill a five-question quiz". Cheap from
the existing count query and genuinely useful to a teacher, but not needed for the demo. See
`content-admin-architecture.md`.
