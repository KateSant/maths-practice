import { misconception, misconceptionsByTopic } from '../../lib/misconceptions'

/**
 * The one control this feature adds: naming what a wrong option catches.
 *
 * It is deliberately a single native `<select>`, not a free-text box and not a searchable
 * combobox. The register is the vocabulary - a code that is not in it cannot be stored usefully,
 * and `content/render.py` rejects one in the written bank - so choosing from a list is the whole
 * interaction, and a native select gets keyboard access and type-ahead in every browser for
 * nothing. Options are grouped by topic, the question's own topic first, because a distractor
 * almost always catches an error in the topic the question belongs to.
 *
 * The label is the register's sentence rather than the code. A teacher is deciding what mistake
 * to catch, and "divides by the denominator and stops" answers that where `FRAC-OF-AMOUNT` does
 * not. The code follows the sentence, small and monospaced, for whoever is citing the guidance.
 */
export function MisconceptionPicker({
  value,
  onChange,
  topicSlug,
  topicName = (slug) => slug,
}: {
  /** The stored code, or '' for "not diagnosed". */
  value: string
  onChange: (code: string) => void
  /** The question's topic, whose group is shown first. */
  topicSlug?: string
  /** Turns a topic slug into the name a teacher knows it by. */
  topicName?: (slug: string) => string
}) {
  const groups = misconceptionsByTopic(topicSlug)
  const selected = misconception(value)
  const unknown = value !== '' && !selected

  return (
    <div className="mt-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-slate-500">Catches</span>
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-label="The misconception this wrong answer catches"
          className="min-w-0 max-w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
        >
          <option value="">Not diagnosed</option>
          {groups.map((group) => (
            <optgroup key={group.topic} label={topicName(group.topic)}>
              {group.items.map((item) => (
                <option key={item.code} value={item.code} title={item.misconception}>
                  {/* Long sentences make an unusably wide native popup. The full sentence is
                      shown below the moment the option is chosen. */}
                  {shorten(item.misconception)}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        {value ? (
          <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-500">{value}</span>
        ) : null}
      </div>

      {selected ? (
        <p className="mt-1 text-xs leading-relaxed text-slate-500">
          {selected.misconception}
          {selected.example ? <span className="text-slate-400"> For example: {selected.example}.</span> : null}
        </p>
      ) : null}

      {unknown ? (
        <p className="mt-1 text-xs text-amber-700">
          “{value}” is not in the register. Pick a code from the list, or leave it undiagnosed.
        </p>
      ) : null}
    </div>
  )
}

/** Keeps a native dropdown usable without hiding the distinction it is there to draw. */
function shorten(sentence: string, limit = 90): string {
  return sentence.length <= limit ? sentence : `${sentence.slice(0, limit - 1).trimEnd()}…`
}
