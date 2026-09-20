# Seeding content

**Status:** decided. Nothing to build — this is a rule, not a system.

## What it has to achieve

1. **Seed in several rounds**, over time, and be able to **retire** seed content that is no longer
   wanted.
2. **A teacher may amend a seeded question**, and that work must never be overwritten.

## The rule

**Seed questions are inserted by a migration and never updated by one.** To change a seeded
question, edit it in the admin screens.

Seeding and retiring are separate acts, and neither is a side effect of the other. Seeding only ever
inserts; retiring is always deliberate. That separation is what makes both requirements hold at
once, and it is the whole design.

## Why that is enough

Two things made seed content in Flyway look like a problem, and insert-only removes both.

**A teacher's edit cannot be clobbered.** The danger was a migration overwriting a question she had
since rewritten. A migration that only ever inserts cannot overwrite anything, so nothing needs to
mark a row as "edited by a teacher" and nothing needs to check.

**The checksum wall cannot be reached.** An applied migration is frozen, so a seed question written
badly could not be corrected in place — the reason we went looking for a separate process. But that
wall only matters if a seed migration ever *needs* editing, and under this rule it never does:
changing a seeded question is done in the app, not in the migration. The wall is unreachable, so
leaving Flyway buys nothing.

What staying in Flyway gives, for free:

- **exactly-once application**, so no identity column and no bookkeeping of our own — this is what
  `seed_key` was for, and `flyway_schema_history` already is it;
- **a fresh database is seeded automatically**, so nobody has to remember to run anything;
- **one place** for schema and the initial bank, ordered and recorded, rather than a second process
  with its own conventions.

## Adding questions

One migration per batch: `V10` adds three questions, `V11` adds five. Each applies once, on every
database, in order. Several rounds of seeding are just several migrations, and re-running is not a
thing that happens — which is why nothing needs to detect duplicates.

The consequence to accept: **you cannot keep appending to one seed file and re-run it.** "Seed
again" means "write another migration". If a single growing file that you run repeatedly is what you
want, Flyway is the wrong tool.

## Changing or retiring a seeded question

**Changing it is done in the app.** A migration never updates content, so her edit cannot be undone.

**Retiring one question** is the Retire button in the admin screen.

**Throwing the prototype bank away, when the new bank lands, is one deliberate statement:**

```sql
update questions set status = 'RETIRED' where origin = 'SEED';
```

Everything the seeder ever wrote goes — **including anything a teacher has since amended**, which is
the intent: the prototype bank is being replaced, not absorbed. Her wording is not destroyed, only
unpublished. The row survives, and it can be republished.

This supersedes the assumption in `specs/question-bank-plan.md` §6 that the existing seed questions
are kept and folded into the new topics. **They are not kept.** That plan was counting on 32 free
band-1/2 items, so its topic allocations may need raising to cover band-1/2 fluency itself.

`origin` is what makes this a single action. Retired questions keep their answers: `quiz_answers`
cascades on delete, which is why retiring is the only removal on offer.

## Topics are not covered by any of this

`topics` has no `origin` and no status, and there is no delete for it. So the sweep above empties the
five prototype topics but leaves them in place — and one of them, `fractions`, holds the slug the new
bank wants for a different topic: the existing "Fractions, Decimals & Percentages" against the
planned "Fractions". `topics.slug` is unique, so one of them has to move.

Two things to settle before the new bank lands:

- **Hide topics with no published questions** from the student list, or the five dead ones will look
  entirely normal — the question count is never displayed — and give "There are no questions
  available for that topic yet" when clicked. The teacher's screens must keep showing them, because
  she needs to see a topic she has just created.
- **Resolve `fractions`:** reuse the existing row for the new topic, or give one of them a new slug.

Deleting a topic is not an option. `questions` cascades on topic delete, which would take the answer
history with it.

## Two traps, both learned by taking production down

**Never claim a row id for a question you are inserting.** `V6` asked for `id = 33`, which is free on
an empty database and occupied on a real one — production held 33 questions of authored content, the
migration died on a primary key collision, and the API crash-looped into a 502. Look a topic up by
slug, and let SQLite assign question ids.

**Do not attach options with `last_insert_rowid()`.** Inserting the first option changes it, so the
second option points at the first option's id. `V6` does this today and only works because the
BEFORE INSERT trigger it creates changes how SQLite evaluates the statement — an accident, not a
guarantee, and one that would break if the trigger ever changed. Capture the id once instead:

```sql
insert into questions (topic_id, prompt, explanation, difficulty, status, origin, answer_type)
values ((select id from topics where slug = 'fractions'), 'Tick every fraction that is equivalent to 1/2.', ...);

create temp table seeded as select last_insert_rowid() as question_id;

insert into answer_options (question_id, position, label, text, is_correct) values
    ((select question_id from seeded), 1, 'A', '2/4',  true ),
    ((select question_id from seeded), 2, 'B', '3/5',  false),
    ((select question_id from seeded), 3, 'C', '5/10', true );

drop table seeded;
```

**Do not attach them by matching the prompt either.** SQLite does not error when a scalar subquery
matches several rows — it silently takes the first — so a teacher writing a question with the same
prompt would have the options attached to hers. Verified: it returns the first match and says
nothing.

## Considered and dropped

A separate seed process — a content file, a script, and a `seed_key` column so the script could tell
"already there" from "new". It was dropped because insert-only had already made it a hand-rolled
copy of what Flyway does: the key existed only to answer "has this been applied?", which is exactly
what `flyway_schema_history` answers, and the file existed only to allow editing content that this
rule says is never edited.

## Not needed, and why

- **`teacher_edited_at`** — only earns its place if a process ever *updates* existing questions
  unattended, and has to decide whether a row is still ours. Insert-only never updates, so there is
  nothing to decide.
- **A content file as the source of truth** — that is bulk content management. The real bank arrives
  through the admin API and the CSV import (`specs/question-bank-plan.md`), not through here.
