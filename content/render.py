#!/usr/bin/env python3
"""Validate the question bank, or render it as markdown for reading.

    python3 content/render.py --check      # fail loudly on any structural problem
    python3 content/render.py              # print the whole bank as markdown
    python3 content/render.py --topic fractions
    python3 content/render.py --stats      # the anti-monotony measures of spec §3.1, as a report

Checks are about the shape of an item and the register, not about the mathematics; the subject
check is the second read described in specs/question-bank-probing-misconceptions.md. --stats is
likewise a report, not a gate: it measures the bank against §3.1 so a reviewer can see the mix
without reading all of it. The proposition test is a heuristic (word count and signal words), so
treat the share as a rough instrument and read the items for the rest.
"""

from __future__ import annotations

import argparse
import glob
import json
import os
import re
import sys
from collections import Counter, defaultdict

BANK_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "bank")
REGISTER = os.path.join(os.path.dirname(os.path.abspath(__file__)), "misconceptions.json")

ARCHETYPES = {
    "A": "diagnostic distractor",
    "B": "claim sorting",
    "C": "boundary / edge case",
    "D": "error spotting",
    "E": "non-example",
    "F": "reversed",
    "G": "method / form match",
    "H": "always / sometimes / never",
}

# Words that mark an option as something to judge rather than something to work on (§3.1).
CLAIM_WORDS = {
    "always", "never", "sometimes", "true", "false", "because", "equals", "equal",
    "gives", "give", "makes", "make", "means", "mean", "will", "would", "must",
}


def is_proposition(text):
    """A rough reading of "is this option a statement to judge, not a value to work on?"

    The giveaway cases a reader would name by eye: a sentence with a verb in it, a comparison
    with < or >, an equation with a letter in it, or a full stop. A bare number, expression or
    tuple of values is not a proposition. This is an instrument, not a definition.
    """
    words = [word.strip(".,;:!?()") for word in text.split()]
    alpha = [word for word in words if any(character.isalpha() for character in word)]
    lowered = {word.lower() for word in words}
    # A symbolic answer such as "x = 3" or "y = 3x + 1" is something to work on, not prose to judge.
    if re.match(r"^[A-Za-z]\s*=", text.strip()):
        return False
    if lowered & CLAIM_WORDS or len(alpha) >= 4:
        return True
    if "<" in text or ">" in text:
        return True
    if "=" in text and alpha:
        return True
    return text.strip().endswith(".")


def load_register():
    with open(REGISTER, encoding="utf-8") as handle:
        data = json.load(handle)
    return {entry["code"]: entry for entry in data["codes"]}


def load_topics():
    topics = []
    for path in sorted(glob.glob(os.path.join(BANK_DIR, "*.json"))):
        with open(path, encoding="utf-8") as handle:
            topics.append((path, json.load(handle)))
    return topics


def validate():
    register = load_register()
    errors = []

    # Every row needs the line a student reads when they pick that option. Without it the quiz can
    # only show the generic explanation, which names every error the item catches rather than the
    # one the student made - so a row that loses its student line is a silent regression in the
    # feedback, not a cosmetic gap in the file.
    for code, entry in register.items():
        if not str(entry.get("student", "")).strip():
            errors.append(f"register: {code} has no student line")
    seen_keys = {}
    totals = Counter()
    bands = Counter()
    types = Counter()
    archetypes = Counter()
    per_topic = []

    for path, topic in load_topics():
        slug = topic["slug"]
        questions = topic["questions"]
        per_topic.append((slug, len(questions)))
        if len(questions) != topic["planned"]:
            errors.append(f"{slug}: {len(questions)} questions, planned {topic['planned']}")

        for question in questions:
            key = question.get("key", "<no key>")
            where = f"{slug}/{key}"

            if not key or key == "<no key>":
                errors.append(f"{where}: missing key")
            elif len(key) > 60:
                errors.append(f"{where}: key is {len(key)} characters (max 60)")
            elif key in seen_keys:
                errors.append(f"{where}: duplicate key, also in {seen_keys[key]}")
            else:
                seen_keys[key] = slug

            if question.get("band") not in (1, 2, 3, 4):
                errors.append(f"{where}: band {question.get('band')} is outside 1-4")
            if question.get("archetype") not in ARCHETYPES:
                errors.append(f"{where}: unknown archetype {question.get('archetype')!r}")
            if question.get("answerType") not in ("SINGLE_CHOICE", "MULTI_SELECT"):
                errors.append(f"{where}: unknown answerType {question.get('answerType')!r}")
            if not question.get("prompt", "").strip():
                errors.append(f"{where}: empty prompt")
            if not question.get("explanation", "").strip():
                errors.append(f"{where}: empty explanation")

            options = question.get("options", [])
            if not 2 <= len(options) <= 6:
                errors.append(f"{where}: {len(options)} options (need 2-6)")

            texts = [option.get("text", "") for option in options]
            if len(set(texts)) != len(texts):
                errors.append(f"{where}: repeated option text")
            for text in texts:
                if not text.strip():
                    errors.append(f"{where}: empty option text")
                low = text.lower()
                if "all of the above" in low or "none of the above" in low:
                    errors.append(f"{where}: giveaway option {text!r}")

            correct = [option for option in options if option.get("correct")]
            if question.get("answerType") == "SINGLE_CHOICE" and len(correct) != 1:
                errors.append(f"{where}: single choice has {len(correct)} correct options")
            if question.get("answerType") == "MULTI_SELECT" and len(correct) < 1:
                errors.append(f"{where}: tick-all has no correct option")

            for option in options:
                if option.get("correct"):
                    if option.get("catches"):
                        errors.append(f"{where}: correct option carries a catches code")
                    continue
                code = option.get("catches")
                if not code:
                    errors.append(f"{where}: wrong option {option.get('text')!r} has no catches")
                elif code not in register:
                    errors.append(f"{where}: catches {code!r} is not in the register")

            totals["questions"] += 1
            bands[question["band"]] += 1
            types[question["answerType"]] += 1
            archetypes[question["archetype"]] += 1

    return errors, totals, bands, types, archetypes, per_topic


def render(topic_filter=None):
    register = load_register()
    lines = ["# The question bank", ""]
    for _, topic in load_topics():
        if topic_filter and topic["slug"] != topic_filter:
            continue
        lines.append(f"## {topic['name']} (`{topic['slug']}`)")
        lines.append("")
        lines.append(
            f"*{topic['strand']} · {topic['dfeUnit']} · Year {topic['yearGroup']} · "
            f"{len(topic['questions'])} questions*"
        )
        lines.append("")
        for number, question in enumerate(topic["questions"], start=1):
            tag = ""
            if question.get("bridge"):
                tag = " *(bridge)*"
            if question.get("retention"):
                tag = " *(retention)*"
            lines.append(
                f"**{number}. `{question['key']}`** — band {question['band']}, "
                f"archetype {question['archetype']} ({ARCHETYPES[question['archetype']]}), "
                f"{question['answerType'].lower()}{tag}"
            )
            lines.append("")
            lines.append(question["prompt"])
            lines.append("")
            for index, option in enumerate(question["options"]):
                label = "ABCDEF"[index]
                if option["correct"]:
                    lines.append(f"- **{label}. {option['text']}** ✓")
                else:
                    entry = register.get(option["catches"], {})
                    lines.append(f"- {label}. {option['text']} — *{option['catches']}*: {entry.get('misconception', '')}")
                    if entry.get("student"):
                        lines.append(f"    - *the student reads:* {entry['student']}")
            lines.append("")
            lines.append(f"> {question['explanation']}")
            lines.append("")
    return "\n".join(lines)


def stats():
    """Report the bank against §3.1, so monotony is visible without reading every item."""
    topics = load_topics()
    lines = [
        "anti-monotony report (spec §3.1) - a report, not a gate",
        "",
        f"{'topic':32}{'n':>4}{'A+B':>7}  {'archetypes':22}{'bands 1-4':18}{'tick-all opts':>14}{'propositional':>15}",
    ]
    bank_archetypes = Counter()
    bank_prompts = Counter()
    bank_prop = bank_opts = 0
    tick_sizes = []
    for _, topic in topics:
        questions = topic["questions"]
        archetypes = Counter(q["archetype"] for q in questions)
        bands = Counter(q["band"] for q in questions)
        sizes = [len(q["options"]) for q in questions if q["answerType"] == "MULTI_SELECT"]
        props = sum(1 for q in questions for o in q["options"] if is_proposition(o["text"]))
        opts = sum(len(q["options"]) for q in questions)
        tick_sizes += sizes
        bank_prop += props
        bank_opts += opts
        for q in questions:
            bank_archetypes[q["archetype"]] += 1
            bank_prompts[q["prompt"]] += 1
        spread = "".join(f"{a}:{archetypes[a]} " for a in sorted(ARCHETYPES) if archetypes[a])
        bandspread = " ".join(f"{b}:{bands[b]}" for b in sorted(bands))
        tick = f"{min(sizes)}-{max(sizes)} ({sum(sizes)/len(sizes):.1f})" if sizes else "-"
        share = f"{props}/{opts} {100*props/opts:.0f}%" if opts else "-"
        lines.append(
            f"{topic['slug']:32}{len(questions):>4}{archetypes['A']+archetypes['B']:>7}  "
            f"{spread:22}{bandspread:18}{tick:>14}{share:>15}"
        )
    total = sum(bank_archetypes.values())
    atob = bank_archetypes["A"] + bank_archetypes["B"]
    dtoh = total - atob
    lines += [
        "",
        f"bank: {total} items, A+B {atob} ({100*atob/total:.0f}%, §3.1 wants at most half), "
        f"D-H {dtoh} ({100*dtoh/total:.0f}%, wants at least a quarter)",
        "bank archetypes: " + " ".join(f"{a}:{bank_archetypes[a]}" for a in sorted(ARCHETYPES)),
        f"propositions: {bank_prop}/{bank_opts} options ({100*bank_prop/bank_opts:.0f}%) - lower is better",
    ]
    tick_items = sum(
        1 for _, topic in topics for q in topic["questions"] if q["answerType"] == "MULTI_SELECT"
    )
    lines.append(
        f"tick-all items: {tick_items}/{total} ({100*tick_items/total:.0f}%) - the all-or-nothing "
        "shape; §3.1 wants about one in ten, no more than two in a topic"
    )
    lines.append(f"tick-all options: {min(tick_sizes)}-{max(tick_sizes)}, mean {sum(tick_sizes)/len(tick_sizes):.1f}")
    repeats = [(count, prompt) for prompt, count in bank_prompts.most_common() if count > 1]
    lines.append(f"reused prompts: {len(repeats)}")
    for count, prompt in repeats[:10]:
        lines.append(f"  {count}x  {prompt[:96]}")
    openings = Counter(
        " ".join(q["prompt"].split()[:3])
        for _, topic in topics
        for q in topic["questions"]
    )
    lines.append(
        "commonest openings (first three words): "
        + ", ".join(f'{count}x "{text}"' for text, count in openings.most_common(6))
    )
    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="validate only, print a summary")
    parser.add_argument("--stats", action="store_true", help="print the anti-monotony report of §3.1")
    parser.add_argument("--topic", help="limit the rendering to one topic slug")
    args = parser.parse_args()

    errors, totals, bands, types, archetypes, per_topic = validate()

    if errors:
        print(f"{len(errors)} problem(s):\n", file=sys.stderr)
        for error in errors:
            print(f"  - {error}", file=sys.stderr)
        return 1

    if args.check:
        print(f"{totals['questions']} questions across {len(per_topic)} topics\n")
        print("per topic:")
        for slug, count in per_topic:
            print(f"  {count:>3}  {slug}")
        print()
        print("band:     " + "  ".join(f"{b}:{bands[b]}" for b in sorted(bands)))
        print("type:     " + "  ".join(f"{t}:{types[t]}" for t in sorted(types)))
        print("archetype:" + "".join(f"  {a}:{archetypes[a]}" for a in sorted(archetypes)))
        return 0

    if args.stats:
        print(stats())
        return 0

    print(render(args.topic))
    return 0


if __name__ == "__main__":
    sys.exit(main())
