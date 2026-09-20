#!/usr/bin/env python3
"""Validate the question bank, or render it as markdown for reading.

    python3 content/render.py --check      # fail loudly on any structural problem
    python3 content/render.py              # print the whole bank as markdown
    python3 content/render.py --topic fractions

Checks are about the shape of an item and the register, not about the mathematics; the subject
check is the second read described in specs/question-bank-plan.md.
"""

from __future__ import annotations

import argparse
import glob
import json
import os
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
            lines.append("")
            lines.append(f"> {question['explanation']}")
            lines.append("")
    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="validate only, print a summary")
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

    print(render(args.topic))
    return 0


if __name__ == "__main__":
    sys.exit(main())
