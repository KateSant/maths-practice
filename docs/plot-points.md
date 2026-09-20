# Plot-points questions

**Status:** parked. The prototype and the reasoning live only on this branch. Nothing is built and
nothing is wired to the API.

**What it is:** a question type that isn't multiple choice — the student plots points on a grid
instead of choosing from a list.

> A straight line has gradient 2 and crosses the y-axis at −1.
> **Plot three points that lie on the line.**

Grid −5 to 5, snapping to whole numbers. Tap an intersection to place a dot, tap it again to remove
it, then Submit. Afterwards the true line is drawn *under* their points.

**Why:** to keep it interesting. A long run of four-option questions gets stale, and a student who is
bored stops reading the options; plotting is something to do with your hands, and you *make* an
answer rather than recognise one. Three things also come free: no guessing floor (four options is a
25% one, three plotted points is none), a grid is the smallest thing that unblocks the ~100 bank
items held back for needing a diagram, and a student who thinks the rule is "multiply by 2, then add
1" plots three points on `y = 2x + 1` — the error names itself.

**Where it is:** `/dev/plot` while running `npm run dev` — dev-only, outside the auth guard, absent
from a production build. The screen is `frontend/src/pages/DevPlotPage.tsx` and the grid, snapping
and grading rule are in `frontend/src/lib/plotItem.ts`. It is a mockup with no server to ask, so it
**grades in the browser**; the real item must not.

## What was decided

- **`PLOT_POINTS`** as a third `AnswerType`, beside `SINGLE_CHOICE` and `MULTI_SELECT`.
- **The answer is a set** — order irrelevant, which points irrelevant — the same shape as tick-all,
  which is why the request and result contracts would barely change.
- **The key is a rule, not a list.** Gradient and intercept, stored as reduced fractions so grading
  is exact integer arithmetic: `y·md·cd == mn·cd·x + cn·md`. No tolerance and no epsilon.
- **All or nothing.** No partial credit, for the reason tick-all gives: score and streak are counts
  of questions answered correctly.
- **The key arrives with the result**, where `correctOptionIds` arrives today, and never before.
- **The client does not mark, and does not hint.** No dot turns green as it is placed — across a grid
  of 121 cells that lets a student probe their way onto the line.
- **A new publish rule: the grid must be able to hold the answer.** `y = 2x − 1` has six solutions on
  a −5..5 grid and two on a −1..1 one, so the same rule is publishable or impossible depending on the
  window. Naming `(4, 7)` as an example answer is how that was found.
- **One item, no options.** Options and a plot rule are mutually exclusive.

## Not decided

Snap granularity (whole numbers, or halves — `y = ½x` is ordinary at KS3); one square grid or
separate x and y ranges; the ceiling on how many points; whether v1 intercepts are always integers.

## Deliberately not here

The **diagnostic reading** — turning a wrong set of points into a named misconception — is the most
valuable thing this item offers and is not designed. It needs the register and `misconception_code`,
and it runs server-side beside the grading rule.

Adding a value to `answer_type` means widening its `CHECK`, which is a migration question with its
own owner.
