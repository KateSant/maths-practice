import { useId } from 'react'
import { misconception, misconceptionsByTopic } from '../../lib/misconceptions'

/**
 * A misconception code as a chip.
 *
 * Deliberately loud. The code is the one thing on the screen that says *which* error a wrong
 * answer catches, so it is the last thing that should recede into grey - it was slate-on-slate,
 * which read as metadata rather than as the point of the feature.
 */
export function MisconceptionCodeChip({ code }: { code: string }) {
  return (
    <span className="shrink-0 rounded bg-indigo-600 px-1.5 py-0.5 font-mono text-[11px] font-semibold tracking-tight text-white">
      {code}
    </span>
  )
}

/**
 * What a wrong option catches.
 *
 * This is the diagnostic half of the item - the reason a wrong answer is more than wrong - so it
 * is given a tinted block of its own rather than a quiet line under the option. The sentence is
 * the headline: a teacher scanning the page should read which error each distractor catches
 * without opening anything.
 *
 * A native `<select>` rather than a combobox: the register is the vocabulary, a code that is not
 * in it cannot be stored usefully, and `content/render.py` rejects one in the written bank, so
 * choosing from a list is the whole interaction. Options are grouped by topic, the question's own
 * topic first.
 *
 * Layout note: the select is `w-full` inside its own block, not an inline item in a flex row. A
 * native select sizes itself to its widest option, and a long sentence made it wider than the
 * column, which burst the grid track and overlapped the preview beside it.
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
  const selectId = useId()
  const groups = misconceptionsByTopic(topicSlug)
  const selected = misconception(value)
  const unknown = value !== '' && !selected

  return (
    <div className="mt-2 min-w-0 rounded-lg border border-indigo-100 bg-indigo-50/60 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-indigo-500">Common error</span>
        {value ? <MisconceptionCodeChip code={value} /> : null}
      </div>

      {selected ? (
        <p className="mt-1.5 text-sm font-medium leading-snug text-slate-800">{selected.misconception}</p>
      ) : (
        <p className="mt-1.5 text-sm text-slate-500">
          Choose the mistake a student makes if they pick this answer.
        </p>
      )}

      {selected?.example ? (
        <p className="mt-1 text-xs text-slate-600">For example: {selected.example}.</p>
      ) : null}

      <select
        id={selectId}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full min-w-0 rounded-md border border-indigo-100 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
      >
        <option value="">No mistake chosen</option>
        {groups.map((group) => (
          <optgroup key={group.topic} label={topicName(group.topic)}>
            {group.items.map((item) => (
              <option key={item.code} value={item.code} title={item.misconception}>
                {/* Long sentences make an unusably wide native popup. The full sentence is shown
                    above the moment the option is chosen. */}
                {shorten(item.misconception)}
              </option>
            ))}
          </optgroup>
        ))}
      </select>

      {unknown ? (
        <p className="mt-1.5 text-xs text-amber-700">
          “{value}” is not in the list. Choose one, or leave it unset.
        </p>
      ) : null}
    </div>
  )
}

/** Keeps a native dropdown usable without hiding the distinction it is there to draw. */
function shorten(sentence: string, limit = 90): string {
  return sentence.length <= limit ? sentence : `${sentence.slice(0, limit - 1).trimEnd()}…`
}
