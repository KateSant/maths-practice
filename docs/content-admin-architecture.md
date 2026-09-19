# Content admin: prototype plan

**Status:** the backend is built (§9). The admin screens are next.
**Goal:** let a maths teacher add and change quiz questions through a UI, so we can *show her
the workflow* rather than describe it.

**Context that shapes every decision below:** there are no users yet, and no real content.
The prototype's purpose is to demonstrate how we could work together.

## The one thing we're optimising for

The demo loop: **she changes a question, then immediately sees it as a student.** Everything
below exists to make that loop short and convincing. Anything that does not serve it is
deferred, however correct it might be in production.

Concretely, the moment we want on screen: she retypes question 7 to something from her own
scheme of work, hits Publish, opens the quiz, and is asked *her* question. That is the whole
sales pitch — that the content is hers and it is live.

---

## Scope

### Build now

| | Why |
|---|---|
| **Admin role** — a `users.role` value that we set ourselves | She cannot demo anything without it. No schema work. See §1. |
| **A rule, not code: migrations stop owning content** | Free. Prevents us building the wrong mental model. See §2. |
| **`DRAFT` / `PUBLISHED` on questions** | She will want to start a question and finish it later. Showing her this is part of the demo. |
| **Provenance flag on questions** | Two columns, and now is when it's free. See §2. |
| **Admin API** — list, create, update, publish, retire | The substance. |
| **Question editor** with live preview using the real quiz render path | The demo. Preview must be truthful. |
| **Topic editing** | She will want to rename "Number & Place Value" to her own wording. |
| **CSV import + export** | Highest-value thing after the editor, if her content is in a spreadsheet. See §6. |

### Deferred, deliberately

| | When it becomes real |
|---|---|
| Session content snapshots (freezing what a student saw) | The moment real students have answered real questions. |
| `question_revisions` audit trail + revert | When she starts editing questions students have already seen, or a second teacher authors. |
| DB trigger refusing deletes of served questions | Same trigger point. Pre-users, "delete" is fine. |
| Optimistic locking / 409 on concurrent edits | When it's used in two tabs by someone who cares about the loss. |
| Per-author attribution (`created_by`) | When more than one teacher authors. |
| Coverage dashboard | Nice-to-have; cheap from an existing query, but not the demo. |

This is all still written up in §7 so the thinking is not lost.

---

## 1. The admin role: a column in the database, managed by us

Simplest thing that works. `users.role` already exists, `Role.ADMIN` is already in the enum, and
`V1` already constrains the values:

```sql
role varchar(20) not null default 'STUDENT',
check (role in ('STUDENT', 'TEACHER', 'ADMIN'))
```

So storing the role is **no schema work at all**. We manage it ourselves, in the database.
Granting admin is one statement:

```bash
# after she has signed in once, so the row exists
sqlite3 backend/data/realmaths.db "update users set role = 'ADMIN' where email = 'jo@example.com';"
```

Worth wrapping in `scripts/make-admin.sh <email>` so it is repeatable and nobody has to remember
the db path or pragma details.

**Why this works rather than being a shortcut to regret:** `JwtToUserPrincipalConverter`
re-reads the `users` row on every request and builds the authorities from it — not from the
token. So the change takes effect on her *next request*: no re-login, no reissued token, no cache
to clear, and no stale role anywhere. The role is DB-backed by construction; we are only choosing
to write it with `sqlite3` instead of building account-management UI for one person.

Nothing reads the JWT `scope` claim for authorisation today and nothing should start. That claim
is decorative (`JwtService` sets it to the role name); the row is authoritative. Worth a comment
in `JwtService` saying so — when social sign-in lands, an IdP may want `scope` for its own
purposes, and it would be easy to mistake it for a permission source.

The tradeoff we are accepting: a database restore rolls the role back with everything else. That
matters once there is a real restore procedure and real student data — not now.

### Enforcement

One line in `SecurityConfig`, above the existing `anyRequest().authenticated()`:

```java
.requestMatchers("/api/admin/**").hasRole("ADMIN")
```

URL-based rather than `@PreAuthorize`, because there is one admin subtree and one role — method
security would be more moving parts for no gain. Add `@EnableMethodSecurity` only if we later need
an ADMIN-only endpoint *inside* the prefix (account management, say).

The useful property of gating on the path prefix: a new admin controller is protected by virtue
of where it lives. The failure mode to guard against is an admin endpoint mounted *outside*
`/api/admin/**`, which `.anyRequest().authenticated()` would happily expose to any signed-in
student. So keep every admin controller under that prefix, and add a parameterised test that
enumerates the admin routes and asserts `STUDENT` → 403, so a route that escapes fails the build.

### Just `ADMIN` for now

Gate on `ADMIN` only. Leave `TEACHER` in the enum — it is already in the `check` constraint, so
keeping it costs nothing, and we simply do not use it yet. When a second teacher appears, the
change is `hasRole("ADMIN")` → `hasAnyRole("ADMIN", "TEACHER")`.

An earlier draft of this doc proposed an env-var email allowlist promoted on sign-in. Dropped:
manual DB management is fewer moving parts for one user, and neither approach puts a secret in the
repo.

### Frontend

`/api/me` already returns `role` (`UserResponse.role`), so the client needs **no contract change**:

- add `RequireRole` alongside the existing `RequireAuth`, reading `profile.role`;
- `React.lazy` the admin routes;
- hiding the nav item is cosmetic — the API gate is the boundary.

### Identity shape, for when social sign-in lands

See `google-signin.md` for the full plan. The parts that matter here: the role stays on `users`,
because there is one user table, one identity path, and the role column does not care how the
caller authenticated.

```
users            id, email NULLABLE, display_name, role, ...
user_identities  id, user_id, provider, subject, email_at_provider, created_at
                 unique (provider, subject)
```

- `users` stays canonical — points, streaks, progress and role all hang off it. A student arriving
  via Google still gets a local row, and `JwtService` keeps issuing our own token, so
  `JwtToUserPrincipalConverter` and the admin gate do not change at all.
- `password_hash` is **dropped**, not made nullable — no password storage, no bcrypt, no reset
  flow. Break-glass access is `sqlite3` on the box.
- `email` becomes nullable (guest accounts have none) and stays unique where present.
- **Never accept a role from a request body.** `RegisterRequest` has no role field today, and
  after the sign-in rework there is no registration payload at all. The only route to admin is us
  running that update.

---

## 2. Two free things to get right now

### 2.1 The database owns content; migrations own schema

Today a question can come from `V2__seed_questions.sql` *or* SQLite. Once she's editing, that
ambiguity is a footgun: a future `V5__fix_typo.sql` silently overwrites her work on the next
deploy, and she'd be right to be annoyed.

| | Rule |
|---|---|
| Migrations | Schema only. Never `insert`/`update`/`delete` on `questions`, `answer_options`, `topics`. |
| Seed content | Stays as `V2`, applied once, recorded in `flyway_schema_history`. Left alone. |
| Her content | Arrives through the admin API and CSV import. |

This is a rule, not work. The `V2` header already anticipated it: *"When the maths teacher
supplies real content we will load it through the admin API / CSV import instead of growing
this file."*

**Pre-users bonus:** while there are no users, the database is disposable — delete the file and
restart. So migrations can stay loose and we can consolidate `V1`/`V2`/`V3` freely. That freedom
disappears the day a student has a score, so use it now.

### 2.2 Provenance

```sql
alter table questions add column origin varchar(20) not null default 'AUTHORED';
-- 'SEED' | 'AUTHORED' | 'IMPORTED'
```

Then mark the 32 seed rows `SEED` (they have explicit ids, so it's a one-liner). Buys:
- "unpublish everything that came from the prototype" as a single action when her real content
  lands, instead of hunting through a list;
- an honest answer to "is this mine or the prototype's?" in the list UI.

Cheap now, mildly annoying later. Worth it.

---

## 3. Data model: the minimum that shows her the workflow

`active boolean` is close to what we need but cannot express "half-written". Two options:

| | Approach |
|---|---|
| A | Add `status` (`DRAFT`/`PUBLISHED`/`RETIRED`), drop `active`. One source of truth. |
| B | Keep `active`, surface it in the UI as a Published toggle. Zero migration. |

I'd take **A**, because it is one small migration at a time when the database is disposable, and
"two sources of truth for *is this servable*" is the kind of thing that quietly breaks later.
`pickRandomIds` / `pickRandomIdsForTopic` change `active = true` → `status = 'PUBLISHED'`. Note
that the compiler will not catch that — the existing quiz tests should.

Everything else the editor needs already exists: prompt, explanation, difficulty, topic,
options with labels and positions.

On drafts, one detail that matters for the editor's feel: **a draft is allowed to be invalid.**
She must be able to save a question halfway through writing it. So:

- `answer_options_one_correct_idx` (at most one correct) stays enforced always — you never want
  two, at any stage.
- "at least one option, exactly one correct, non-blank text" is checked at the
  **`DRAFT` → `PUBLISHED` transition**, in one validator method that every route goes through —
  the editor, the import, and any future bulk publish.

The prototype can be blunt about deleting: offer **Retire** (`status = 'RETIRED'`) as the normal
action and let hard delete exist for mistakes. Pre-users there is nothing to protect. The
production answer is in §7.

---

## 4. API surface

All under `/api/admin/**`, `ROLE_ADMIN`. Because the converter re-reads the user row, `hasRole` on
the URL is both sufficient and instantly revocable.

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/admin/questions` | Paged list. Filters: `topic`, `status`, `difficulty`. Includes answer key. |
| POST | `/api/admin/questions` | Create. |
| GET | `/api/admin/questions/{id}` | Full question with correctness, for the editor. |
| PUT | `/api/admin/questions/{id}` | Update. |
| POST | `/api/admin/questions/{id}/publish` | Validate, then `PUBLISHED`. 422 with field-level errors. |
| POST | `/api/admin/questions/{id}/retire` | `RETIRED`. |
| GET / POST / PUT | `/api/admin/topics(/{id})` | Topic list and edits. |
| POST | `/api/admin/import/preview` | Dry run: per-row errors, nothing written. |
| POST | `/api/admin/import` | Commit. |
| GET | `/api/admin/export` | CSV out. Doubles as her backup. |

Two things to keep even in a prototype:

- **Separate DTOs.** The existing rule is "no entity is serialised to the client". Admin DTOs may
  carry `isCorrect`; putting them in an `admin/dto` package makes it obvious at a glance which
  side of the line a type is on, so nobody reuses `QuestionView` for the editor and leaks the
  answer key to students.
- **Paged lists.** It's 32 questions today, but she may bring hundreds, and "load them all into
  the browser" is a habit that doesn't survive that.

Field-level validation errors in the existing `ApiError` shape, so the editor can point at the
broken option rather than showing "invalid".

---

## 5. Frontend shape

**Same SPA, `/admin/*` routes behind a role guard.** One deploy, shared API client and types,
shared UI primitives, and the Caddy history fallback keeps working. A second app isn't justified
by one user.

- Add `RequireRole` next to the existing `RequireAuth`; it reads `profile.role`, which already
  comes back from `/api/me` — no contract change needed.
- `React.lazy` the admin routes so students don't download the editor.
- Hiding admin nav is cosmetic. **The API is the boundary** — every admin route enforced
  server-side.

Screens in the order of demo value:

1. **Question list** — topic/status filters, prompt search, per-row publish/retire, counts. The
   screen she'd actually live in.
2. **Question editor** — prompt, explanation, topic, difficulty, options with a radio for
   correct, and a **live preview rendered with the same component the quiz uses**. Reusing the
   student render path is the point: a second rendering path can drift, and the whole value of a
   preview is that it's truthful. Explicit Save draft / Publish buttons.
3. **Topic editor** — name, description, sort order. Treat `slug` carefully (it's in the API
   and in stored sessions); editable while a topic is empty, warn loudly afterwards.
4. **Import / export** — see below.

---

## 6. Import: shape it around her real file

The single biggest thing that decides whether she engages: a teacher with 200 questions in a
spreadsheet will not type them into a form. If import is bad, she bounces off the whole feature.

- **Template download**, and make export produce exactly what import accepts. Round-tripping is
  the contract, and it doubles as her backup.
- **Dry run first** — row-numbered errors ("row 14: no correct option marked", "row 22: unknown
  topic 'ratio'"), nothing written. She fixes the sheet, re-uploads.
- **Match topics by slug**, and offer to create unknown ones rather than failing the whole file.
- Forgiving about column order and whitespace; accept `*` or `correct` markers. She's a teacher,
  not a data engineer.
- Imported rows land as `DRAFT` unless the file is clean, then she bulk-publishes after a look.

**I need to see her actual materials before finalising this** — see §8.

---

## 7. Parked: the lifecycle work, for when there are real students

Not building these. Recording them so the decisions aren't re-litigated from scratch, and so we
know today's schema doesn't make them harder.

**The one to remember.** `quiz_answers.is_correct` is frozen at answer time, but
`QuestionReview.from()` renders the prompt, correct answer and explanation from the **live** row.
So editing question 7 rewrites every past review of question 7 under the student's feet — and
switching the correct option can leave a review reading "you answered 24 ✓" next to a prompt
where 24 is no longer right.

The fix is to snapshot the rendered question into `quiz_session_questions` at deal time (it
already records *which* questions were dealt — extend it to record what they looked like), so
reviews never read live content. **Nothing in the admin design blocks that**, and it needs no
admin UI change — it's a migration plus a change to `QuestionReview`. Good to know we're not
building a dead end, which is the only reason it's in this document at all.

Also parked:

- **Hard delete cascades to student history.** `quiz_answers.question_id` and
  `answer_options.question_id` are `on delete cascade`, so deleting a question — or a topic,
  which cascades to its questions — destroys answer history and the provenance of points. Fix:
  retire instead of delete, enforced by a service guard and an `BEFORE DELETE` trigger, in the
  spirit of the existing `answer_options_one_correct_idx` guarantee.
- **`question_revisions`** — append-only JSON snapshot per publish/edit, for undo and "what did
  this look like before?". Deliberately a JSON blob: it's a historical record, never queried
  relationally.
- **Optimistic locking** — a `version` column plus 409 on stale writes.
- **Per-author attribution** — `created_by` / `updated_by`, for multiple teachers.
- **Coverage dashboard** — questions per topic × difficulty, and "topics that can't fill a
  5-question quiz". Cheap from the existing `countActiveByTopic`, and genuinely useful to a
  teacher; just not the demo.

---

## 8. Questions for Kate

Trimmed to the ones that actually change what we build:

1. **Diagrams?** Do her questions need images, or is text enough? This is the only one that adds
   real work — file storage, a mounted volume, a Caddy path, upload validation — so I'd like it
   answered before a migration is written.
2. **Displayed fractions and algebra** — is plain `3/4` and `x^2` acceptable, or does she want
   properly typeset maths? Unicode already covers `× − ² √ π ≤`. Real typesetting is a
   meaningful frontend dependency, and badly-rendered fractions on a fractions topic is a bad
   look in a demo.
3. **What form is her content in** — Word, Excel, a paper booklet, an export from another
   platform? The importer should be shaped around her actual file.
4. **Just her, or other teachers later?** Decides how much attribution matters. One column either
   way, so not urgent.

Not worth asking yet: publish/review workflow, admin visibility of student results, guest
accounts. Those are real questions, but not for a prototype.

---

## 9. Built so far

On branch `admin-interface`, in a separate `git worktree` at `/Users/kate/maths-admin`, so the
other agent's checkout and branch stay untouched. 86 backend tests (was 63).

| | |
|---|---|
| `V4__question_lifecycle.sql` | `status` replaces `active`; `origin` marks the 32 seeded questions |
| `POST/PUT /api/admin/questions` | Create and edit. Labels derived from position, never sent by the client |
| `GET /api/admin/questions` | Paged, filter by topic/status/difficulty/origin and prompt search |
| `POST .../{id}/publish`, `.../retire` | The only two status transitions |
| `/api/admin/topics` | List, create, edit |
| `QuestionValidator` | The publish gate, in one place |
| `scripts/make-admin.sh` | Promotes an existing account to ADMIN |

No review step: publish goes live immediately, confirmed as the intended behaviour.

### Decisions taken while building

- **No hard delete.** Retiring is the only removal on offer. `quiz_answers` cascades on delete,
  so a hard delete would erase students' answer history and the provenance of their points
  along with the question. A "delete a draft" endpoint can come later, scoped to drafts with no
  answers.
- **Structural limits on save, answerability on publish.** A draft may be empty. That meant
  normalising a null prompt to an empty string at the boundary, because the column is NOT NULL
  and the distinction the domain cares about is blank versus non-blank.
- **422 rather than 409 for an unpublishable question**, with field keys such as
  `options[2].text` and `options.correct` that name the offending input. 409 stays for genuine
  conflicts, like a duplicate topic slug.
- **Page size capped at 100**, and filters reject unrecognised values with 400. Without an
  explicit handler the catch-all turned a mistyped filter into a 500.

### Three bugs the tests caught

1. `findDetailedById` used an inner `join fetch` on options, so a draft with no options matched
   no rows and the editor got a 404 for a question that existed. Now a `left join`.
2. `questions.prompt` is NOT NULL, so a null prompt from a draft reached the database as a
   constraint violation and a 500.
3. `ApiError.validation` hardcoded 400, so a 422 body misreported its own status.

### Next

Question list, then the editor with live preview, then topics. The preview must render through
**the same component the quiz uses** — a second rendering path can drift, and the whole value of
a preview is that it tells the truth. Difficulty should render through the other agent's
`OreBadge` so the editor and the quiz agree.
