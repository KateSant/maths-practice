import register from '../../../content/misconceptions.json'

/**
 * The misconception register, as the teacher screens see it.
 *
 * The register is content, not schema: it lives at `content/misconceptions.json`, beside the
 * written bank that every wrong option is written against, and is revised there. Importing it
 * directly rather than fetching it keeps a single source of truth - there is no copy to drift -
 * and the file is a build-time input, so a stale register is a build failure rather than a
 * screen that quietly offers codes the bank no longer uses.
 *
 * Nothing here is shown to a student. A code names the error a distractor catches, which is a
 * teacher's instrument; the student sees the explanation, which names the error in their words.
 */
export interface MisconceptionSource {
  kind: string
  unit?: string
  keyIdea?: string
  quote?: string
  note?: string
}

export interface Misconception {
  code: string
  /** The topic slug this error belongs to. A code may still be used by an item in another topic. */
  topic: string
  /** One sentence naming the error, for a teacher. */
  misconception: string
  /**
   * The same error said to the student who made it: what they probably thought, and what is true
   * instead. This is the one register field a student ever sees, and it exists because the
   * teacher's sentence reads as jargon to an eleven-year-old.
   */
  student?: string
  /** What a student holding the error would produce. */
  example?: string
  /** Where the row came from. Round-one rows carry none yet. */
  source?: MisconceptionSource
}

export interface MisconceptionGroup {
  /** The topic slug; the caller turns it into a name, because it holds the topic list. */
  topic: string
  items: Misconception[]
}

// The register is hand-written JSON, so the import's inferred type is wider than the interface.
// Casting once here keeps the rest of the app typed, and tolerates a file whose shape is mid-edit
// by falling back to an empty register rather than failing the build.
const registered: Misconception[] = (register as { codes?: Misconception[] }).codes ?? []

/** The register in file order. */
export const MISCONCEPTIONS: readonly Misconception[] = registered

const BY_CODE = new Map(registered.map((entry) => [entry.code, entry]))

/** The register row for a code, or undefined when the code is absent or unknown. */
export function misconception(code: string | null | undefined): Misconception | undefined {
  return code ? BY_CODE.get(code) : undefined
}

/**
 * One sentence a teacher can read, or undefined when there is nothing to say.
 *
 * Returning the sentence rather than the code is the whole point of the register: a teacher
 * wants "divides by the denominator and stops", not `FRAC-OF-AMOUNT`. The code is shown beside
 * it for the people who cite the guidance.
 */
export function describeMisconception(code: string | null | undefined): string | undefined {
  return misconception(code)?.misconception
}

/**
 * The error said to the student who made it, or undefined when there is nothing to say.
 *
 * Separate from {@link describeMisconception} on purpose. That sentence is written for a teacher
 * ("is not recognised as the same value", "precedence is misapplied"), which is not how you would
 * say it to the person who got it wrong. This one addresses them directly: you went by how many
 * digits there are, and here is why that is not the test.
 */
export function studentFeedback(code: string | null | undefined): string | undefined {
  const line = misconception(code)?.student
  return line && line.trim() ? line : undefined
}

/**
 * The register grouped by topic, the question's own topic first.
 *
 * A question's distractors almost always catch an error in its own topic, so that group is put
 * at the top of the list rather than left in register order. Order within a group is the file's,
 * and unknown topics keep their first-seen order after the known ones.
 */
export function misconceptionsByTopic(topicSlug?: string): MisconceptionGroup[] {
  const byTopic = new Map<string, Misconception[]>()
  for (const entry of registered) {
    const bucket = byTopic.get(entry.topic)
    if (bucket) {
      bucket.push(entry)
    } else {
      byTopic.set(entry.topic, [entry])
    }
  }

  const groups: MisconceptionGroup[] = [...byTopic].map(([topic, items]) => ({ topic, items }))
  if (!topicSlug) return groups

  const own = groups.filter((group) => group.topic === topicSlug)
  const rest = groups.filter((group) => group.topic !== topicSlug)
  return [...own, ...rest]
}
