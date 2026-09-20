import { Link } from 'react-router-dom'
import { PrototypeBadge } from '../components/PrototypeBadge'
import { APP_FULL_NAME } from '../lib/branding'
import { GUIDANCE_URL, PUBLICATION_URL } from '../lib/guidance'
import { misconception } from '../lib/misconceptions'

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
 * signed in yet. It reads the register itself for the example, so what it shows cannot go stale
 * as the bank is rewritten.
 */
export function AboutPage() {
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
      <p className="mt-3 text-lg leading-relaxed text-slate-700">Mistakes are good!</p>
      <p className="mt-3 leading-relaxed text-slate-600">
        When a student picks a wrong answer it is rarely a guess. It shows what they know so far, and
        what they might have muddled up.
      </p>
      <p className="mt-3 leading-relaxed text-slate-600">
        So when we design a question, the “wrong” answers in the multiple choice are not random. Each
        one is the right answer to the question a student thinks they were asked. Knowing that unlocks
        learning. We can give feedback to the student: “you might have thought that…? but…”
      </p>
      <p className="mt-3 leading-relaxed text-slate-600">
        Each “misconception” comes from the DfE and NCETM’s{' '}
        <a
          href={GUIDANCE_URL}
          target="_blank"
          rel="noreferrer"
          className="font-medium text-indigo-600 hover:text-indigo-700"
        >
          Key Stage 3 mathematics guidance
        </a>
        .
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
        answer. This is what the app says when they pick it:
      </p>
      <div className="mt-3 rounded-xl bg-orange-50 px-5 py-4 text-orange-900">
        <p className="flex items-center gap-2 font-semibold">
          <span aria-hidden="true">💡</span> Good try
        </p>
        {/* The two lines the quiz renders for this pick: the message hung on the wrong option in
            content/bank/01-place-value.json, then the item's explanation. Kept in step with the
            bank by hand, like EXAMPLE itself, because the page is public and the catalog is not. */}
        <p className="mt-2 text-sm leading-relaxed">
          <strong>You might have thought that</strong> the 2 fills the tenths column,{' '}
          <strong>but</strong> it is in the hundredths column, so it is worth 0.02.
        </p>
        <p className="mt-1.5 text-sm leading-relaxed opacity-90">
          After the point come tenths, then hundredths, then thousandths. In 5.320 the 2 is in the
          hundredths column, so it is worth 2 hundredths, 0.02. Writing 0.2 puts it in the tenths
          column, 0.002 puts it in the thousandths column, and 2 puts it in the units column.
        </p>
      </div>

      <h2 className="mt-10 text-lg font-semibold text-slate-900">Where they come from</h2>
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
          <span className="text-slate-500"> — the DfE and NCETM guidance they come from</span>
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

      <p className="mt-6 leading-relaxed text-slate-600">
        For teachers, the portal is a question editor. Write the options, tag each wrong one with the
        misconception it catches, and the question is designed around the errors you want to draw out
        rather than around the answer alone.
      </p>

      <h2 className="mt-10 text-lg font-semibold text-slate-900">What this is not</h2>
      <p className="mt-3 leading-relaxed text-slate-600">
        The Key Stage 3 guidance is non-statutory, Crown copyright and used under the Open Government
        Licence v3.0. This app is not endorsed by, and has no connection with, the Department for
        Education or the NCETM.
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
