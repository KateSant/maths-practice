-- Real Maths initial schema (SQLite).
--
-- Conventions:
--   * INTEGER PRIMARY KEY AUTOINCREMENT so JPA's GenerationType.IDENTITY works and
--     rowids are never reused. SQLite updates sqlite_sequence itself when the seed
--     inserts explicit ids, so there is no setval() equivalent to call.
--   * timestamps are stored as `timestamp`; SQLite is dynamically typed, and
--     sqlite-jdbc handles the Instant conversion in both directions.
--   * FOREIGN KEYS ARE ONLY ENFORCED WITH `PRAGMA foreign_keys=ON`, which the JDBC
--     URL sets for every connection. Without it these REFERENCES clauses are inert.
--   * timestamps are DECLARED `timestamp` so that Hibernate's ddl-auto=validate is
--     satisfied, but they STORE epoch milliseconds as an integer, because that is how
--     sqlite-jdbc encodes an Instant. SQLite is dynamically typed, so the declared name
--     is only an affinity hint. The defaults below therefore use unixepoch() * 1000 to
--     match the driver, rather than current_timestamp - which would write TEXT into
--     rows inserted by SQL while JPA wrote INTEGER into the same column, leaving
--     ordering and date comparisons unreliable once both kinds coexist.

create table users (
    id             integer primary key autoincrement,
    email          varchar(255) not null unique,
    password_hash  varchar(255) not null,
    display_name   varchar(80)  not null,
    role           varchar(20)  not null default 'STUDENT',
    points         integer      not null default 0,
    current_streak integer      not null default 0,
    best_streak    integer      not null default 0,
    created_at     timestamp    not null default (unixepoch() * 1000),
    check (role in ('STUDENT', 'TEACHER', 'ADMIN'))
);

create table topics (
    id          integer primary key autoincrement,
    slug        varchar(60)  not null unique,
    name        varchar(120) not null,
    description varchar(400),
    sort_order  integer      not null default 0
);

create table questions (
    id          integer primary key autoincrement,
    topic_id    integer      not null references topics (id) on delete cascade,
    prompt      varchar(1000) not null,
    explanation varchar(1000),
    -- 1 = easy, 2 = medium, 3 = harder. Used later for adaptive levels.
    difficulty  integer      not null default 1,
    active      boolean      not null default 1,
    created_at  timestamp    not null default (unixepoch() * 1000),
    check (difficulty between 1 and 5)
);

create index questions_topic_id_idx on questions (topic_id);
create index questions_active_idx on questions (active);

create table answer_options (
    id          integer primary key autoincrement,
    question_id integer      not null references questions (id) on delete cascade,
    position    integer      not null,
    label       varchar(4)   not null,
    text        varchar(500) not null,
    is_correct  boolean      not null default 0,
    unique (question_id, position)
);

create index answer_options_question_id_idx on answer_options (question_id);

-- At most one correct option per question. Grading logic (and any future content
-- import) can rely on this, and the database refuses to store an ambiguous question.
-- SQLite supports partial indexes, so this guarantee survives the move from Postgres.
create unique index answer_options_one_correct_idx on answer_options (question_id) where is_correct;

create table quiz_sessions (
    id             integer primary key autoincrement,
    user_id        integer      not null references users (id) on delete cascade,
    topic_id       integer      references topics (id) on delete set null,
    question_count integer      not null,
    correct_count  integer      not null default 0,
    points_awarded integer      not null default 0,
    started_at     timestamp    not null default (unixepoch() * 1000),
    completed_at   timestamp
);

create index quiz_sessions_user_idx on quiz_sessions (user_id, started_at desc);

-- The exact set of questions served in a session, in the order they were shown.
-- Storing this means answers can be validated against the session and that we can
-- replay what a student actually saw.
create table quiz_session_questions (
    session_id  integer not null references quiz_sessions (id) on delete cascade,
    question_id integer not null references questions (id) on delete cascade,
    position    integer not null,
    primary key (session_id, question_id),
    unique (session_id, position)
);

create table quiz_answers (
    id                 integer primary key autoincrement,
    session_id         integer   not null references quiz_sessions (id) on delete cascade,
    question_id        integer   not null references questions (id) on delete cascade,
    selected_option_id integer   references answer_options (id) on delete set null,
    is_correct         boolean   not null,
    time_ms            integer,
    answered_at        timestamp not null default (unixepoch() * 1000),
    -- One answer per question per session keeps retries idempotent.
    unique (session_id, question_id)
);

create index quiz_answers_session_id_idx on quiz_answers (session_id);
