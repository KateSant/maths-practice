# Real Maths

A maths practice app: multiple-choice questions with server-side marking, instant
worked explanations, points and streaks, and per-topic progress.

Prototype. The question bank is a starter set of 32 questions across 5 topics,
intended to be replaced by a maths teacher's real content.

## Stack

| | |
|---|---|
| Backend | Spring Boot 3.5, Java 21, Spring Data JPA, Spring Security (JWT) |
| Database | SQLite (single file, no server) with Flyway migrations |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS v4, React Router |
| Tests | JUnit 5 + Mockito (43) · Vitest (13) |

## Running it locally

Two terminals. No Docker required — SQLite is just a file on disk.

```bash
# 1. API on http://localhost:8081
cd backend
mvn spring-boot:run

# 2. Web app on http://localhost:5174
cd frontend
npm install
npm run dev
```

Then open <http://localhost:5174> and click **Quick start as a guest**.

Google sign-in needs a client ID at **build** time (Vite inlines it), so for local
development:

```bash
cd frontend
VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com npm run dev
```

Without it the app still runs and the guest path still works; the sign-in page says the
client ID is missing rather than showing an empty space. See `docs/google-signin.md`
for what to set up in Google Cloud, and note that `http://localhost:5174` has to be an
authorised JavaScript origin on that client.

The database file is created at `backend/data/realmaths.db` on first run, with the
schema and starter questions applied by Flyway. To reset it, delete that file (and
any `-wal`/`-shm` siblings) and restart.

### Docker

```bash
docker compose up --build     # API + SQLite volume, on port 8081
```

## Tests

```bash
cd backend  && mvn test       # 18 tests
cd frontend && npm test       # 13 tests
```

## Layout

```
backend/src/main/java/com/realmaths/
  auth/       Google sign-in and guest accounts, JWT issuing, principal resolution
  user/       User entity and repository
  question/   topics, questions, options, catalog queries
  quiz/       sessions, answers, grading, points and streaks
  profile/    profile and per-topic statistics
  common/     error shape, global exception handling, score maths
backend/src/main/resources/db/migration/
  V1__init.sql            schema
  V2__seed_questions.sql  starter question bank
frontend/src/
  api/        typed client and DTO definitions
  auth/       auth context, token storage, route guard
  components/ shared UI primitives
  pages/      Login, Home, Quiz, Results, Profile
  lib/        formatting helpers
```

## API

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/auth/google` | Exchange a Google ID token for a JWT |
| POST | `/api/auth/guest` | Create a throwaway account, returns a JWT |
| GET | `/api/topics` | Topics with active question counts |
| POST | `/api/quiz/sessions` | Deal a quiz (`topicSlug` optional, `count`) |
| GET | `/api/quiz/sessions/{id}` | A session with its answers so far |
| POST | `/api/quiz/sessions/{id}/answers` | Submit one answer, returns the grade |
| POST | `/api/quiz/sessions/{id}/complete` | Finish, returns the full review |
| GET | `/api/me` | Profile with statistics |
| PATCH | `/api/me` | Change display name |
| GET | `/api/me/history` | Completed quizzes |

Authenticated requests use `Authorization: Bearer <token>`.

## Design notes

**Identity is keyed on the provider's subject, never on email.** `user_identities` has a
unique constraint on `(provider, subject)`, where `subject` is Google's immutable account
identifier. Email is mutable and can be reassigned, so matching on it is how accounts get
taken over; it is only used to find an existing account when Google is authoritative for
the address. See `docs/google-signin.md`.

**There are no passwords.** No hashes are stored, and there is no reset flow, because
there is no password. Sign-in is Google, or a guest account with no email at all.

**The answer key never leaves the server.** No JPA entity is serialised to the
client. Questions are served as `QuestionView`/`AnswerOptionView`, which have no
correctness field, and grading happens in `QuizService`. The correct option is only
revealed in the response to a submitted answer.

**Grading is idempotent.** `quiz_answers` has a unique constraint on
`(session_id, question_id)`, so re-submitting an answer returns the original grade
instead of awarding points twice. Retries after a dropped connection are safe.

**Sessions are scoped to their owner.** Every session lookup filters on the
authenticated user id, so guessing another student's session id returns 404.

**The database enforces the invariants.** A partial unique index
(`answer_options_one_correct_idx`) makes a question with two correct answers
impossible to store, foreign keys and cascades are declared in the schema, and the
schema is applied by Flyway with Hibernate set to `ddl-auto: validate` so a
forgotten migration fails at startup rather than at runtime.

### SQLite specifics

Two things are easy to get wrong and are handled deliberately:

- **`foreign_keys=on` is required.** SQLite ignores foreign keys unless the
  pragma is set per connection, which is why it is part of the JDBC URL in
  `application.yml`. Without it, the `REFERENCES` clauses are inert.
- **Timestamps are declared `timestamp` but store epoch milliseconds.** That is how
  `sqlite-jdbc` encodes an `Instant`, so the column defaults use
  `unixepoch() * 1000` to match, rather than `current_timestamp` — which would
  write TEXT into rows inserted by SQL while JPA wrote INTEGER into the same column,
  leaving ordering unreliable. `SchemaMigrationTest` guards this.

Because Hibernate's community SQLite dialect is less reliable than its Postgres one
at schema validation, `SchemaMigrationTest` applies the real migrations to a
temporary database and asserts the schema guarantees directly.

### Identity columns

SQLite requires `AUTOINCREMENT` columns to be declared exactly `INTEGER` (that is
what makes them an alias for the 64-bit rowid), but the entities use `Long`. The
`@JdbcTypeCode(SqlTypes.INTEGER)` on each `@Id` bridges that gap; see `User.id`.

## Deployment sketch

For a hobby-scale deployment, one small Lightsail instance running the API and
serving the built frontend from Caddy is the cheapest sensible option: no load
balancer, no managed database, nothing serverless — so no cold starts. SQLite is a
single file on the instance's disk, and backing it up is `cp`.

Caddy should serve the SPA with a history fallback so client-side routes survive a
refresh, and reverse-proxy `/api` to the API. Because both are then on one origin,
no CORS configuration is needed in production.

`SPRING_DATASOURCE_URL` and `REALMATHS_JWT_SECRET` are the settings to override.
`REALMATHS_JWT_SECRET` must be at least 32 bytes.
