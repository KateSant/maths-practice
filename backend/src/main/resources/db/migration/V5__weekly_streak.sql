-- A second streak, measured in weeks rather than in correct answers.
--
-- `current_streak` / `best_streak` stay exactly as they are: they count correct answers in a row
-- and drive the "4 in a row" line in the quiz feedback, which is about concentration within a set.
-- They were also being shown as the student's streak, and that was the problem - a student working
-- at the right level is meant to miss some questions, so the number sat at 0-3 and rewarded staying
-- on the easy ones. The streak a student sees is now about turning up: did you practise this week,
-- and how many weeks in a row.
--
-- last_practised_week holds the Monday that starts the week, as YYYY-MM-DD. A date rather than an
-- ISO week string, so the arithmetic is a date comparison with no year-boundary parsing, and TEXT
-- because SQLite has no date type and this stays readable in the database.

alter table users add column streak_weeks integer not null default 0;
alter table users add column best_streak_weeks integer not null default 0;
alter table users add column last_practised_week varchar(10);
