-- Questions become authored content rather than seeded content, so they need a lifecycle
-- and a record of where each one came from.
--
-- `active` could only express "servable or not", which cannot represent a half-written
-- question. `status` replaces it outright rather than sitting beside it: two flags answering
-- "should this be served" would eventually disagree, and the one that loses is silent.
--
-- Order matters below. SQLite refuses DROP COLUMN while an index still names the column
-- ("error in index questions_active_idx after drop column: no such column: active"), so the
-- index is dropped first. DROP COLUMN on an indexed column fails even where it would
-- otherwise succeed, which is a confusing way to find that out at deploy time.

-- Defaults to DRAFT, not PUBLISHED. A forgotten INSERT should leave an unpublished question
-- rather than put half-written content in front of a student.
alter table questions add column status varchar(20) not null default 'DRAFT'
    check (status in ('DRAFT', 'PUBLISHED', 'RETIRED'));

-- Everything that exists at this point was published or not; carry that meaning across.
update questions set status = case when active then 'PUBLISHED' else 'RETIRED' end;

drop index questions_active_idx;
alter table questions drop column active;
create index questions_status_idx on questions (status);

alter table questions add column origin varchar(20) not null default 'AUTHORED'
    check (origin in ('SEED', 'AUTHORED', 'IMPORTED'));

-- Not a guess: every question in the database at this point came from V2__seed_questions.
-- This is what makes "unpublish the whole prototype bank in one action" possible once the
-- teacher supplies real content, instead of hunting through a list.
update questions set origin = 'SEED';
