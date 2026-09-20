# The question bank

This directory holds the written bank: 200 diagnostic questions for Year 7/8 Number & Algebra,
as specified in `specs/question-bank-probing-misconceptions.md`. It is the source, not the loader:
the bank is seed content, and `scripts/generate_bank_migration.py` turns these files into the
insert-only migration that loads them. See `specs/how-to-seed-the-question-bank.md`.

| | |
|---|---|
| Validate and read | `python3 content/render.py --check` · `python3 content/render.py` |
| Generate the load migration | `python3 scripts/generate_bank_migration.py --version <next free>` |

```
content/
  bank/
    01-place-value.json
    02-properties-of-number.json
    ...
    12-coordinates-and-linear-graphs.json
  misconceptions.json      the register every distractor is written against
  render.py                validate the bank and render it for reading
```

The generator lives in `scripts/` rather than here, because it produces a migration — a build
artefact — and this directory is content.

## The item shape

One file per topic. The file names a topic and lists its questions in a fixed order.

```json
{
  "slug": "place-value",
  "name": "Place value & ordering",
  "strand": "Number",
  "dfeUnit": "Place value (Y7)",
  "description": "Place value, ordering decimals and negative numbers.",
  "yearGroup": 7,
  "planned": 14,
  "questions": [
    {
      "key": "pv-tick-compare-1",
      "band": 2,
      "archetype": "B",
      "answerType": "MULTI_SELECT",
      "prompt": "Tick every statement that is true.",
      "options": [
        {"text": "0.45 > 0.5", "correct": false, "catches": "PV-MORE-DIGITS"},
        {"text": "−7 < −3", "correct": true}
      ],
      "explanation": "..."
    }
  ]
}
```

| Field | Meaning |
|---|---|
| `key` | Stable identity, unique across the whole bank, ≤ 60 characters. Never a row id. |
| `description` | One line for the topic, used as the topic's description in the app. |
| `band` | Difficulty 1–4, the range the API enforces. |
| `archetype` | A–H from `specs/question-bank-probing-misconceptions.md` §3. |
| `answerType` | `SINGLE_CHOICE` or `MULTI_SELECT` (tick-all). |
| `prompt` | What the student reads. Plain text maths: `/` for fractions, `× − ÷ ² ³ √`. |
| `options[].correct` | The key. Option labels A–F are derived from position, never stored. |
| `options[].catches` | The misconception code this wrong option catches. Required on every wrong option; must exist in `misconceptions.json`, and is loaded into `answer_options.misconception_code`. |
| `explanation` | Names the correct method, the likely error, and why it is wrong. For tick-all, it runs through the false claims. |
| `bridge` | Optional `true`: the topic's one word-problem item. |
| `retention` | Optional `true`: the topic's one item revisiting a prerequisite. |

Option arrays run 2–6 long. A single-choice item has exactly one correct option; a tick-all item
has at least one. The database does hold the misconception tags, in `answer_options.misconception_code`:
they are the bank's diagnostic value, and the register behind them is what lets the teacher be told
what a wrong answer usually means.

## Checks

`python3 content/render.py --check` fails on: a duplicate key, a key over 60 characters, an option
count outside 2–6, a single-choice item without exactly one correct option, a tick-all item with no
correct option, a wrong option without a `catches`, or a `catches` code that is not in
`misconceptions.json`.

`python3 content/render.py` writes a readable markdown rendering to stdout for review.
