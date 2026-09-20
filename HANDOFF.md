# Handoff — question bank, round two

**This file is state, not design.** The design is `specs/question-bank-probing-misconceptions.md`.
Delete this file once the next session has picked the work up. It exists because the previous
session's context is about to be cleared and the things below are not inferable from the code.

---

## Where the work stands

Round one wrote all 200 items (`content/bank/*.json`) and loaded them. It was **rejected as
monotone** and is being rebuilt task-first, one topic at a time. The diagnosis and the numbers are
in the spec, §3.1 and §6.

The spec has been trimmed for round two: the invented register table is gone, the quotas are gone,
§3.1 (making it engaging) and §7 (the process) are new, and the exemplars are now one per archetype.
**Read the spec before touching content.**

## What is sound and should be kept

- `content/render.py` — validates the bank and renders it for reading. Keep as is; add the
  anti-monotony checks listed below when convenient.
- `scripts/generate_bank_migration.py` — turns `content/bank/*.json` into an insert-only migration.
  Usage: `python3 scripts/generate_bank_migration.py --version <next free>`.
- The schema and loader: `V9__answer_option_misconception_code.sql`,
  `V10__retire_prototype_question_bank.sql`, `V11__load_question_bank.sql`. V11 is generated; do not
  hand-edit it, regenerate from the JSON. A migration that has been applied must never be edited —
  generate the next version instead.
- Misconception codes are **stored**, in `answer_options.misconception_code`, and surfaced to the
  teacher from `content/misconceptions.json`. That is deliberate (see the seed spec).
- `content/README.md` documents the item shape.

## What to salvage from round one

Keep where review passes:

- **The reworked `place-value` topic** — it is the worked example of the new shape: task tick-alls
  ("tick every number greater than 0.5"), one option per misconception, 4–5 options.
- **Single-choice diagnostic items** (archetype A) across topics.
- **D, E, F, G items** — e.g. `pv-error-power-ten`, `rnd-not-round-to-03`,
  `frac-reverse-three-fifths`, `fdp-increase-multiplier`, `alg-five-more-than-n`,
  `eq-bridge-think-of-a-number`.
- Bridge and retention items, where they read as tasks.

Rewrite: the propositional tick-alls. **77 of 89 used the identical stem**, most options were
sentences to judge, and only 12 of 200 items had any context.

## Where the guidance is

The spine is the DfE/NCETM *Mathematics guidance: Key Stage 3*. The 295-page PDF does not extract as
text. The NCETM per-unit files do, and are the practical source:

```bash
curl -sL -o ncetm_1_1.pdf https://www.ncetm.org.uk/media/ounhep23/ncetm_ks3_cc_1_1.pdf
curl -sL -o ncetm_1_2.pdf https://www.ncetm.org.uk/media/dexn0sbp/ncetm_ks3_cc_1_2.pdf
python3 -c "import pypdf;print('\n'.join(p.extract_text() for p in pypdf.PdfReader('ncetm_1_1.pdf').pages))"
```

The misconception passages are headed **Common difficulties and misconceptions** and sit inside each
exemplified key idea, not in an appendix. `grep` the extracted text for that heading.

### Passages already extracted (the only copy — /tmp is ephemeral)

From `ncetm_ks3_cc_1_1.pdf` (confirm the unit heading in the file before citing):

> Students are likely familiar with place value charts and the column headings ... but may need to
> revisit column headings written as fractions and exponents. Understanding that a mathematical
> object can have the 'same value but a different appearance' is a key understanding in maths, and
> students may find it challenging to recognise that a column headed as tenths, 1/10, 0.1 or 10⁻¹
> will represent digits of equal value.

> Students may see the task of rounding as an algorithm to follow without appreciating the idea that
> they are trying to find a number ... to which the chosen number is closer. For example, students
> may keep on rounding until they achieve a number to one significant figure, thus:
> 3 472 → 3 470 → 3 500 → 4 000 ... and not realise that 3 472 is closer to 3 000 than 4 000. ...
> Students can also find it challenging to identify when a zero digit is significant.

> ... some students may find it hard to recall at which stage the rounding should take place. This
> can result in the misconception that estimation involves rounding the final result of a
> calculation, rather than rounding the numbers involved prior to calculating.

From `ncetm_ks3_cc_1_2.pdf`:

> Students often find multiples of an integer by listing numbers in the specified times table. This
> strategy is efficient for small numbers of multiples but can lead to misconceptions, such as
> thinking that numbers have only 12 multiples or that numbers outside of the times tables do not
> have multiples.

> ... students are [not always] at ease with the idea that 2 × 3 × 5 is just another way of
> expressing the number 30 and does not need to be calculated. ... When asked whether 2 × 3 × 5 is a
> multiple of ten, it is not uncommon for students to multiply the three factors together to obtain
> 30 before they are able to say that it is a multiple of ten. ... we cannot be sure that five is the
> highest common factor unless each number is written as the product of prime factors.

**Note what round one missed:** *same value, different appearance* (tenths = 1/10 = 0.1 = 10⁻¹),
repeated rounding to 1 sf, and reading `2 × 3 × 5` as a structure. The round-one register cited
nothing and its rows are not trustworthy; rebuild each topic's rows from these passages, with the
unit number recorded, before writing its items.

## Local environment

- API runs on **http://localhost:8081** (`cd backend && mvn -o spring-boot:run`). It was left
  running. Catalog endpoints need a token: `POST /api/auth/guest` returns one.
- Database: `backend/data/realmaths.db`, currently at **V1–V11**, holding **200 published SEED
  questions and 33 retired prototype ones**, 568 options carrying a misconception code.
- **Reset:** stop the app, `rm backend/data/realmaths.db*`, restart. Flyway rebuilds and reloads.
  The pre-V9 database is backed up at `/tmp/realmaths-db-v9-backup/`.
- **Gotcha:** `mvn spring-boot:run` uses `backend/target/classes`, which kept a deleted
  `V9__seed_key.sql` and made Flyway fail with *"Found more than one migration with version 9"*.
  If a migration is renamed or deleted, delete its stale copy from `target/classes/db/migration/`
  or run `mvn clean`.

## Uncommitted state

`git status` shows, from this session:

- modified `content/bank/*.json`, `content/misconceptions.json`, `content/README.md`,
  `specs/how-to-seed-the-question-bank.md`, `specs/question-bank-probing-misconceptions.md`
- untracked `V9`, `V10`, `V11` migrations and `scripts/generate_bank_migration.py`

Commit those paths before clearing context. **Do not `git add -A`:** another agent is working in the
frontend on a plot-points answer type (`frontend/src/lib/plotItem.ts`,
`frontend/src/pages/DevPlotPage.tsx`, `specs/plot-points-answer-type.md`, `frontend/src/App.tsx`).

## Next step

**Unit 1.1, place value**, in a fresh session:

1. Extract and read the unit's *Common difficulties and misconceptions* passage and its sample
   questions.
2. Write the unit's register rows with citations, into `content/misconceptions.json`.
3. Write ~15 items task-first (§3.1), salvaging the reworked place-value items that pass.
4. Run `python3 content/render.py --check`.
5. **Stop and get a review before writing the next topic.** That gate is the whole point.

Suggested additions to `render.py` so the next round catches what round one did not: no stem used
more than a handful of times; share of options that are propositions; archetype spread per topic and
across the bank; options per tick-all.

## Open decisions

- Per-topic question counts — no quotas; each topic gets as many good items as it earns.
- Whether monic quadratic factorising belongs in Year 7/8 (decide when that unit is read).
- Archetype H should appear a few times; round one used none.
