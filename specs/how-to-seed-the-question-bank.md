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

One migration per batch: three questions in one, five more in the next. Each applies once, on every
database, in order. Several rounds of seeding are just several migrations, and re-running is not a
thing that happens — which is why nothing needs to detect duplicates.

The consequence to accept: **you cannot keep appending to one seed file and re-run it.** "Seed
again" means "write another migration". If a single growing file that you run repeatedly is what you
want, Flyway is the wrong tool.

## Writing the loader

Getting `content/bank/*.json` into a database. Written once, after the second read.

### After the second read, not before

An applied migration is frozen and content is never updated, so a loader that lands before the read
finishes cannot absorb its corrections — they would have to be redone in the admin screens, item by
item. The read is in progress as this is written and has already dropped a distractor that duplicated
another's misconception and rewritten explanations across all twelve topics. That is precisely the
kind of change the loader must not have to carry.

### Generated, not hand-written

200 questions is roughly 1,000 statements. Nobody writes that by hand, and `render.py` deliberately
emits no SQL. So a generator sits beside it, reading the same JSON:

```
python3 content/to_sql.py > backend/src/main/resources/db/migration/V9__question_bank.sql
```

Commit the generator and the SQL it produced. The SQL is the record of what was loaded and is
reviewed as such; the generator is what makes it reproducible when a topic is added later.
Generating during the build is not an option — content is not part of the build.

**One migration, not twelve.** Topic order does not matter, and twelve numbered files for one
content drop is noise.

### The version number

`V8` is the highest applied anywhere, so this is `V9` — **unless** a database has the abandoned
`seed_key` work applied. That was never pushed, but it recorded itself as `V9` on local machines, and
an edited or deleted migration breaks that database at startup. Reset such a database rather than
renumbering around it.

### Topics first, and one of them already exists

Questions reference a topic, so the twelve topics must exist first. Most are new. **`fractions` is
not:** the prototype already has a topic with that slug, named "Fractions, Decimals & Percentages",
and the plan wants that slug for "Fractions".

Reuse the existing row and rename it. Its seven prototype questions are retired in the same drop, so
the row is empty by the time the new questions arrive, and `fractions-decimals-percentages` is
created fresh. That settles the collision without inventing a slug.

Do **not** delete the topics the new bank does not use — `number`, `algebra`, `geometry`, `data`.
`geometry` and `data` are exactly where the held geometry, measures, statistics and probability sets
will land. Deleting a topic cascades to its questions and takes the answer history with it.

### What each row needs

| column | comes from |
|---|---|
| `topic_id` | the topic file's `slug`, looked up |
| `prompt`, `explanation` | the question |
| `difficulty` | the question's `band` |
| `answer_type` | the question's `answerType` |
| `year_group` | the **topic** file's `yearGroup` — see below |
| `status` | `PUBLISHED`; the second read is the review, and the default is `DRAFT` |
| `origin` | `IMPORTED` — see below |

**`year_group` is the trap.** It is `NOT NULL default 7`, so forgetting it is not an error — it files
the question as Year 7. **62 of the 200 are Year 8**, and they would become invisible to anyone
practising at Year 8, which is what `V8`'s own comment warns about. The value lives on the topic, not
the question; no question carries its own.

**`origin` decides whether the new bank survives the sweep.** The prototype is retired with
`update questions set status = 'RETIRED' where origin = 'SEED'`. Were the new bank also `SEED`, that
statement would retire it too. `IMPORTED` keeps the two distinguishable, and then the sweep can run
in either order. That value is currently unused; this is what it was for.

**Do not add a `seed_key`.** It was designed, built, and dropped: Flyway's history already answers
"has this been applied", and content is never updated, so nothing needs a second identity. The keys
in the JSON files are for the files.

**Do not store the misconception codes.** `cats`, `archetype` and the register are authoring
metadata; the question-bank spec is explicit that the shorthand is not stored anywhere.

### Order within the migration

Insert a question, then its options, and let the options find the question by the temp-table idiom in
*Two traps* below — never `last_insert_rowid()` and never a prompt lookup. The question has to exist
first, because `answer_options_single_choice_insert` reads the parent's `answer_type`.

### What to check afterwards

The loader is silent when it works and silent when it half-works, so assert it:

- 200 questions with `origin = 'IMPORTED'`
- the twelve per-topic counts: 14, 18, 18, 16, 20, 18, 16, 18, 16, 18, 16, 12
- 138 in `year_group` 7 and 62 in 8
- 90 `MULTI_SELECT` and 110 `SINGLE_CHOICE`
- every question has 2–6 options; every single choice exactly one correct; every tick-all at least one
- the prototype bank is `RETIRED`, and its answers still resolve

A migration test in the style of `SchemaMigrationTest` is the right home — it applies the real
migrations and asserts the bank, so a missing topic or a mis-filed year group fails a test rather
than reaching a teacher as an empty dropdown.

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

This supersedes the assumption in `specs/question-bank-probing-misconceptions.md` §6 that the existing
seed questions
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
  through the admin API and the CSV import (`specs/question-bank-probing-misconceptions.md`), not through here.
