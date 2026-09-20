# Seeding content

**Status:** the rule is decided, and the bank is now loaded by it. What the loader has to carry is
set out below. Flyway version numbers are not this spec's business — the implementing agent picks
them.

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
item. The read is done: it re-checked every item's answerability and every distractor's tagged
misconception, fixed explanations that did not support their answer, and removed an option that was
in fact true. That is the kind of change the loader must not have to carry, and it does not have to.

### Generated, not hand-written

200 questions is roughly 1,000 statements. Nobody writes that by hand, and `render.py` deliberately
emits no SQL. So a generator reads the same JSON:

```
python3 content/render.py --check          # the bank must be valid first
python3 scripts/generate_bank_migration.py --version <next free>
```

It writes the load migration and prints the counts. Commit the generator and the SQL it produced: the
SQL is the record of what was loaded and is reviewed as such, and the generator is what makes a later
batch reproducible. Flyway version numbers, and the ordering noted under *What each row needs*, are
the implementing agent's to work out. Generating during the build is not an option — content is not
part of the build.

**One migration for the bank, not twelve.** Topic order does not matter, and a file per topic for one
content drop is noise. The prototype retirement is a migration of its own, because retiring is a
separate act from seeding — and, as *origin* below explains, it has to run first.

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
| `origin` | `SEED` — see below |
| `misconception_code` | the option's `catches`, on wrong options only |

**`year_group` is the trap.** It is `NOT NULL default 7`, so forgetting it is not an error — it files
the question as Year 7. **62 of the 200 are Year 8**, and they would become invisible to anyone
practising at Year 8, which is what the year-group migration's own comment warns about. The value lives on the topic, not
the question; no question carries its own.

**`origin` records where a question came from**, which is the only reason the column exists:

- `SEED` — inserted by a migration, out of this repository. The app ships with it, and it is *ours*.
  The prototype bank and the new bank are both `SEED`.
- `AUTHORED` — typed by a teacher in the admin screens. Hers.
- `IMPORTED` — brought in through the importer, from a spreadsheet that started outside this
  repository. Also hers.

The new bank is `SEED`. The consequence is an ordering, not a problem: the prototype sweep is
`update questions set status = 'RETIRED' where origin = 'SEED'`, so it has to run **before** the bank
is inserted, or it would retire the new bank too. Keep the retirement in its own migration, earlier
than the load.

**Do not add a `seed_key`.** It was designed, built, and dropped: Flyway's history already answers
"has this been applied", and content is never updated, so nothing needs a second identity. The keys
in the JSON files are for the files.

**Store the misconception codes, and show them to the teacher.** Every wrong option is written to
catch a named error, recorded as `catches` in the JSON. That is the bank's whole diagnostic value: a
wrong answer should tell the teacher *which* error the student made, not merely that they made one.
Dropping the code on load leaves the diagnosis written but unreadable, so the loader must store it:

| table | column | value |
|---|---|---|
| `answer_options` | `misconception_code` | the option's `catches`, on wrong options only; null on a correct option |

The code alone is not enough to show a teacher: `FRAC-ADD-ACROSS` is not a sentence. The register
that defines it — the code, its description and its topic — is `content/misconceptions.json`, and it
has to be readable at runtime too, so the admin screens can show, against a wrong option, what
picking it usually means. A `misconceptions` table seeded from the file is the obvious home;
bundling the file and serving it is the alternative. A stored code with nothing able to read it is
the same half-built promise in a new place.

### Order within the migration

Insert a question, then its options, and let the options find the question by the temp-table idiom in
*Two traps* below — never `last_insert_rowid()` and never a prompt lookup. The question has to exist
first, because `answer_options_single_choice_insert` reads the parent's `answer_type`.

### What to check afterwards

The loader is silent when it works and silent when it half-works, so assert it:

- 200 questions with `origin = 'SEED'`, and the 33 prototype questions `RETIRED`
- the twelve per-topic counts: 14, 18, 18, 16, 20, 18, 16, 18, 16, 18, 16, 12
- 138 in `year_group` 7 and 62 in 8
- 90 `MULTI_SELECT` and 110 `SINGLE_CHOICE`
- every question has 2–6 options; every single choice exactly one correct; every tick-all at least one
- every wrong option carries a `misconception_code`, no correct option does, and every code appears
  in the register
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

Both loose ends are handled:

- **The student list already hides a topic with nothing published** for the chosen year —
  `QuestionCatalogService.listTopics` filters on the published count. The teacher's screens keep
  showing every topic, because she needs to see one she has just created.
- **`fractions` is reused** for the new topic and renamed, and `fractions-decimals-percentages` is
  created fresh. See *Writing the loader*.

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

The generator that writes the load migration is not that process. It runs by hand, once, and its
output is committed; it holds no state and never opens a database.

## Not needed, and why

- **`teacher_edited_at`** — only earns its place if a process ever *updates* existing questions
  unattended, and has to decide whether a row is still ours. Insert-only never updates, so there is
  nothing to decide.
- **A content file as the source of truth at runtime** — `content/bank` is where the load migration
  is generated from, and `content/misconceptions.json` is where the codes are defined. Neither is
  read by the running app or mirrored back out once loaded: a question is changed in the admin
  screens, not in the file.
