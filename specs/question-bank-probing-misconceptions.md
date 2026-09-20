# Question bank spec: Year 7/8 Number & Algebra, built to reveal misconceptions

**Goal:** a question bank for Year 7/8 (ages ~11–13) across Number and Algebra, where the wrong
options are diagnostic — a wrong answer points at *which* misconception a student holds.
**Later:** geometry, measures, statistics and probability once image support exists; then Year 9, then GCSE.
*(How items are seeded and loaded is decided in
[`how-to-seed-the-question-bank.md`](how-to-seed-the-question-bank.md); this document is about
the content. `content/README.md` describes the written bank.)*

---

## 1. Scope

| | |
|---|---|
| **Audience** | Year 7 and Year 8, UK Key Stage 3. Age ~11–13. |
| **Size** | 12 Number and Algebra topics. Roughly 200 items is the expectation, not a quota: each topic gets as many good items as it earns. |
| **Spine** | DfE *[Mathematics guidance: Key Stage 3](https://assets.publishing.service.gov.uk/media/621629ac8fa8f5490d52ee78/KS3_NonStatutory_Guidance_Sept_2021_FINAL_NCETM.pdf)* (2021). Its Year 7/8 units define the topics; its "common difficulties and misconceptions" passages are the source for distractors. Every register row is sourced, and most are quoted from them (§4). |
| **Held** | Geometry, measures, statistics and probability. They need pictures. They return as a later set (≈ +100 questions, for ~300 total). |

Two constraints on the writing: **text only** (no diagrams; describe values in words or coordinate
pairs), and **tick-all is all-or-nothing** — so an item's diagnostic value must never depend on
partial credit.

**Provenance.** The topic list is the DfE Year 7/8 framework, split or merged only where the table
says so. Each register row is either a misconception quoted from the DfE/NCETM guidance or standard
subject knowledge marked as such (§4); none is taken from a third-party question bank, scheme of work
or proprietary resource.

### 1.1 The guidance, and where to read it

Crown copyright, Open Government Licence v3.0.

| | |
|---|---|
| Publication page | <https://www.gov.uk/government/publications/teaching-mathematics-at-key-stage-3> |
| The guidance | [Mathematics guidance: Key Stage 3](https://assets.publishing.service.gov.uk/media/621629ac8fa8f5490d52ee78/KS3_NonStatutory_Guidance_Sept_2021_FINAL_NCETM.pdf) — PDF, 295 pages, published 28 September 2021 by the DfE with NCETM |
| The framework | [Sample Key Stage 3 Mathematics Curriculum Framework](https://assets.publishing.service.gov.uk/government/uploads/system/uploads/attachment_data/file/1020889/Sample_Key_Stage_3_Mathematics_Curriculum_Framework.pdf) — the year-by-year framework §2's units come from |
| NCETM's summary | <https://www.ncetm.org.uk/features/the-dfe-ks3-maths-guidance-what-you-need-to-know/> |
| The units, one file each | NCETM reproduces the guidance unit by unit as `ncetm_ks3_cc_1_1.pdf`, `…_1_2.pdf`, and so on under <https://www.ncetm.org.uk/>. These extract cleanly as text; the 295-page PDF does not. |

The misconception material is **not** collected in an appendix. It sits inside each *Exemplified
significant key idea*, as a passage headed **Common difficulties and misconceptions:**, so it is
distributed by key idea — and §2's topics map onto those key ideas directly. The document contains
87 uses of "misconception" and 53 passages headed "common difficulties and misconceptions".

When writing or reviewing a distractor, find the unit in the guidance and read that passage first.
That is where the register's rows come from, and it is what makes a wrong option diagnostic rather
than merely wrong. For example, `PROP-MULTIPLE-LIMIT` paraphrases the guidance on multiples:

**This is required, not advice:** a topic is not written until its unit's passages have been read and
its register rows cite them. Round one skipped this step, and it is the single change most likely to
fix the bank.

> "…can lead to misconceptions, such as **thinking that numbers have only 12 multiples** or that
> numbers outside of the times tables do not have multiples."

The framework's own unit names and terms are the check on §2's table: *Year 7 autumn — Place value,
Properties of number: factors, multiples, squares and cubes, Arithmetic procedures with integers and
decimals, Expressions and equations*; *Year 8 autumn — Estimation and rounding, Sequences, Graphical
representations of linear relationships, Solving linear equations*.

---

## 2. Topics

The Year 7/8 Number and Algebra units from the DfE framework, with student-facing names.

| # | slug | Topic | Strand | DfE unit (Y7/Y8) | Round 1 |
|---|---|---|---|---|---|
| 1 | `place-value` | Place value & ordering | Number | Place value (Y7) | 14 |
| 2 | `properties-of-number` | Factors, multiples, primes, squares & cubes | Number | Properties of number: factors, multiples, squares & cubes (Y7) | 18 |
| 3 | `integers-and-decimals` | Arithmetic with integers & decimals | Number | Arithmetic procedures with integers & decimals (Y7) | 18 |
| 4 | `rounding-and-estimation` | Rounding & estimation | Number | Estimation and rounding (Y8) | 16 |
| 5 | `fractions` | Fractions | Number | Arithmetic procedures including fractions (Y7) | 20 |
| 6 | `fractions-decimals-percentages` | Fractions, decimals & percentages | Number | Multiplicative relationships: fractions, ratio, percentages (Y7/Y8) | 18 |
| 7 | `ratio-and-proportion` | Ratio & proportion | Number | Multiplicative relationships: ratio & proportionality (Y7/Y8) | 16 |
| 8 | `expressions-and-simplifying` | Expressions & simplifying | Algebra | Expressions and equations: notation & simplifying (Y7) | 18 |
| 9 | `expanding-and-factorising` | Expanding & factorising | Algebra | Expressions and equations: distributive law (Y7) | 16 |
| 10 | `solving-equations` | Solving linear equations | Algebra | Solving linear equations (Y8) | 18 |
| 11 | `sequences` | Sequences | Algebra | Sequences (Y8) | 16 |
| 12 | `coordinates-and-linear-graphs` | Coordinates & linear graphs | Algebra | Plotting coordinates (Y7); graphical representations (Y8) | 12 |
| | | | | **Total** | **200** |

- **Fractions and FDP are deepest** — most documented misconceptions, most Y7/Y8 time.
- **`coordinates-and-linear-graphs`** uses text-only forms (value pairs, equation from points,
  midpoint, gradient). Anything needing the graph itself is held.
- **Units and compound measures** fold into `ratio-and-proportion`, not a thin topic of their own.
- Names and slugs are editable in the admin topic editor.

The **Round 1** column is round one's output, kept for comparison. It is not a target.

**Shape of a topic.** Bands are a guide, not a quota: roughly a quarter band 1, a third band 2, a
quarter band 3, a sixth band 4. Every topic carries one bridge word problem and one retention item.
The rest is decided by §3.1 — a spread of activities, not a count of misconception families. A topic
is finished when it is varied and every register row it uses is exercised, not when it reaches a
number.

---

## 3. Writing diagnostic questions

| Archetype | How it works | Best for |
|---|---|---|
| **A. Diagnostic distractor** (single) | Each wrong option is a documented error, not a random wrong number. | Procedural slips, one clear wrong method. |
| **B. Claim sorting** (tick-all) | Each option is an independent item — a value, expression, calculation or point to work on, or a statement to judge; the key is the set that qualifies. A student holding a misconception over-ticks exactly that item, *even if they know the right method*. | Conceptual errors, over-generalisations. The strongest instrument, and the easiest to over-use: a tick-all whose options are all propositions is a true/false list. |
| **C. Boundary / edge case** | Numbers chosen so the routine misbehaves: `6 ÷ 0.5`, `0.512` to 1sf, a negative solution. | "Multiplication makes bigger", rounding traps. |
| **D. Error spotting** | A flawed worked solution is shown; the student names the error. | Inverse-operation order, sign errors. |
| **E. Non-example / "which is NOT…"** | Discrimination at the edge of a definition: is 1 prime, is `6x + 9` fully factorised. | Definitional misconceptions. |
| **F. Reversed** | Asks for the input, the original amount, the missing term. | One-way procedural understanding. |
| **G. Method / form match** | "Which calculation gives the answer?", "which expression is equivalent?" | Confusing related procedures. |
| **H. Always / sometimes / never** | A generalisation is tested against the whole domain. | Over-generalising from limited examples. |

**Building a diagnostic distractor.** Name the error first, then let it write the option:

1. State the misconception in one sentence ("adds the numerators and the denominators").
2. Work out exactly what answer a student holding it would produce (`2/5` for `1/2 + 1/3`).
3. Make that answer an option, worded as attractively as the correct one.
4. Choose numbers where the correct and mistaken answers differ, so the item discriminates.
5. Write the explanation to name the error, so the student recognises themselves.

**The explanation must:** state the correct method; name the likely error; say why it is wrong. For a
tick-all item, run briefly through every false claim.

**Every distractor must name a misconception from §4.** If it cannot be explained as a plausible
student error, it is decoration and is rewritten.

### 3.1 Making it engaging

**Engaging is the requirement.** This bank is for 11–13 year olds in a classroom, not a compliance
artefact. An item a student will not willingly do, or will not learn from getting wrong, has failed
however well it covers a misconception or scores on a check. Everything below is a requirement, not
a preference.

The register is a device for diagnosing, not a plan for a bank. Writing from it — one item per
misconception, each hit two or three times — produces coverage, and if nothing else is required it
also produces uniformity. The first pass at this bank came out **74% archetypes A and B**, with
**77 of 89 tick-alls sharing one stem** and **only 12 items in any real context**. Every check
passed. It was boring.

- **Write the task first.** Decide what the student is asked to *do* — work out, estimate, order,
  compare, classify, find the mistake, find a counter-example, explain — then choose the wrong
  answers that catch a misconception. Never start from a misconception code and look for a question
  to hang it on. The misconception decides the distractor, not the question.
- **Vary the activity, not just the numbers.** Within a topic, no two consecutive items do the same
  thing, at least four of the eight archetypes appear, and A and B together are at most half of it.
  Across the bank, A and B are at most half and D–H at least a quarter.
- **Make the options things to work on, not sentences to judge.** Prefer values, expressions,
  calculations, points or results, so the student does the maths on each one. Claim-sorting (a
  tick-all) is the strongest instrument for a conceptual error, but it is **all-or-nothing** and the
  most tiring shape to answer, because every option has to be judged and a partial grip scores
  nothing. Keep tick-all items to about **one in ten**, and no more than two in a topic; use a
  single-choice non-example (*"which is not…"*) wherever one pass will do.
- **Use context, and more than one per topic.** The bridge item is not the only place a real
  situation belongs: money, measurement, time, temperature, recipes, sport, coordinates. A topic of
  pure abstraction reads as a worksheet of tricks. But a bit is enough — a handful of real situations
  across a topic, not one bolted onto every item. Context is a garnish, not a quota: a forced
  situation (a ticket price that exists only to make you multiply) is worse than a clean abstract
  question, and getting one on every item is its own kind of monotony.
- **Use different representations.** A table, a described number line, a pair of coordinates, a
  ratio, a word problem, an equation. Text only, so describe them — but change them.
- **Vary the stem.** Repeated wording is a tic, and it is the **opening** that gives it away, not
  only an identical full prompt. No phrase should open more than a handful of items. Round two's
  first pass made all 36 tick-alls open *"Tick every …"* — a new tic in the same shape as round
  one's — and over-correcting then pushed 17 items into *"Which of these …"*. Mix the constructions:
  *Which …*, *Find the …*, *One of these is not …*, *Three of these are …*, *Work out …*, *A number
  has …*. Check it: `python3 content/render.py --stats` reports the commonest three-word openings
  and the tick-all share, so neither mistake can be made silently again.
- **Write in plain language a Year 7 would recognise.** The words are not the test. Say *"Tick every
  number that is equal to 0.1."*, *"Write 43 872 in hundreds."*, *"Which number has a 2 in the
  hundredths column?"* — not *"Each set labels one place-value column four ways. Which set all name
  the same column?"*, which asks an 11-year-old to parse an abstract sentence before doing any
  mathematics. Keep prompts short and direct (*What is …*, *Work out …*, *Which …*, *Tick every …*),
  prefer the concrete to the abstract, and keep the difficulty in the mathematics. Use everyday words
  where the term is not the thing being taught: *the same as*, not *equivalent*; *digits after the
  point* unless *decimal places* is the point of the item. A prompt that has to be read twice to be
  understood is rewritten, however good the mathematics behind it. The
  prototype's 33 seed questions
  (`backend/src/main/resources/db/migration/V2__seed_questions.sql`) are the register to copy for
  tone, whatever one thinks of their content.
- **No tortured grammar.** One clause, one question, and **no negated comparisons**. Negating a
  category is fine — *"Which is not a factor of 30?"* is a legitimate non-example (archetype E) —
  but negating a comparison makes the reader untangle English before doing any mathematics:
  *"Which fraction is not smaller than 1/5?"* has to be *"Which fraction is bigger than 1/5?"*.
  The same goes for stacked negatives and for a question wrapped in a relative clause. If a prompt
  has to be *parsed* rather than read, it is rewritten.
- **No trick questions.** Test the mathematics, not the notation. An item whose whole difficulty is
  an unusual form — *"Write 10⁻¹ as a decimal."* — is a riddle, not a task: no one asks a Year 7 to
  convert a negative power of ten in isolation, so such an item measures whether the notation has
  been seen, not whether the mathematics is understood. If a form is worth testing (a fraction
  heading on a place-value chart, a decimal to convert), put it where students actually meet it, as
  one part of a real task.
- **Take the tasks from the guidance.** The DfE/NCETM units carry worked examples and *sample
  questions* for each significant key idea, alongside the misconception passages. Those are the
  intended tasks for the year; start from them and attach the distractors, rather than inventing
  traps.
- **The test:** would a student be willing to do this item, and would they learn something by getting
  it wrong? An item with no point beyond the trap is rewritten, however well it scores below.

---

## 4. Misconception register

The errors items are written against. The register itself is `content/misconceptions.json`: one code
per error, with a description and its topic. Every wrong option in the bank carries a `catches` code
from it, `content/render.py` fails if any other code appears, and the loader stores the code on the
option (`answer_options.misconception_code`) so a wrong answer can be read as a named error. The
admin screens use the register to tell a teacher what picking a given wrong option usually means.

**Every row must be sourced.** A register row is either

- a difficulty the DfE/NCETM guidance names, **quoted** from the unit's *Common difficulties and
  misconceptions* passage, with the unit number; or
- standard subject knowledge, marked as such.

Round one's register was written from general knowledge and cited nothing. Checked against the
guidance for just two units, several rows were thinner or differently aimed than the passages that
actually name the difficulty (place value's *same value, different appearance*; properties of
number's *reading `2 × 3 × 5` as a structure*). So round two builds each topic's rows **by reading the
unit first**, and every entry records where it came from. A code that cannot be sourced is deleted
and its items rewritten.

---

## 5. Exemplars

One worked item per archetype, so the spec demonstrates the range it asks for. In each, the **bold**
option is the key; the other options are named by the misconception they catch. These show *shape*,
not a template: an item that copies another item's shape is rewritten, however well it scores.

**A. Diagnostic distractor** — `fractions`, single, band 2. *What is 3/4 of 20?*
**`15`** · `5` · `60` · `26.67`
**Catches:** `5` divides by the denominator and stops; `60` multiplies by the numerator only;
`26.67` divides by the fraction instead of multiplying.
**Why:** 20 ÷ 4 = 5 is one quarter, and 3 × 5 = 15 is three of them.

**B. Claim sorting** — `place-value`, tick-all, band 3. *Tick every number in which the digit 7 has
the value 7 hundredths.*
**`0.07`** · **`12.074`** · `0.7` · `7.02` · `0.007`
**Catches:** `0.7` reads tenths; `7.02` puts the 7 in the units column; `0.007` puts it in thousandths.
**Why:** the columns after the point are tenths, hundredths, thousandths. The 0 in 12.074 holds the
tenths column, so the 7 is again hundredths.
**Note:** the options are *values to work on*, not statements to judge. A tick-all whose options are
all propositions is a true/false list, and that is the commonest way to make this bank boring.

**C. Boundary / edge case** — `solving-equations`, single, band 4. *Solve `x + 5 = 2`.*
**`x = −3`** · `x = 3` · `x = 7` · `There is no solution`
**Catches:** `3` keeps the size and drops the sign; `7` adds 5 instead of subtracting it; "no
solution" rejects a negative answer as impossible.
**Why:** subtract 5 from both sides. A negative solution is a solution.

**D. Error spotting** — `properties-of-number`, single, band 2. *Mia writes `3² = 6` and says "you
multiply by 2". What has she done?*
**Multiplied the base by the exponent instead of by itself** · found the square root instead · worked
out `2³` instead of `3²` · added the base and the exponent
**Catches:** the three distractors are other real errors; the one on show is the first — `3 × 2 = 6`,
not `3 × 3 = 9`.
**Why:** the index says how many copies of the base to multiply.

**E. Non-example** — `rounding-and-estimation`, single, band 4. *Which of these numbers does NOT
round to 0.3 when rounded to 1 significant figure?*
`0.27` · `0.34` · `0.25` · **`0.35`**
**Catches:** the other three do round to 0.3, so picking one of them is a rounding error, not a
misread of the question.
**Why:** at 1 sf the first digit is the tenths digit, and 0.35 rounds up to 0.4.

**F. Reversed** — `fractions-decimals-percentages`, single, band 4. *In a sale a coat is reduced by
25% and now costs £45. What was the original price?*
**`£60`** · `£56.25` · `£33.75`
**Catches:** `£56.25` adds 25% of £45 back on, which overshoots; `£33.75` takes another 25% off.
**Why:** £45 is 75% of the original, so the original is £45 ÷ 0.75.

**G. Method / form match** — `integers-and-decimals`, single, band 3. *Which of these calculations
gives the answer 12?*
**`6 ÷ 0.5`** · `6 × 0.5` · `6 + 0.5` · `6 − 0.5`
**Catches:** `6 × 0.5` halves, because multiplication is assumed to make bigger; adding and
subtracting move the number only a little.
**Why:** 6 ÷ 0.5 asks how many halves are in 6, which is 12.

**H. Always / sometimes / never** — `sequences`, single, band 3. *Is it always, sometimes or never
true that the 10th term of a sequence is twice the 5th term?*
`Always` · **`Sometimes`** · `Never`
**Catches:** "always" generalises from a sequence like 1, 2, 3, …; "never" ignores that such a
sequence exists.
**Why:** in 1, 2, 3, … the 5th term is 5 and the 10th is 10, so it holds there; in 4, 7, 10, … they
are 16 and 31, so it does not hold in general. A property of one example is not a property of the
class.

---

## 6. Bank composition

- **Every register row a topic uses is exercised**, in more than one form where the row is broad, so
  the surface cannot be pattern-matched.
- **One bridge item** per topic: a short word problem in context.
- **One retention item** per topic: revisits a prerequisite (e.g. equations includes a substitution
  check; fractions includes an equivalence check).
- **Spread across activities, not only across misconception families.** The families say what to
  diagnose; §3.1 says how much variety that has to be dressed in.
- **The prototype's seed questions are not kept.** When this bank lands they are retired rather than
  folded into these topics — one statement, `update questions set status = 'RETIRED' where origin
  = 'SEED'` (see `specs/how-to-seed-the-question-bank.md`). There are 32 live ones, not 33: the duplicate primes question
  was already retired. Nothing here may rely on them, so each topic's allocation has to cover its own
  band-1/2 fluency.

**Content QA for every item**

1. Exactly one defensible answer set; no option arguable.
2. Every distractor maps to a named misconception, and that is the most likely reason it is picked.
3. Numbers chosen to expose the misconception, not to be tidy.
4. Explanation names the likely error, not just the correct method.
5. Plain language a Year 7 would use, and reading load below mathematical load (§3.1). A prompt that
   has to be read twice to be understood is rewritten.
6. No giveaways (longest-option-is-right, "all of the above", grammar mismatches, prompt echo).
7. Tick-all: true claims unambiguously true for all stated values; false claims unambiguously false.
8. Second read for subject accuracy and for the misconception claim itself.
9. It is a task someone would want to do, not only a claim that can be defended, and it does not
   repeat another item's shape or stem (§3.1).

**Status.** Round one produced 200 items and was rejected as monotone: 74% archetypes A and B, one
stem on 77 of 89 tick-alls, most options propositions, only 12 items in context (§3.1). The structure,
the loader and the stored misconception codes are sound and are kept; the items are being rebuilt
task-first from the guidance, one topic at a time, each reviewed before the next (§7). The round-one
bank stays in `content/bank/` until it is replaced item by item.

---

## 7. How round two is done

Round one's failure was process as much as content: one agent wrote this spec, a second wrote all 200
items from it without ever reading the guidance, and nobody looked at an item until the bank was
finished. Round two fixes the process first.

**One unit at a time.** For each topic:

1. **Read the guidance unit** — its *Common difficulties and misconceptions* passage and its sample
   questions — and write the unit's register rows with citations (§4).
2. **Write the items task-first** (§3.1), starting from the guidance's own tasks where it gives them.
3. **Review that topic before starting the next.** A person reads it and says whether it is worth
   doing. This is the gate round one skipped.
4. Then the next unit.

**Salvage what survives.** Not everything round one wrote is bad: the task-shaped place-value items,
the single-choice diagnostic items, and the error-spotting, reversed, non-example and method-match
items are kept where they pass review. The propositional tick-all monoculture is rewritten, and the
register is rebuilt from the guidance.

**Open decisions**

1. **Topic allocations.** The 12 topics and their order are settled; the per-topic counts are not.
   Each topic gets as many good items as it earns.
2. **Quadratic factorising.** Whether monic quadratics belong in Year 7/8 is open — decide it when
   `expanding-and-factorising`'s unit is read, not in advance.
3. **Archetype H.** Round one used A–G and no H. §3.1 requires the spread, so H appears at least a
   few times in round two.

**Held, unchanged.** Geometry, measures, statistics and probability wait for image support, then
Year 9, then GCSE.
