# Question bank spec: Year 7/8 Number & Algebra, built to reveal misconceptions

**Goal:** 200 questions for Year 7/8 (ages ~11–13) across Number and Algebra, where the wrong options
are diagnostic — a wrong answer points at *which* misconception a student holds.
**Later:** geometry, measures, statistics and probability once image support exists; then Year 9, then GCSE.
*(How items are seeded and loaded is decided in [`seeding.md`](seeding.md); this document is about
the content. `content/README.md` describes the written bank.)*

---

## 1. Scope

| | |
|---|---|
| **Audience** | Year 7 and Year 8, UK Key Stage 3. Age ~11–13. |
| **Size** | 200 questions across 12 Number and Algebra topics (12–20 each). |
| **Spine** | DfE *[Mathematics guidance: Key Stage 3](https://assets.publishing.service.gov.uk/media/621629ac8fa8f5490d52ee78/KS3_NonStatutory_Guidance_Sept_2021_FINAL_NCETM.pdf)* (2021). Its Year 7/8 units define the topics; its "common difficulties and misconceptions" passages are the primary source for distractors, with standard subject knowledge where the guidance is silent. |
| **Held** | Geometry, measures, statistics and probability. They need pictures. They return as a later set (≈ +100 questions, for ~300 total). |

Two constraints on the writing: **text only** (no diagrams; describe values in words or coordinate
pairs), and **tick-all is all-or-nothing** — so an item's diagnostic value must never depend on
partial credit.

**Provenance.** The topic list is the DfE Year 7/8 framework, split or merged only where the table
says so. Each register row is either a misconception the DfE guidance names or standard, widely
published subject knowledge; none is taken from a third-party question bank, scheme of work or
proprietary resource.

### 1.1 The guidance, and where to read it

Crown copyright, Open Government Licence v3.0.

| | |
|---|---|
| Publication page | <https://www.gov.uk/government/publications/teaching-mathematics-at-key-stage-3> |
| The guidance | [Mathematics guidance: Key Stage 3](https://assets.publishing.service.gov.uk/media/621629ac8fa8f5490d52ee78/KS3_NonStatutory_Guidance_Sept_2021_FINAL_NCETM.pdf) — PDF, 295 pages, published 28 September 2021 by the DfE with NCETM |
| The framework | [Sample Key Stage 3 Mathematics Curriculum Framework](https://assets.publishing.service.gov.uk/government/uploads/system/uploads/attachment_data/file/1020889/Sample_Key_Stage_3_Mathematics_Curriculum_Framework.pdf) — the year-by-year framework §2's units come from |
| NCETM's summary | <https://www.ncetm.org.uk/features/the-dfe-ks3-maths-guidance-what-you-need-to-know/> |

The misconception material is **not** collected in an appendix. It sits inside each *Exemplified
significant key idea*, as a passage headed **Common difficulties and misconceptions:**, so it is
distributed by key idea — and §2's topics map onto those key ideas directly. The document contains
87 uses of "misconception" and 53 passages headed "common difficulties and misconceptions".

When writing or reviewing a distractor, find the unit in the guidance and read that passage first.
That is where the register's rows come from, and it is what makes a wrong option diagnostic rather
than merely wrong. For example, `PROP-MULTIPLE-LIMIT` paraphrases the guidance on multiples:

> "…can lead to misconceptions, such as **thinking that numbers have only 12 multiples** or that
> numbers outside of the times tables do not have multiples."

The framework's own unit names and terms are the check on §2's table: *Year 7 autumn — Place value,
Properties of number: factors, multiples, squares and cubes, Arithmetic procedures with integers and
decimals, Expressions and equations*; *Year 8 autumn — Estimation and rounding, Sequences, Graphical
representations of linear relationships, Solving linear equations*.

---

## 2. Topics

The Year 7/8 Number and Algebra units from the DfE framework, with student-facing names.

| # | slug | Topic | Strand | DfE unit (Y7/Y8) | Planned Qs |
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

**Shape of each topic's 12–20 questions:** roughly 25% band 1, 35% band 2, 25% band 3, 15% band 4;
~40% tick-all; **4–6 misconception families**, each met 2–3 times in different forms; one bridge word
problem; one retention item revisiting a prerequisite.

---

## 3. Writing diagnostic questions

| Archetype | How it works | Best for |
|---|---|---|
| **A. Diagnostic distractor** (single) | Each wrong option is a documented error, not a random wrong number. | Procedural slips, one clear wrong method. |
| **B. Claim sorting** (tick-all) | Each option is an independent statement; the key is the true set. A student holding a misconception over-ticks exactly that claim, *even if they know the right method*. | Conceptual errors, over-generalisations. The strongest instrument. |
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

---

## 4. Misconception register

The errors items are written against. The register is now **112 codes**, one per distinct error,
and it is machine-readable at `content/misconceptions.json`: every wrong option in the bank carries
a `catches` code from it, and `content/render.py` fails if any other code appears. The table below
is the register as it stood when this spec was written — it is the seed of that file, not a second
copy of it.

The codes are not stored on database rows. They are a writing tool and a record of why each
distractor exists; a code may be used by more than one topic where the same error reappears
(`FRAC-OF-AMOUNT` in ratio, `INT-SUB-ORDER` in algebra).

| Shorthand | Misconception | Example the item should expose | Topic |
|---|---|---|---|
| `PV-MORE-DIGITS` | More digits after the point means larger | "0.45 > 0.5" | place value |
| `PV-ZERO-PLACE` | Zeros in decimals ignored, not placeholders | "0.405 = 0.45" | place value |
| `PV-NEG-ORDER` | A bigger numeral is bigger even when negative | "−7 > −3" | place value |
| `PV-COLUMN-NAME` | Tenths/hundredths confused | reading 0.07 as 7 tenths | place value |
| `PROP-MULTIPLE-LIMIT` | Numbers have only 12 multiples | "7 ends at 84" | properties of number |
| `PROP-ONE-IS-PRIME` | 1 is prime and/or all odd numbers are prime | tick 1, 9, 51 | properties of number |
| `PROP-FACTOR-MULTIPLE` | Factors and multiples are the same | "4 is a multiple of 8" | properties of number |
| `PROP-SQUARE-DOUBLE` | Squaring is doubling (`a² = 2a`) | "5² = 10" | properties of number |
| `PROP-HCF-LCM` | HCF and LCM swapped, or LCM taken as the product | "HCF(4, 6) = 12" | properties of number |
| `INT-MULT-BIGGER` | Multiplication always makes bigger | "6 × 0.5 > 6" | integers & decimals |
| `INT-DIV-SMALLER` | Division always makes smaller | "6 ÷ 0.5 < 6" | integers & decimals |
| `INT-TWO-NEG` | Two minus signs always make a plus | "−3 + (−5) = 8" | integers & decimals |
| `INT-SUB-NEG` | Subtracting a negative is subtracting | "4 − (−3) = 1" | integers & decimals |
| `INT-LEFT-RIGHT` | Operations done strictly left to right | "15 + 6 × 4 = 84" | integers & decimals |
| `INT-DEC-POINT` | Decimal points misaligned / misplaced in a product | "0.3 × 0.2 = 0.6" | integers & decimals |
| `RND-PART-ROUND` | Each digit or part rounded separately | "0.512 → 1 (1sf)" | rounding & estimation |
| `RND-LEADING-ZERO` | Leading zeros count as significant | "0.045 has 3 sf" | rounding & estimation |
| `RND-TRAILING-ZERO` | Trailing zeros never significant | "3.40 has 2 sf" | rounding & estimation |
| `RND-EST-AFTER` | Estimation means rounding the final answer | calculate, then round | rounding & estimation |
| `FRAC-ADD-ACROSS` | Add numerators and denominators | "1/2 + 1/3 = 2/5" | fractions |
| `FRAC-ADD-DENOM` | Add only the denominators | "2/5 + 1/5 = 3/10" | fractions |
| `FRAC-BIG-DENOM` | A bigger denominator means a bigger fraction | "1/5 > 1/3" | fractions |
| `FRAC-CANCEL-SUB` | "Cancelling" means subtracting from top and bottom | "4/6 → 3/5" | fractions |
| `FRAC-BAR-DECIMAL` | The fraction bar is a decimal point | "5/3 = 5.3" | fractions |
| `FRAC-DIVIDE-FIRST` | Dividing by a fraction inverts the wrong one | "2/3 ÷ 1/3 = 2/9" | fractions |
| `FRAC-MULT-COMMON` | Common denominators needed to multiply | "1/2 × 1/3 = 3/6" | fractions |
| `FDP-PERCENT-WHOLE` | 25% is the number 25, not a fraction of the amount | "25% of 240 = 25" | FDP |
| `FDP-ADD-PERCENT` | A 15% increase means "add 15" | "80 + 15% = 95" | FDP |
| `FDP-DECREASE-MULT` | A decrease is applied by subtracting the percentage | "80 − 15% = 65" | FDP |
| `FDP-PCT-POINTS` | Percent vs percentage points confused | "20% to 25% is +25%" | FDP |
| `FDP-REVERSE` | Reverse a change by applying the same percentage | "£45 after 25% off → £45 + 25%" | FDP |
| `RATIO-ADDITIVE` | Compare by difference, not scaling | "4:3, 20 red → 19 blue" | ratio & proportion |
| `RATIO-PART-WHOLE` | A part:part ratio read as part:whole | "4:3 → 4/3 are red" | ratio & proportion |
| `RATIO-INVERSE` | Inverse proportion treated as direct | "more workers → more time" | ratio & proportion |
| `ALG-LETTER-OBJECT` | Letters stand for objects, not numbers | "5 + a cannot be simplified" | expressions |
| `ALG-UNLIKE-TERMS` | Unlike terms can be collected | "2a + 3b = 5ab" | expressions |
| `ALG-MULT-NOT-ADD` | Like terms multiplied when adding | "3a + 2a = 6a²" | expressions |
| `ALG-A-SQUARED-2A` | `a²` is the same as `2a` | "a + a = a²" | expressions |
| `EXP-FIRST-TERM-ONLY` | Multiply only the first term in a bracket | "3(a + 4) = 3a + 4" | expanding & factorising |
| `EXP-MINUS-BRACKET` | Sign not distributed with a negative bracket | "−(x + 3) = −x + 3" | expanding & factorising |
| `FAC-PARTIAL` | Not taking the highest common factor | "6x + 9 = 3(2x + 9)" | expanding & factorising |
| `FAC-SUM-PRODUCT` | Sum and product swapped | "x² + 7x + 12 = (x + 7)(x + 12)" | expanding & factorising |
| `EQ-ONE-SIDE` | An operation applied to only one side | "4x − 5 = 27 → 4x = 22" | solving equations |
| `EQ-ORDER-INVERSE` | Inverse operations applied in the wrong order | "3x + 2 = 11 → (11 + 2)/3" | solving equations |
| `EQ-BALANCE-AS-ACTION` | "=" means "work out the answer" | evaluating, not balancing | solving equations |
| `EQ-NO-NEGATIVE` | A negative solution rejected as impossible | "x + 5 = 2, no solution" | solving equations |
| `SEQ-TERM-TO-NTH` | The term-to-term rule given as the nth term | "4, 7, 10, … → n + 3" | sequences |
| `SEQ-OFF-BY-ONE` | The nth term fits only the first term | "4, 7, 10, … → 4n" | sequences |
| `SEQ-TERM-DOUBLE` | The 10th term is twice the 5th | "2 × 16" | sequences |
| `SEQ-NOT-LINEAR` | A sequence must follow an obvious rule | rejecting 5, 10, 20, 40 | sequences |
| `GRPH-ADD-NOT-TIMES` | From a table, add the y-step instead of multiplying | "y: −2, 1, 4 → y = x + 3" | coordinates & graphs |
| `GRPH-M-IS-C` | Gradient mistaken for the y-intercept | "y = 3x − 2 crosses at 3" | coordinates & graphs |
| `GRPH-INTEGER-ONLY` | A line only passes through integer points | | coordinates & graphs |

---

## 5. Exemplars

One worked item per topic, showing the archetypes and the writing style. In each, the **bold** option
is the key; the other options are named by the misconception they catch.

### Number

**1. Place value & ordering** (`place-value`, tick-all, band 2). *Tick every statement that is true.*
A `0.45 > 0.5` · **B `−7 < −3`** · C `0.405 = 0.45` · **D `0.7 > 0.65`** · E `−2.5 > −2.05` · F `0.09 > 0.1`
**Catches:** A/F more-digits, C zero-as-placeholder, E negative ordering.
**Why:** 0.5 is five tenths and 0.45 is four tenths, so 0.5 is larger however many digits follow. On a
number line, −7 is left of −3.

**2. Factors, multiples & primes** (`properties-of-number`, tick-all, band 2). *Tick every statement
that is true.* **A `4 is a factor of 12`** · B `4 is a multiple of 12` · **C `12 is a multiple of 4`**
· D `Every number has exactly 12 multiples` · **E `2 is the only even prime`** · F `1 is a prime number`
**Catches:** B factor/multiple, D multiple-limit, F one-is-prime.
**Why:** Factors divide into the number; multiples are the times table. Multiples carry on for ever.
A prime has exactly two factors.

**3. Integers & decimals** (`integers-and-decimals`, tick-all, band 2). *Tick every statement that is
true.* **A `−3 + (−5) = −8`** · B `−3 + (−5) = 8` · **C `4 − (−3) = 7`** · D `4 − (−3) = 1` ·
E `6 × 0.5 > 6` · **F `6 ÷ 0.5 > 6`**
**Catches:** B two-minuses-make-a-plus, D subtracting-a-negative, E multiplication-makes-bigger,
F division-makes-smaller (in reverse).
**Why:** Adding two debts gives a bigger debt. Subtracting −3 is the same as adding 3. Dividing by 0.5
asks how many halves are in 6, which is 12.

**4. Rounding & estimation** (`rounding-and-estimation`, tick-all, band 3). *Tick every statement that
is true.* **A `0.512 = 0.5` to 1 significant figure** · B `0.512 = 1` to 1 significant figure ·
**C `4,753 = 4,800` to 2 significant figures** · D `4,753 = 4,750` to 2 significant figures ·
**E `0.045 = 0.05` to 1 significant figure** · F `The zeros in 0.045 are significant figures`
**Catches:** B rounds each part, D confuses 2sf with 3sf, F leading zeros.
**Why:** Significant figures start at the first non-zero digit; leading zeros are only placeholders.
`0.512` is far nearer 0.5 than 1, so it does not round up.

**5. Fractions** (`fractions`, tick-all, band 2). *Tick every statement that is true.*
A `1/2 + 1/3 = 2/5` · **B `1/2 + 1/3 = 5/6`** · C `1/5` is larger than `1/3` because 5 > 3 ·
**D `3/4 + 1/4 = 1`** · **E `2/3 × 3/4 = 6/12 = 1/2`** · F `2/3 ÷ 1/3 = 2/9`
**Catches:** A add-across, C big-denominator, F inverts the wrong fraction.
**Why:** Denominators must match to add: `1/2 + 1/3 = 3/6 + 2/6 = 5/6`. A smaller denominator means
larger parts. To divide by `1/3`, multiply by `3/1`.

**6. Fractions, decimals & percentages** (`fractions-decimals-percentages`, tick-all, band 3). *Tick
every statement that is true.* **A `25% of 240 is 60`** · B `25% of 240 is 25` ·
**C `80 increased by 15% is 92`** · D `80 increased by 15% is 95` · **E `0.6 = 3/5`** · F `0.6 = 1/6`
**Catches:** B percent-as-a-whole-number, D add-the-percentage, F fraction-bar-as-decimal-point.
**Why:** "Per cent" means per hundred, so 25% is a quarter. A 15% increase adds 12 (10% is 8, 5% is 4).
`0.6 = 6/10 = 3/5`.

**7. Ratio & proportion** (`ratio-and-proportion`, tick-all, band 3). *Red and blue counters are in
the ratio 4:3. There are 20 red counters. Tick every statement that is true.* **A There are 15 blue
counters** · B There are 19 blue counters · **C There are 35 counters altogether** ·
D `3/4` of the counters are blue · **E For every 4 red counters there are 3 blue counters**
**Catches:** B additive reasoning, D part:part read as part:whole.
**Why:** 20 red means the ratio was scaled by 5, so blue is `3 × 5 = 15` and the total is `20 + 15 = 35`.
The ratio compares red *to blue*, so the whole has 7 parts, not 4.

### Algebra

**8. Expressions & simplifying** (`expressions-and-simplifying`, tick-all, band 2). *Tick every
expression equal to `5a`.* **A `3a + 2a`** · B `5 + a` · **C `a × 5`** · D `5a²` ·
**E `10a ÷ 2`** · F `a + a + a + a`
**Catches:** B letter-as-object, D a-squared-as-2a, F miscounts the terms.
**Why:** `a` is a number, so `3a + 2a` is five of them. `5 + a` cannot be collected: 5 and `a` are not
like terms. `a + a + a + a` is `4a`, not `5a`.

**9. Expanding & factorising** (`expanding-and-factorising`, tick-all, band 3). *Tick every statement
that is true.* **A `3(x + 4) = 3x + 12`** · B `3(x + 4) = 3x + 4` · **C `−(x + 3) = −x − 3`** ·
D `−(x + 3) = −x + 3` · **E `6x + 9 = 3(2x + 3)`** · F `6x + 9 = 3(2x + 9)`
**Catches:** B multiplies only the first term, D loses the sign, F does not take the highest common factor.
**Why:** The multiplier applies to every term inside the bracket. The negative sign applies to both
terms. `3` is the highest common factor of `6x` and `9`, so it must be taken from both.

**10. Solving linear equations** (`solving-equations`, single, band 3). *Sam solves `4x − 5 = 27` and
gets `x = 5.5`. Which mistake did Sam make?* **A subtracted 5 instead of adding 5** · B divided by 5
instead of 4 · C forgot to divide by 4 · D multiplied by 4 instead of dividing
**Catches:** all four are real errors; A is the one on show.
**Why:** `4x − 5 = 27 → 4x = 32 → x = 8`. Sam did `27 − 5 = 22`. To undo "− 5" you add 5, and you must
do it to both sides.

**11. Sequences** (`sequences`, tick-all, band 3). *For the sequence 4, 7, 10, 13, … tick every true
statement.* **A The nth term is `3n + 1`** · B The nth term is `n + 3` · **C The 10th term is 31** ·
D The 10th term is 34 · **E 67 is a term of the sequence**
**Catches:** B term-to-term rule used as the nth term, D off-by-one (`4 + 3 × 10`).
**Why:** The terms go up by 3, so the nth term starts `3n`; at `n = 1` that gives 3, so add 1 →
`3n + 1`. The 10th term is `3 × 10 + 1 = 31`. `67 = 3n + 1` gives `n = 22`, so 67 is in the sequence.

**12. Coordinates & linear graphs** (`coordinates-and-linear-graphs`, tick-all, band 3). *A straight
line has `x = 0, y = −2`; `x = 1, y = 1`; `x = 2, y = 4`. Tick every statement that is true.*
**A `y = 3x − 2`** · B `y = x + 3` · **C When `x = 4`, `y = 10`** · D It passes through the origin ·
**E The y-intercept is `−2`**
**Catches:** B adds the y-step instead of multiplying, D confuses the intercept with the origin.
**Why:** `y` rises by 3 whenever `x` rises by 1, so `y = 3x + c`; at `x = 0`, `c = −2`. It crosses the
y-axis at `(0, −2)`, not the origin. At `x = 4`, `y = 3 × 4 − 2 = 10`.

---

## 6. Bank composition

- **4–6 misconception families per topic**, each met 2–3 times in different forms (direct calculation,
  claim-sort, boundary case) so the surface cannot be pattern-matched.
- **One bridge item** per topic: a short word problem in context.
- **One retention item** per topic: revisits a prerequisite (e.g. equations includes a substitution
  check; fractions includes an equivalence check).
- **The prototype's seed questions are not kept.** When this bank lands they are retired rather than
  folded into these topics — one statement, `update questions set status = 'RETIRED' where origin
  = 'SEED'` (see `specs/seeding.md`). There are 32 live ones, not 33: the duplicate primes question
  was already retired. Nothing here may rely on them, so each topic's allocation has to cover its own
  band-1/2 fluency.

**Content QA for every item**

1. Exactly one defensible answer set; no option arguable.
2. Every distractor maps to a named misconception, and that is the most likely reason it is picked.
3. Numbers chosen to expose the misconception, not to be tidy.
4. Explanation names the likely error, not just the correct method.
5. Language fits Y7/8; reading load does not exceed mathematical load.
6. No giveaways (longest-option-is-right, "all of the above", grammar mismatches, prompt echo).
7. Tick-all: true claims unambiguously true for all stated values; false claims unambiguously false.
8. Second read for subject accuracy and for the misconception claim itself.

**Status.** Phases 1 and 2 are written. The bank lives in `content/bank/*.json`, one file per
topic; `content/README.md` describes the item shape and `content/render.py` validates and renders
it. `python3 content/render.py --check` reports **200 questions across 12 topics**, bands
38/67/59/36, and 90 tick-all items. Each topic carries one bridge item and one retention item, and
each misconception family is met two or three times in different forms. What remains is the second
read (subject accuracy and whether each distractor really is the most likely reason a student picks
it), not more writing.

| Phase | Work | Output |
|---|---|---|
| **0. Agree** | This spec: 12 topics, register, held set. | Sign-off. |
| **1. Template** | `properties-of-number` end-to-end (18 items). | Written. |
| **2. Roll out** | Remaining 11 topics, Number then Algebra. | Written; 200 questions. |
| **3. Second read** | Subject accuracy and distractor plausibility, item by item. | Reviewed bank. |
| **4. Next set** | Geometry/stats/probability, then Year 9, then GCSE. | Later. |

---

## 7. Decisions before Phase 1

1. Accept the 12 topics and their allocations?
2. Confirm geometry, measures, statistics and probability wait for image support?
3. Tick-all stays all-or-nothing, with diagnosis carried by the content — confirmed and now in
the bank.
4. Who does the second read?
5. **Do the band-4 quadratic items stay?** `expanding-and-factorising` keeps three items on
expanding double brackets and factorising monic quadratics (band 4), because §4 names
`FAC-SUM-PRODUCT` as a misconception. The prototype bank's quadratics question is no longer a
factor: §6 discards that whole bank rather than retiring one question from it. So the question is
now only whether monic quadratics belong in Year 7/8 — either keep them as top-band Y8 stretch, or
drop the register code and the items with it. Decide before the second read.
6. **Which of the 8 archetypes are required?** The bank uses A–G; H (always / sometimes / never) is
not represented, and D, E, F and G are light. Fine if the mix is judged on diagnostic value rather
than coverage of the list.
