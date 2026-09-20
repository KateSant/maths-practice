-- Tick-all-that-apply questions.
--
-- Until now a question had exactly one right answer, and the database said so via the partial
-- unique index answer_options_one_correct_idx. A tick-all question has several right answers, so
-- that guarantee has to become conditional on the question's answer type.
--
-- SQLite cannot express that in an index: a partial index's WHERE clause may only reference
-- columns of the table being indexed, so it cannot look up the parent question. The guarantee
-- therefore moves into a trigger, which can. It is kept in the database rather than only in
-- QuestionValidator for the reason V1 gave - grading logic and any future importer should be able
-- to rely on it - and this remains the only thing standing between a malformed question and a
-- student for anything that writes to the database directly.

-- Default SINGLE_CHOICE so all 32 existing questions keep their meaning without a backfill, and so
-- a forgotten INSERT cannot invent a tick-all question by accident.
alter table questions add column answer_type varchar(20) not null default 'SINGLE_CHOICE'
    check (answer_type in ('SINGLE_CHOICE', 'MULTI_SELECT'));

drop index answer_options_one_correct_idx;

-- The insert direction is the one that matters: create and update both rebuild a question's
-- options from scratch, so this is how a question acquires its correct answers in the first place.
create trigger answer_options_single_choice_insert
before insert on answer_options
when (select answer_type from questions where id = new.question_id) = 'SINGLE_CHOICE'
begin
    select raise(abort, 'A single-choice question can have only one correct option.')
    where new.is_correct = 1
      and exists (select 1 from answer_options
                  where question_id = new.question_id and is_correct = 1);
end;

-- The update direction covers a direct SQL edit and any importer that sets flags in place rather
-- than rebuilding the set. No application code does that today.
create trigger answer_options_single_choice_update
before update of is_correct on answer_options
when new.is_correct = 1
  and (select answer_type from questions where id = new.question_id) = 'SINGLE_CHOICE'
begin
    select raise(abort, 'A single-choice question can have only one correct option.')
    where exists (select 1 from answer_options
                  where question_id = new.question_id
                    and is_correct = 1
                    and id <> new.id);
end;

-- Deliberately no third trigger for flipping an existing question's answer_type to
-- SINGLE_CHOICE while it already holds several correct options. It would have to run before the
-- option rebuild in the same transaction, which makes it depend on Hibernate's internal action
-- ordering - an upgrade detail that would fail silently. That path is guarded by
-- QuestionValidator instead, which runs on every publish, so such a question can never reach a
-- student.

-- An answer is now a set of options rather than one, so the selection moves out of the single
-- answered-option column and into its own table. quiz_answers.selected_option_id is dropped
-- outright rather than left beside the new table: two places holding "what the student chose"
-- would eventually disagree, and the one that loses is silent.
--
-- This is a plain additive table plus a column drop, not a table rebuild. SQLite refuses DROP
-- COLUMN only when an index names the column; selected_option_id has never been indexed, which is
-- why the V4 lesson about questions.active does not apply here.
create table quiz_answer_options (
    answer_id integer not null references quiz_answers (id) on delete cascade,
    option_id integer not null references answer_options (id) on delete cascade,
    primary key (answer_id, option_id)
);

create index quiz_answer_options_option_id_idx on quiz_answer_options (option_id);

-- Carry existing answers across before the column goes. Every one of them is a single choice, so
-- each contributes exactly one row.
insert into quiz_answer_options (answer_id, option_id)
select id, selected_option_id from quiz_answers where selected_option_id is not null;

alter table quiz_answers drop column selected_option_id;

-- ---------------------------------------------------------------------------------------------
-- Prototype seed content: one tick-all question, so the new type is visible in the app without
-- anybody having to author one first.
--
-- This is the only reason it is in a migration, and it is a deliberate exception to the rule in
-- docs/content-admin-architecture.md that migrations never insert questions. That rule exists to
-- stop a future deployment overwriting the teacher's content; this is prototype seed content,
-- marked origin = 'SEED' so the same one-action sweep that clears the other 32 takes it too.
-- V2 says not to grow it, so this cannot live there.
--
-- The ids are assigned by SQLite rather than written out, and that is a fix rather than a style
-- choice. This insert originally said `id = 33`, which is free on a fresh database and occupied on
-- a real one: production had already reached 33 questions of authored content, so the migration
-- died on a PRIMARY KEY collision, the API crash-looped and the site served 502. No test caught it
-- because every test migrated an empty database. SchemaMigrationTest now has a case that migrates
-- part of the way and then applies the rest over content occupying the id the seed wanted.
--
-- Editing this file changes its checksum, which is normally the reason not to touch an applied
-- migration. It is safe here because it never applied anywhere but disposable local databases:
-- production failed on it and rolled back to V5, which is exactly why this fix can run there. A
-- local database that did apply the old V6 will refuse to start on a checksum mismatch - delete it
-- and let Flyway rebuild, which is the documented reset for a prototype database.
-- ---------------------------------------------------------------------------------------------

insert into questions (topic_id, prompt, explanation, difficulty, status, origin, answer_type) values
  (1, 'Tick every number below that is prime.',
          'A prime number has exactly two factors, 1 and itself. 29, 37 and 47 are prime. '
          || '21 = 3 × 7 and 39 = 3 × 13, so both of those are composite.',
          2, 'PUBLISHED', 'SEED', 'MULTI_SELECT');

-- last_insert_rowid() is the question inserted immediately above, on this connection. It is what
-- lets the options attach without naming an id that may already be taken.
insert into answer_options (question_id, position, label, text, is_correct) values
  ((select last_insert_rowid()), 1, 'A', '21', false),
  ((select last_insert_rowid()), 2, 'B', '29', true ),
  ((select last_insert_rowid()), 3, 'C', '37', true ),
  ((select last_insert_rowid()), 4, 'D', '39', false),
  ((select last_insert_rowid()), 5, 'E', '47', true );
