-- Give a wrong answer somewhere to record the misconception it was written to catch.
--
-- Every wrong option in the written bank carries a code from content/misconceptions.json
-- ("PV-MORE-DIGITS", "FRAC-ADD-ACROSS", ...), and content/render.py fails if a code is not in the
-- register. Until this column existed there was nowhere for that code to go: the bank's value as a
-- diagnostic instrument - a wrong answer telling you *which* error the student made, not merely
-- that they made one - was written and then dropped on the way into the database.
--
-- Nullable, because a correct option catches nothing and because most rows are authored in the app
-- without a code. No foreign key and no check constraint: the register is content, not schema. It
-- lives in the repository (content/misconceptions.json) and is revised there, so a code that is
-- retired in the file would otherwise leave a constraint to migrate; and a teacher authoring an
-- option in the admin screens has no register to pick from yet.
--
-- The index is for the question the column exists to answer - "which misconception is most common
-- in this topic?" - which is a group-by over this column once answers are joined to options.
alter table answer_options add column misconception_code varchar(60);

create index answer_options_misconception_idx on answer_options (misconception_code);
