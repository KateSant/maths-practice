# Parked work

Things deliberately not done, with enough context to pick them up cold. Each entry says why it
was deferred, because that is usually the part that gets forgotten.

---

## The admin screens have no automated tests

The frontend suite is pure logic with no DOM environment, so the admin pages are verified by
typecheck, build and reading — not by assertion. Adding jsdom and a component-test library would
fix it, at the cost of the first new frontend dependency in the project.

Until then, anything touching the editor is worth a manual pass. The paths most worth checking are
listed in the section below.

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
