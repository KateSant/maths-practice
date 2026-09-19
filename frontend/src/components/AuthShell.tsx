import type { ReactNode } from 'react'

/**
 * The centred layout both sign-in steps sit in, so the choice and the sign-in look like one
 * continuous flow rather than two unrelated screens.
 *
 * The mark stands alone: the product has no name yet, so nothing is written above the content.
 * Each page supplies its own heading, which is why there is no h1 here.
 */
export function AuthShell({ subtitle, children }: { subtitle?: string; children: ReactNode }) {
  return (
    <div className="grid min-h-screen place-items-center px-6 py-12">
      <div className="w-full max-w-md animate-rise">
        <div className="flex flex-col items-center text-center">
          <span
            aria-hidden="true"
            className="grid h-14 w-14 place-items-center rounded-2xl bg-indigo-600 text-2xl text-white shadow-sm shadow-indigo-600/30"
          >
            ∑
          </span>
          {subtitle ? <p className="mt-5 text-slate-500">{subtitle}</p> : null}
        </div>
        {children}
      </div>
    </div>
  )
}
