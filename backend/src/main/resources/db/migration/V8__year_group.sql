-- Question sets are organised by school year group: Years 7 to 13.
--
-- The year group lives on the question, not on the student. Which year a student practises at is
-- a choice they make from a dropdown, and changes the set they are dealt; nothing about their
-- account records it. A Year 7 student who wants to work at Year 10 level picks Year 10 and gets
-- Year 10 questions, and there is no age to give at sign-up and no profile field to correct later.
--
-- Every question that exists today is Year 7 content: the starter bank was written for the first
-- year of secondary school, and that includes the tick-all example V6 added. The column default
-- says so, so every existing row - 33 of them - is assigned without being touched, and a future
-- INSERT that forgets the column lands in Year 7 rather than becoming invisible to every dropdown.
--
-- The CHECK mirrors the ones on difficulty, status and origin. The API validates as well, so a
-- bad year group reads as a message rather than a constraint violation, but the database is where
-- a value outside 7..13 becomes impossible instead of merely unlikely.
--
-- The history of this number, since it is not obvious from the file: it was written as V7 on a
-- branch while the multi-select work was still uncommitted, on the bet that that work would take
-- V6. It did - and then took V7 as well, for retiring the duplicate primes question - so this was
-- renumbered to V8 when the two were merged. Flyway applies in version order, so the retirements
-- and the new answer type land first and the year group follows.

alter table questions add column year_group integer not null default 7
    check (year_group between 7 and 13);

-- Every quiz deal filters by year group, and so does the admin list. The table is tiny today, so
-- this is free now and one less thing to remember when it is not.
create index questions_year_group_idx on questions (year_group);

-- What a session was dealt from, so the results page can offer "try again" at the same year rather
-- than at whatever the dropdown happens to be set to by then. Nullable, because a mixed set has no
-- single year and because sessions that predate this column have none; a null means "not recorded",
-- not "Year 7", which is why there is no default here even though the questions column has one.
--
-- The CHECK matches the questions column. It is nullable rather than defaulted on purpose: see
-- above.
alter table quiz_sessions add column year_group integer
    check (year_group is null or year_group between 7 and 13);
