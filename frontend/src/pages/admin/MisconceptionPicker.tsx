import { useId } from 'react'
import { misconception, misconceptionsByTopic, type Misconception } from '../../lib/misconceptions'

/**
 * A misconception code as a chip.
 *
 * Deliberately loud. The code is the one thing on the screen that says *which* error a wrong
 * answer catches, so it is the last thing that should recede into grey - it was slate-on-slate,
 * which read as metadata rather than as the point of the feature.
 *
 * What the code means is a tooltip rather than a line under it, because the block is read while
 * writing a question and the sentence is the occasional detail. It is drawn here rather than left
 * to the `title` attribute: a native tooltip cannot be styled, arrives a second late, gives no sign
 * that there is anything to hover, and never appears at all on a touch screen. This one shows on
 * hover and on keyboard focus, and the chip is focusable so the tab key reaches it.
 */
export function MisconceptionCodeChip({ code, title }: { code: string; title?: string }) {
  const id = useId()

  return (
    <span className="group relative inline-flex shrink-0">
      <span
        tabIndex={title ? 0 : undefined}
        aria-describedby={title ? id : undefined}
        className="cursor-help rounded bg-indigo-600 px-1.5 py-0.5 font-mono text-[11px] font-semibold tracking-tight text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40"
      >
        {code}
      </span>
      {title ? (
        <span
          id={id}
          role="tooltip"
          className="pointer-events-none absolute left-0 top-full z-20 mt-1 hidden w-max max-w-xs rounded-md bg-slate-900 px-2 py-1 text-[11px] font-normal leading-snug text-white shadow-lg group-hover:block group-focus-within:block"
        >
          {title}
        </span>
      ) : null}
    </span>
  )
}

/**
 * What a wrong option catches, and what the student is told when they pick it.
 *
 * This is the diagnostic half of the item - the reason a wrong answer is more than wrong - so it
 * is given a tinted block of its own rather than a quiet line under the option. The sentence is
 * the headline: a teacher scanning the page should read which error each distractor catches
 * without opening anything.
 *
 * Two granularities, which is why the block holds two fields. The code names the error class, and
 * several options in one question can share it. The message hangs off the option, because the
 * option is what knows which misreading was actually made: on "what is the value of the 2 in
 * 5.320?", 0.2 means tenths and 0.002 means thousandths, and both catch PV-COLUMN-NAME. The
 * register used to supply a student-facing line for the code, and no longer does, so an option
 * that names an error and says nothing leaves the student with nothing to read.
 *
 * A native `<select>` rather than a combobox: the register is the vocabulary, a code that is not
 * in it cannot be stored usefully, and `content/render.py` rejects one in the written bank, so
 * choosing from a list is the whole interaction. Options are grouped by topic, the question's own
 * topic first. The list is only on screen while the option has no code: its job is choosing one,
 * and once chosen the chip names it and the tooltip carries the sentence, so there is nothing left
 * for a dropdown to do but offer to undo the choice.
 *
 * Layout note: the select is `w-full` inside its own block, not an inline item in a flex row. A
 * native select sizes itself to its widest option, and a long sentence made it wider than the
 * column, which burst the grid track and overlapped the preview beside it.
 */

/** The ceiling on a message, matching `answer_options.feedback` and the server's `@Size`. */
const MAX_FEEDBACK = 500
export function MisconceptionPicker({
  value,
  onChange,
  feedback,
  onFeedbackChange,
  error,
  topicSlug,
  topicName = (slug) => slug,
}: {
  /** The stored code, or '' for "not diagnosed". */
  value: string
  onChange: (code: string) => void
  /** The message the student reads when they pick this option. */
  feedback: string
  onFeedbackChange: (message: string) => void
  /** A publish error keyed to `options[index].feedback`, shown under the box. */
  error?: string
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
    <div className="mt-3 min-w-0 rounded-xl border border-indigo-100 bg-indigo-50/60 p-4">
      {/* No "Misconception" heading: it would repeat on every answer card, and the section above
          the cards says what this block is for once. The chip names the error on its own, and the
          list is only here while there is nothing chosen. */}
      {value ? (
        <div className="flex flex-wrap items-center gap-2">
          <MisconceptionCodeChip code={value} title={describeError(selected)} />
          <button
            type="button"
            onClick={() => onChange('')}
            className="text-xs font-medium text-slate-500 underline decoration-dotted underline-offset-2 hover:text-indigo-600"
          >
            Clear
          </button>
        </div>
      ) : null}

      {value ? null : (
        <select
          id={selectId}
          onChange={(event) => onChange(event.target.value)}
          className="w-full min-w-0 rounded-md border border-indigo-100 bg-white px-3 py-2 text-sm text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
        >
          <option value="">Choose the mistake a student makes…</option>
          {groups.map((group) => (
            <optgroup key={group.topic} label={topicName(group.topic)}>
              {group.items.map((item) => (
                <option key={item.code} value={item.code} title={item.misconception}>
                  {/* Long sentences make an unusably wide native popup. The full sentence is on
                      the chip's tooltip once the option is chosen. */}
                  {shorten(item.misconception)}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      )}

      {unknown ? (
        <p className="mt-1.5 text-xs text-amber-700">
          “{value}” is not in the list. Choose one, or leave it unset.
        </p>
      ) : null}

      <label className="mt-4 block">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Feedback{' '}
          <span className="font-normal normal-case text-slate-400">
            (what the student sees if they pick this wrong answer)
          </span>
        </span>
        <textarea
          value={feedback}
          onChange={(event) => onFeedbackChange(event.target.value)}
          rows={3}
          maxLength={MAX_FEEDBACK}
          // The message is written to the student, and the shape is what makes it land: what they
          // probably thought, then what is true. A placeholder teaches it better than a rule would.
          placeholder="You might have thought that …, but …"
          className="mt-1.5 w-full min-w-0 rounded-md border border-indigo-100 bg-white px-3 py-2 text-base leading-relaxed text-slate-800 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
        />
      </label>
      {error ? <p className="mt-1.5 text-xs text-rose-600">{error}</p> : null}
    </div>
  )
}

/** The register's sentence for a code, with its example, as one tooltip. */
function describeError(entry: Misconception | undefined): string | undefined {
  if (!entry) return undefined
  return entry.example ? `${entry.misconception} For example: ${entry.example}.` : entry.misconception
}

/** Keeps a native dropdown usable without hiding the distinction it is there to draw. */
function shorten(sentence: string, limit = 90): string {
  return sentence.length <= limit ? sentence : `${sentence.slice(0, limit - 1).trimEnd()}…`
}
