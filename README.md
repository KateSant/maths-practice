# Maths practice app

Multiple-choice maths practice with server-side marking, worked explanations, points and streaks,
and per-topic progress. There is also a teacher-facing question bank, so the content can be edited
without a deploy. Finishing a set also pays out **play time**, which is spent in a small mining
game at the top of the results page.

**The product has no name yet**, so the interface deliberately shows none. That is why the
repository is `real-maths`, the Java package is `com.realmaths`, the database is
`realmaths.db` and the environment variables are `REALMATHS_*` — those are working names from
before the naming question was parked. See `docs/deferred.md`.

Prototype stage. The question bank ships with 33 starter questions across 5 topics, intended to be
replaced by a real teacher's content through the admin screens. One of them is a **tick-all**
question, so both answer types are reachable on first run, and all 33 are filed under **Year 7**.

---

## Read these first

| | |
|---|---|
| `docs/deferred.md` | What was deliberately not done, and why. |
| `docs/google-signin.md` | The whole sign-in design, what to configure in Google Cloud, and the two bugs that only showed up in production. |
| `docs/content-admin-architecture.md` | The question bank's design: lifecycle, publish gate, and the decisions behind them. |

---

## Stack

| | |
|---|---|
| Backend | Spring Boot 3.5, Java 21, Spring Data JPA, Spring Security, JWT |
| Database | SQLite, one file, no server. Schema by Flyway |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS v4, React Router |
| Tests | JUnit 5 + Mockito (**148**) · Vitest (**93**) |
| Deploy | GitHub Actions → GHCR → one Lightsail instance, Caddy in front |

---

## Running it locally

Two processes, no Docker needed.

```bash
# 1. API on http://localhost:8081
cd backend
REALMATHS_GOOGLE_CLIENT_ID=<client-id> mvn spring-boot:run

# 2. Web app on http://localhost:5174
cd frontend
npm install
VITE_GOOGLE_CLIENT_ID=<client-id> npm run dev
```

Open <http://localhost:5174>. **Both** environment variables are needed and they are the same
value — the frontend for Google's button, the API to check the token's `aud` claim. Omitting the
frontend one shows a "not configured for this build" message instead of the button; omitting the
API's makes every sign-in fail with 503 *after* Google has already issued a token, which is a
confusing place to discover it. The client ID is public, not a secret.

**Stay on 5174. Do not change the port.** Changing it has broken sign-in more than once, and it
keeps happening, so treat this as a rule rather than a preference.

`http://localhost:5174` is the only origin registered as an authorised JavaScript origin on the
Google OAuth client, so Google refuses sign-in from any other port. The button still renders and
the only symptom is a console error after the click — which reads as a broken app rather than as a
wrong port, and is why this is worth repeating. `frontend/vite.config.ts` sets `5174` with
`strictPort`, and it should stay that way.

If you genuinely need a second port — a second worktree running at the same time, say — pass
`--port` on the command line rather than editing the file, and register that origin on the OAuth
client as well (`docs/google-signin.md`). Without that registration Google sign-in cannot work on
that port, and guest sign-in is the only way in. Nothing else depends on the port: the `/api`
proxy, the tests and the build all work on any of them.

The API proxies `/api` through Vite, so the browser sees one origin in development exactly as it
does behind Caddy in production, and there is no CORS in either. `VITE_API_URL` overrides the proxy
target if you need to point at a different API.

The database is created at `backend/data/realmaths.db` on first run, with the schema and starter
questions applied by Flyway. To reset it, delete that file and any `-wal`/`-shm` siblings.

### Docker

```bash
docker compose up --build     # API + SQLite volume, on port 8081
```

---

## Tests

```bash
cd backend  && mvn test       # 148 tests
cd frontend && npm test       # 93 tests
cd frontend && npm run build  # runs tsc --noEmit as well, so type errors fail the build
```

Two tests are worth knowing about because they cover things nothing else can:

- `db/SchemaMigrationTest` applies the real migrations to a temporary SQLite file and asserts the
  schema guarantees directly. Hibernate's community SQLite dialect cannot reliably do
  `ddl-auto=validate`, so this is where "the schema is what we think it is" is checked.
- `auth/AuthWiringTest` boots the whole application context and asserts there is **exactly one**
  `JwtDecoder` bean. See the note on Google's decoder below.

There are no component tests: the frontend suite has no DOM environment. Logic worth asserting
lives in plain functions (`auth/roles.ts`, `lib/format.ts`, `lib/playtime.ts`, `lib/platformer.ts`)
so it can be tested there.

---

## Layout

```
backend/src/main/java/com/realmaths/
  admin/      question bank authoring: controllers, services, the publish validator
  auth/       Google sign-in and guest accounts, JWT issuing, principal resolution
  common/     error shape, exception handling, score maths
  config/     security, JWT, properties
  game/       play-time ledger: what a set pays, what a heartbeat costs
  profile/    profile and per-topic statistics
  question/   topics, questions, options, catalog queries
  quiz/       sessions, answers, grading, points and streaks
  ratelimit/  token bucket limiting, aimed at unauthenticated account creation
  user/       User and UserIdentity entities

backend/src/main/resources/db/migration/
  V1__init.sql              schema
  V2__seed_questions.sql    starter question bank
  V3__google_sign_in.sql    drops passwords, adds user_identities
  V4__question_lifecycle.sql  status replaces active, adds origin
  V5__play_time.sql         earned play time and its heartbeat
  V6__multi_select_questions.sql  tick-all questions; answer selections move to their own table
  V7__retire_duplicate_primes_question.sql  retires the first primes question, now duplicated by V6
  V8__year_group.sql        questions filed by school year 7-13, and the year a session was dealt

frontend/src/
  api/         typed client; admin.ts holds the admin endpoints and their types
  auth/        auth context, token storage, route guards, sign-in roles
  components/  shared primitives and layout, and the mining reward
  pages/       the student pages, plus pages/admin/ for the question bank
  lib/         formatting, the product-name constant, the platformer world and its physics,
               the play-time clock, and the option-state rule the question card draws from
```

---

## API

Authenticated requests use `Authorization: Bearer <token>`. The token is ours, issued by
`JwtService`; it is not Google's.

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/auth/google` | Exchange a Google ID token for ours |
| POST | `/api/auth/guest` | Create a throwaway student account |
| GET | `/api/topics` | Topics with published question counts. Optional `yearGroup` counts one year and drops empty topics |
| POST | `/api/quiz/sessions` | Deal a quiz (`topicSlug` optional, `count`, `yearGroup` optional) |
| GET | `/api/quiz/sessions/{id}` | A session with its answers so far |
| POST | `/api/quiz/sessions/{id}/answers` | Submit one answer, returns the grade |
| POST | `/api/quiz/sessions/{id}/complete` | Finish, returns the full review |
| GET | `/api/me` | Profile with statistics |
| PATCH | `/api/me` | Change display name |
| GET | `/api/me/history` | Completed quizzes |
| GET | `/api/game` | Play-time balance, without spending it |
| POST | `/api/game/heartbeat` | "Still playing": bills the time since the last call |
| GET | `/api/admin/questions` | Paged question list. Filters: `topicId`, `status`, `difficulty`, `origin`, `yearGroup`, `q` |
| POST | `/api/admin/questions` | Create a draft |
| GET | `/api/admin/questions/{id}` | One question, **with the answer key** |
| PUT | `/api/admin/questions/{id}` | Replace a question and its options |
| POST | `/api/admin/questions/{id}/publish` | Validate, then make it live |
| POST | `/api/admin/questions/{id}/retire` | Take it out of circulation |
| GET/POST/PUT | `/api/admin/topics` | List, create and edit topics |

Everything under `/api/admin/**` requires `ROLE_ADMIN`, enforced in `SecurityConfig` by path
prefix rather than per controller, so a new endpoint is protected by where it lives.
`AdminApiTest` asserts a student is refused, so a route mounted outside the prefix fails the build.

---

## How it works

### The answer key never leaves the server

No JPA entity is serialised to a client. Students receive `QuestionView` / `AnswerOptionView`,
which have no correctness field at all, and grading happens in `QuizService`. The correct option is
revealed only in the response to a submitted answer.

The admin DTOs *do* carry it — that is their job — which is why they live in `admin/dto` and the
frontend mirrors that split in `api/admin.ts`. Keeping them apart makes it obvious which side of
the line a type belongs on.

### Question sets are organised by year group

`questions.year_group` is 7 to 13, and a quiz is dealt only from the year group the student asks
for. The 32 starter questions are all Year 7: the migration's column default assigned them, so
nothing was hand-filed.

**The year group is the student's choice, not a fact about them.** Nothing is asked at sign-up,
there is no year group on a user, and a Year 7 who wants to work at Year 10 level picks Year 10 and
is dealt Year 10 questions. The choice is remembered in `localStorage`, and it also travels in the
quiz link, so the topic list and the quiz cannot disagree about which year is being dealt.
Omitting `yearGroup` from `POST /api/quiz/sessions` still means "every year", which keeps the
endpoint usable without one.

The admin list shows each question's year group, filters by it, and the editor can move a question
between years. The migration is numbered `V8` rather than `V7` because the multi-select work landed
first and took both `V6` and `V7`; Flyway applies in version order, so the retirements and the new
answer type land before the year group does.

### Identity is keyed on the provider's subject, never on email

`user_identities` is unique on `(provider, subject)`, where `subject` is Google's immutable account
identifier. Email is mutable and can be reassigned, so matching on it is how accounts get taken
over. It is used to find an existing account only when Google is authoritative for the address —
`@gmail.com`, or a Workspace domain — and a pre-registered account on any other address is refused
rather than linked.

### There are no passwords

No hashes, no reset flow, no breach surface. Sign-in is Google, or a guest account with no email
at all. Guests therefore can never be made teachers: there is no identity to attach one to.

### Roles, and how to grant ADMIN

`users.role` is one of `STUDENT`, `TEACHER`, `ADMIN`, constrained by the schema. Nothing in the app
sets it, and no request body can — there is no registration payload at all any more.

```bash
./scripts/make-admin.sh someone@example.com                  # promote an existing account
./scripts/make-admin.sh --pre-register someone@gmail.com "Their Name"  # create it first
```

There is no allowlist in configuration and no admin UI for it. Because
`JwtToUserPrincipalConverter` re-reads the user row on **every request**, the change takes effect
on that person's next request: no re-login, no reissued token, no cache to clear.

`--pre-register` exists so an account can be ready before someone first signs in. Google then
adopts the row rather than creating a second one. It only works for an address Google is
authoritative for, and the script warns when it is not.

**A row in `users` is not evidence that anyone has signed in.** A pre-registered account sits there
from the moment the script runs, with its role already set, and nothing in `users` distinguishes it
from an account that has been used. Sign-in is evidenced by a row in `user_identities`, created at
the first successful Google login, which carries `last_login_at`; a pre-registered account has none
until then. Joining the two tables is the only way to answer "has this person signed in yet", and
answering it from `users` alone is how a pre-registered colleague reads as a returning user.

### The student and teacher halves are kept apart

The sign-in flow asks Student or Teacher first, then signs in as that. The choice is a statement of
intent, not a permission — it decides the landing page and nothing else — and a student who picks
Teacher gets a plain "you're not a teacher on this account" page rather than a silent redirect.

Inside the question bank the header shows authoring navigation; on the practice side there is no
mention of teaching at all. Both are cosmetic: the API decides what anyone may actually do, and an
administrator can call `/api/admin/**` whatever the navigation shows.

### A question has a lifecycle, and a draft may be invalid

`status` is `DRAFT`, `PUBLISHED` or `RETIRED`. A teacher has to be able to save something
half-written, so structural limits are checked on save (lengths, difficulty 1–4, at most six
options) while "is this answerable" — a prompt, at least two options, and an answer key its type
allows — is checked only on the `DRAFT`→`PUBLISHED` transition, in `QuestionValidator`. The editor,
a bulk publish and any future importer all pass through that one gate.

**Nothing is ever hard-deleted.** `quiz_answers` cascades on delete, so deleting a question would
take students' answer history with it. Retiring is the only removal on offer.

`origin` records where a question came from: `SEED` for the 33 starter questions, or `AUTHORED`.

### A question is answered one of two ways

`questions.answer_type` is `SINGLE_CHOICE` or `MULTI_SELECT`, and it decides both how the question
is shown and how it is graded. It is sent to the student — the screen cannot render a tick-all
question without it — and it says how to answer, never what the answer is.

The two types share one grading rule: **the chosen set must equal the correct set**. A single choice
is simply the case where the correct set has one member, so there is no per-type branch in the
grader that could drift from the answer type. For a tick-all question that means a missing tick is
wrong and an extra tick is wrong; there is deliberately **no partial credit**, because the score and
the streak are counts of questions answered correctly and a half-marked question would make both
mean less.

`QuizAnswer.selectedOptions` holds a set, so an answer is a set for both types, and one row per
selection in `quiz_answer_options`. A **single-choice** question is refused two correct options by a
`BEFORE INSERT` trigger, which is where the unconditional `answer_options_one_correct_idx` used to
enforce it; the guarantee became conditional because a tick-all question needs several. A tick-all
question is held to "at least one correct" by the validator.

### Grading is idempotent, and sessions are private

`quiz_answers` is unique on `(session_id, question_id)`, so a retried submission returns the
original grade instead of awarding points twice. Every session lookup filters on the authenticated
user id, so guessing another student's session id returns 404.

### Play time is metered by the server, not the client

Finishing a set awards seconds of play time to the account: a flat rate per correct answer, plus a
bonus for a clean sweep. The mining game spends them. The client never says how long it has been
playing — it sends `POST /api/game/heartbeat` meaning "still here", and the server bills the
wall-clock gap since the previous call against the stored balance. Time can therefore only be spent
if it was actually earned, and editing the bundle cannot mint more of it.

Two rules keep that from being punishing. The gap is capped by
`realmaths.game.max-heartbeat-gap-seconds`, so closing the tab and returning an hour later costs at
most the cap rather than the whole balance. And the clock stops at zero, so the break before the
next set is not charged against the time that set is about to earn. `GameServiceTest` covers the
rules; on the client, `lib/playtime.ts` does the ticking between heartbeats, and every response
overwrites its guess, so the countdown on screen is never the authority.

### The database enforces the invariants

- A single-choice question cannot hold two correct options: the `answer_options_single_choice_insert`
  trigger refuses it, and so does the matching `UPDATE` trigger. This replaced a partial unique
  index, which could not be made conditional on the question's answer type.
- Foreign keys and cascades are declared in the schema.
- `users.email` is unique, and `user_identities` is unique on `(provider, subject)`.
- `questions.status`, `answer_type` and `origin` have `check` constraints.

### SQLite specifics

Four things are easy to get wrong, and each is handled deliberately:

- **`foreign_keys=on` is required.** SQLite ignores foreign keys unless the pragma is set per
  connection, which is why it is in the JDBC URL in `application.yml`. Without it the `REFERENCES`
  clauses are inert. `journal_mode=WAL` and `busy_timeout` are there for the same reason: readers
  while a writer works, and waiting rather than failing on a locked database.
- **Timestamps are declared `timestamp` but store epoch milliseconds**, because that is how
  `sqlite-jdbc` encodes an `Instant`. Column defaults therefore use `unixepoch() * 1000` rather than
  `current_timestamp`, which would write TEXT where JPA writes INTEGER. `SchemaMigrationTest`
  guards this.
- **`AUTOINCREMENT` columns must be declared exactly `INTEGER`** to be an alias for the 64-bit
  rowid, but the entities use `Long`. `@JdbcTypeCode(SqlTypes.INTEGER)` on each `@Id` bridges it.
- **`DROP COLUMN` fails while an index names the column**, so the index must be dropped first.
  `V4` does exactly that, in that order, and it is commented there.

### Google's decoder is not a bean

`GoogleIdTokenVerifier` builds its own `JwtDecoder` internally and never publishes one. The
application's own `JwtDecoder` bean authenticates API calls, and a second one in the context could
wire the resource server to Google's keys — at which point any Google ID token would be a valid API
credential. `AuthWiringTest` asserts there is exactly one.

The verifier reads the `iss` claim as a raw string rather than through `jwt.getIssuer()`, because
Spring models that as a URI and Google also issues the scheme-less `accounts.google.com` form.

---

## How it is deployed

One Lightsail instance, one small Docker Compose stack, Caddy in front. SQLite is a file in a
volume on that instance. No load balancer, no managed database, nothing serverless.

```
push to main
   │
   ├─ test    reuses ci.yml: backend tests, frontend tests, typecheck and build
   ├─ infra   terraform apply, state in S3        ─┐ both need the test job
   ├─ build   docker images → ghcr.io             ─┘ to pass
   └─ deploy  ssh to the instance, update .env, docker compose up, smoke test
```

Runs are serialised by a `concurrency` group, so two pushes queue rather than racing for the host
or the Terraform state.

### What is where

| | |
|---|---|
| Host | `maths.thinktalkbuild.com` → static IP `16.60.38.27`, Lightsail, `eu-west-2` |
| Instance | `realmaths`, Ubuntu 24.04 |
| On the host | `/srv/realmaths/` — `.env`, `docker-compose.prod.yml`, `Caddyfile` |
| Database | volume `realmaths_realmaths-data`, at `/data/realmaths.db` in the api container |
| Images | `ghcr.io/katesant/real-maths/api` and `/web` |
| Terraform state | `s3://realmaths-terraform-state-991346485322` |
| CI role | `realmaths-github-ci`, assumed over GitHub OIDC — no stored AWS keys |

### Configuration

Repository **variables** (not secrets): `SITE_DOMAIN`, `GOOGLE_CLIENT_ID`, `AWS_REGION`,
`AWS_AVAILABILITY_ZONE`, `SSH_CIDR`, `SSH_PUBLIC_KEY`, `TF_STATE_BUCKET`.

Secrets: `AWS_ROLE_ARN`, `DEPLOY_USER`, `DEPLOY_HOST_KEY`, `DEPLOY_SSH_KEY`. There is one
environment, `production`.

The container settings live in `docker-compose.prod.yml` and the host's `.env`. **The deploy step
upserts new keys into that `.env` rather than `sed`-replacing them**, because `sed` does nothing at
all when a key is absent — which is how `REALMATHS_GOOGLE_CLIENT_ID` first shipped missing while the
deploy reported success.

`VITE_GOOGLE_CLIENT_ID` reaches the web image as a **Docker build arg**, not a runtime variable,
because Vite inlines it. Setting it on the container does nothing.

### The smoke test

After deploying, the workflow checks:

- `GET /` returns 200 (Caddy is serving, certificate obtained)
- `GET /api/topics` returns 401 (the API is reachable and refusing anonymous callers)
- `POST /api/auth/google` with a junk token returns **401, not 503** — 503 means the API has no
  client ID, which is otherwise invisible because the button still renders and Google still issues
  a token. This check exists because that shipped once.

### The trust policy names the repository

`realmaths-github-ci` trusts `repo:KateSant@*/real-maths@*:...`, so only this repository's
workflows can assume the role over OIDC.

### Operating it

```bash
# logs
ssh -i ~/.ssh/realmaths-deploy ubuntu@16.60.38.27 \
  'cd /srv/realmaths && docker compose -f docker-compose.prod.yml logs -f api'

# the database: sqlite3 is on neither the host nor the api image, so use a container
ssh -i ~/.ssh/realmaths-deploy ubuntu@16.60.38.27 \
  'docker run --rm -v realmaths_realmaths-data:/data alpine:3 sh -c \
   "apk add --no-cache sqlite >/dev/null && sqlite3 /data/realmaths.db \"select id,email,role from users;\""'
```

That recipe mounts the volume read-write and leaves the connection writable, which is fine for a
`select` and wrong for anything else. When the check has to be read-only, copy the database out and
query the copy: `docker cp` the `.db` and its `-wal`/`-shm` siblings to a temp directory, then read
them with the host's `python3`, whose `sqlite3` module needs no client installed. Mounting `:ro` is
not the read-only version of this — SQLite has to be able to write the `-shm` file to read a WAL
database at all, so a `:ro` mount fails rather than protecting anything.

```bash
# a read-only check: query a copy, so the live volume is never opened for writing
ssh -i ~/.ssh/realmaths-deploy ubuntu@16.60.38.27 '
  d=$(mktemp -d)
  docker cp realmaths-api-1:/data/realmaths.db "$d/" >/dev/null
  docker cp realmaths-api-1:/data/realmaths.db-wal "$d/" >/dev/null 2>&1
  python3 -c "import sqlite3,sys; [print(r) for r in sqlite3.connect(sys.argv[1]).execute(sys.argv[2])]" \
    "$d/realmaths.db" \
    "select u.email,u.role,i.last_login_at from users u left join user_identities i on i.user_id=u.id"
  rm -rf "$d"'
```

A pre-migration backup of the production database is at `/home/ubuntu/realmaths-before-v4.db` on
the host, taken before `V4` ran. Take another before any future migration:

```bash
docker run --rm -v realmaths_realmaths-data:/data -v /home/ubuntu:/backup alpine:3 sh -c \
  'apk add --no-cache sqlite >/dev/null && sqlite3 /data/realmaths.db ".backup /backup/realmaths-$(date +%F).db"'
```

`.backup` rather than `cp`, so anything still in the WAL is included.

---

## Working on this repository

**More than one agent may be working here at once. Use a `git worktree`, not a second checkout of
the same directory.**

```bash
git worktree add -b my-branch ../my-worktree main
```

Two agents in one working directory caused a real incident: one ran `git add -A` and swept up the
other's in-progress files, which broke the build on `main` and blocked a deploy. **Never use
`git add -A` here** — stage explicit paths. A worktree also keeps uncommitted work in one branch
away from the other's.

Other things that have actually gone wrong, so worth checking first:

| Symptom | Cause |
|---|---|
| "Google sign-in is not configured for this build" | `VITE_GOOGLE_CLIENT_ID` missing when the dev server started. Vite inlines it at startup; the API cannot supply it. |
| "Google sign-in is not configured on this server" (503) | `REALMATHS_GOOGLE_CLIENT_ID` missing from the API. |
| Sign-in silently does nothing on click | The page's origin is not registered on the OAuth client, or the dev server is on a different port than the config expects. See the port rule under "Running it locally". |
| Two dev servers fighting over 5174 | `strictPort` means the second one fails loudly rather than moving. A second worktree can use `--port 5173`, but Google sign-in will not work there until that origin is registered on the OAuth client. **Do not fix this by editing the port in `frontend/vite.config.ts`** — that is what breaks sign-in for everyone. |
| An edited question 404s | It has no options yet, and a query used an inner join. Fixed, but a reminder that a draft may be empty. |
| `{}` in a component | JSX syntax interpolating a value. It is not text on the page. |

---

## Parked work

See `docs/deferred.md`. It covers publishing the Google OAuth app, the missing privacy policy,
case-insensitive email uniqueness, guest accounts losing their progress on signing in, and the
untested admin screens.
