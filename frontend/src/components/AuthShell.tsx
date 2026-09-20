import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { APP_DESCRIPTOR, APP_FULL_NAME, APP_MARK } from '../lib/branding'
import { GUIDANCE_URL } from '../lib/guidance'
import { PrototypeBadge } from './PrototypeBadge'

/**
 * The centred layout both sign-in steps sit in, so the choice and the sign-in look like one
 * continuous flow rather than two unrelated screens.
 *
 * The full name sits above the page's own heading, as text — the badge is the header's logo and
 * nowhere else. It spells out the acronym, which is the only place a visitor can learn it. The
 * page's own heading is still the first thing to read.
 */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-screen place-items-center px-6 py-12">
      <div className="w-full max-w-md animate-rise">
        <div className="flex flex-col items-center">
          <span
            aria-hidden="true"
            className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-600 text-base font-bold text-white shadow-sm shadow-indigo-600/30"
          >
            {APP_MARK}
          </span>
          <p className="mt-2.5 text-center text-lg font-bold tracking-tight text-slate-900">{APP_FULL_NAME}</p>
          <p className="text-center text-sm text-slate-500">{APP_DESCRIPTOR}</p>
        </div>
        {children}
      </div>

      {/* The provenance sits with the prototype marker rather than in the sign-in column. It is a
          footnote to the page, and the people who look for it - a teacher, a head of maths - look
          at the edge rather than in the flow. Two links: the page that explains how the mistakes
          are used, and the guidance itself, so the source is one click away and not only a claim.
          Offset above the marker so the two never collide. */}
      <div className="fixed bottom-9 right-3 z-20 flex max-w-[90vw] flex-wrap items-center justify-end gap-x-3 gap-y-1 text-right text-sm">
        <Link to="/about" className="font-medium text-slate-500 hover:text-indigo-600">
          Mistakes are good because they reveal misconceptions
        </Link>
        <span aria-hidden="true" className="text-slate-300">
          ·
        </span>
        <a
          href={GUIDANCE_URL}
          target="_blank"
          rel="noreferrer"
          className="font-medium text-slate-500 underline decoration-dotted underline-offset-2 hover:text-indigo-600"
        >
          Read the DfE guidance ↗
        </a>
      </div>

      <PrototypeBadge />
    </div>
  )
}
