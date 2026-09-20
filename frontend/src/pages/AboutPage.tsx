import { Link } from 'react-router-dom'
import { PrototypeBadge } from '../components/PrototypeBadge'
import { APP_FULL_NAME } from '../lib/branding'
import { GUIDANCE_URL, PUBLICATION_URL } from '../lib/guidance'
import { MISCONCEPTIONS, misconception } from '../lib/misconceptions'

/**
 * One real question from the bank, shown as it appears to a student, with the register entry each
 * wrong option catches. Hard-coded rather than fetched: the page is public, the catalog is not,
 * and the point is to show the shape of an item rather than to serve live content.
 */
const EXAMPLE = {
  prompt: 'What is the value of the 2 in 5.320?',
  options: [
    { label: 'A', text: '0.02', code: null },
    { label: 'B', text: '0.2', code: 'PV-COLUMN-NAME' },
    { label: 'C', text: '0.002', code: 'PV-COLUMN-NAME' },
    { label: 'D', text: '2', code: 'PV-POWER-TEN' },
  ],
}

/**
 * What this is, and where the wrong answers come from.
 *
 * A public page rather than a signed-in one: the people who most want to check the provenance of
 * the questions - a teacher, a head of maths, a parent - are exactly the people who have not
 * signed in yet. It reads the register itself for the counts and for the example, so the numbers
 * on this page cannot go stale as the bank is rewritten.
 */
export function AboutPage() {
  const total = MISCONCEPTIONS.length
  const topics = new Set(MISCONCEPTIONS.map((entry) => entry.topic)).size
  const quoted = MISCONCEPTIONS.filter((entry) => entry.source?.kind === 'quoted').length
  const subjectKnowledge = total - quoted

  // The distinct codes the example's wrong options catch, in the order they appear.
  const exampleCodes = [...new Set(EXAMPLE.options.map((option) => option.code).filter(Boolean))] as string[]

  return (
    <div className="mx-auto max-w-2xl px-6 py-12 sm:py-16">
      <div className="flex items-center gap-3">
        <span className="text-sm font-bold tracking-tight text-slate-900">{APP_FULL_NAME}</span>
        <Link to="/login" className="text-sm font-medium text-indigo-600 hover:text-indigo-700">
          ← Back to sign in
        </Link>
      </div>

      <h1 className="mt-8 text-2xl font-bold text-slate-900 sm:text-3xl">How these questions are designed</h1>
      <p className="mt-3 text-lg leading-relaxed text-slate-700">
        Mistakes are good. They reveal misconceptions — the ideas that make a student get the answer
        wrong.
      </p>
      <p className="mt-3 leading-relaxed text-slate-600">
        A wrong answer is rarely a guess. It is usually the answer a student’s own method produced, so
        it tells you something a right answer cannot: what they believe. Most practice just marks it
        wrong and moves on. Here, every wrong answer says what the student was thinking — and corrects
        the rule, not just the digit.
      </p>
      <p className="mt-3 leading-relaxed text-slate-600">
        So these are not random wrong answers. Every option is written to catch one particular mistake
        — a rule that works on the examples a student has met, and then stops working — and the
        mistakes are drawn from the DfE and NCETM’s{' '}
        <a
          href={GUIDANCE_URL}
          target="_blank"
          rel="noreferrer"
          className="font-medium text-indigo-600 hover:text-indigo-700"
        >
          Key Stage 3 mathematics guidance
        </a>
        , where each unit carries a passage headed <em>Common difficulties and misconceptions</em>.
      </p>

      <h2 className="mt-10 text-lg font-semibold text-slate-900">An example</h2>
      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">From the bank</p>
        <p className="mt-2 font-medium text-slate-900">{EXAMPLE.prompt}</p>

        <ul className="mt-4 space-y-2">
          {EXAMPLE.options.map((option) => (
            <li key={option.label} className="flex items-center gap-3">
              <span
                className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg text-sm font-bold ${
                  option.code ? 'border border-slate-200 bg-white text-slate-500' : 'bg-emerald-600 text-white'
                }`}
              >
                {option.label}
              </span>
              <span className="text-sm text-slate-800">{option.text}</span>
              {option.code ? (
                <span className="ml-auto rounded bg-indigo-600 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-white">
                  {option.code}
                </span>
              ) : (
                <span className="ml-auto text-xs font-medium text-emerald-700">the answer</span>
              )}
            </li>
          ))}
        </ul>

        <div className="mt-5 space-y-3 border-t border-slate-100 pt-4">
          {exampleCodes.map((code) => {
            const entry = misconception(code)
            if (!entry) return null
            return (
              <div key={code}>
                <span className="rounded bg-indigo-600 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-white">
                  {entry.code}
                </span>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{entry.misconception}</p>
              </div>
            )
          })}
        </div>
      </div>
      <p className="mt-3 leading-relaxed text-slate-600">
        A student who reads the 2 as filling the tenths column is not making a slip. On the question
        they think they were asked, <span className="font-medium text-slate-800">0.2</span> is the right
        answer. The explanation can say that, and put the column right — which is a different job from
        marking the digit wrong.
      </p>

      <h2 className="mt-10 text-lg font-semibold text-slate-900">Where the mistakes come from</h2>
      <p className="mt-3 leading-relaxed text-slate-600">
        Every mistake in the bank is recorded in one register: {total} entries across {topics} topics,
        each with a one-line description of the error and an example of the answer it produces. Every
        wrong option in a question names the entry it catches, so a wrong pick is read as a specific
        error rather than as an anonymous mark lost.
      </p>
      <p className="mt-3 leading-relaxed text-slate-600">
        None of them is invented. {quoted} of the entries are quoted from the Department for
        Education’s Key Stage 3 mathematics guidance, written with the NCETM, in which each unit
        carries a passage headed <em>Common difficulties and misconceptions</em>. The other{' '}
        {subjectKnowledge} are standard subject knowledge for the topic they sit under, recorded as
        such.
      </p>
      <ul className="mt-4 space-y-2 text-sm">
        <li>
          <a
            className="font-medium text-indigo-600 hover:text-indigo-700"
            href={GUIDANCE_URL}
            target="_blank"
            rel="noreferrer"
          >
            Mathematics guidance: Key Stage 3 (PDF)
          </a>
          <span className="text-slate-500"> — the DfE and NCETM guidance the mistakes are drawn from</span>
        </li>
        <li>
          <a
            className="font-medium text-indigo-600 hover:text-indigo-700"
            href={PUBLICATION_URL}
            target="_blank"
            rel="noreferrer"
          >
            The guidance on GOV.UK
          </a>
          <span className="text-slate-500"> — publication page and downloads</span>
        </li>
      </ul>

      <h2 className="mt-10 text-lg font-semibold text-slate-900">What this is not</h2>
      <p className="mt-3 leading-relaxed text-slate-600">
        The Key Stage 3 guidance is non-statutory and Crown copyright, available under the Open
        Government Licence v3.0. This app quotes it and follows it. It is not endorsed by, and has no
        connection with, the Department for Education or the NCETM.
      </p>

      <div className="mt-10 border-t border-slate-200 pt-6">
        <Link to="/login" className="text-sm font-medium text-indigo-600 hover:text-indigo-700">
          ← Back to sign in
        </Link>
      </div>

      <PrototypeBadge />
    </div>
  )
}
