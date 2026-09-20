-- Retire the prototype question bank, now that the real one lands in V11.
--
-- The 32 prototype questions (V2's bank, V6's tick-all example; the 33rd was already retired by
-- V7) were written to make the app usable before there was real content. They were never meant to
-- be the bank. V11 replaces them with the 200 questions specified in
-- specs/question-bank-probing-misconceptions.md, so the prototype goes.
--
-- Retired, not deleted. `quiz_answers.question_id` cascades on delete, so a DELETE would take every
-- recorded answer with it and rewrite history that has already been shown to a student - the same
-- reasoning that makes Retire the only removal on offer in the admin screens. `status = 'RETIRED'`
-- is enough to take the questions out of circulation: the catalog queries filter on
-- `status = 'PUBLISHED'`, so they stop being served, while every answer and completed review still
-- resolves.
--
-- SEED is the right predicate and the reason `origin` exists. It marks exactly the rows a
-- migration inserted, so this one statement retires the whole prototype however many migrations
-- contributed to it. Questions a teacher has written (origin = 'AUTHORED') are untouched, and so
-- are their answers.
--
-- This is a deliberate one-off, and it runs before V11 inserts the new bank. Seeding and retiring
-- are separate acts (specs/how-to-seed-the-question-bank.md): this migration only ever retires, and
-- V11 only ever inserts. Running the sweep after V11 would retire the new bank too, which is why
-- the order matters and why the two are separate migrations rather than one.
update questions set status = 'RETIRED' where origin = 'SEED';

-- Topics are not swept, because deleting one cascades to its questions and their answers. Four of
-- the five prototype topics (number, algebra, geometry, data) now hold nothing published, so they
-- are pushed to the end of the list rather than left to interleave with the new topics in the
-- teacher's screens. They are still there, and the teacher's admin list still shows them, because
-- she needs to see a topic that has been emptied rather than silently lose it.
--
-- `fractions` is not moved: V11 repurposes that row for the new bank's Fractions topic, keeping the
-- slug (and so the topic id that any recorded session points at).
update topics set sort_order = 100 + sort_order
 where slug in ('number', 'algebra', 'geometry', 'data');
