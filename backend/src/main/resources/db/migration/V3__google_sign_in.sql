-- Sign-in moves to Google, so the local password path is removed entirely.
--
-- The column is dropped rather than left nullable. A nullable password_hash invites
-- someone to reintroduce a password login later, and there are no rows worth
-- preserving. SQLite has supported ALTER TABLE ... DROP COLUMN since 3.35 and
-- sqlite-jdbc here bundles 3.49. DROP COLUMN fails if the column is indexed or named
-- in a constraint; password_hash is neither, so this is safe.
alter table users drop column password_hash;

-- One row per external identity. A table rather than columns on users, because one
-- person may accumulate more than one over time (Google today, something else later).
create table user_identities (
    id                integer      primary key autoincrement,
    user_id           integer      not null references users (id) on delete cascade,
    provider          varchar(30)  not null,
    -- Google's 'sub' claim. Stable and never reused, unlike email, which the account
    -- holder can change and which Google may reassign to somebody else.
    subject           varchar(255) not null,
    email_at_provider varchar(255),
    created_at        timestamp    not null default (unixepoch() * 1000),
    last_login_at     timestamp,
    -- The constraint that makes "the same Google account twice" provably one user
    -- rather than two. Identity is keyed on this pair, never on email.
    unique (provider, subject)
);

create index user_identities_user_idx on user_identities (user_id);
