import type { ReactNode } from 'react'

/**
 * The centred layout both sign-in steps sit in, so the choice and the sign-in look like one
 * continuous flow rather than two unrelated screens.
 *
 * Just the mark and the content. The product has no name and no strapline, so there is nothing
 * above the page's own heading — which is also why there is no h1 here, and each page supplies
 * one.
 */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-screen place-items-center px-6 py-12">
      <div className="w-full max-w-md animate-rise">
        <div className="flex flex-col items-center">
          <span
            aria-hidden="true"
            className="grid h-14 w-14 place-items-center rounded-2xl bg-indigo-600 text-2xl text-white shadow-sm shadow-indigo-600/30"
          >
            ∑
          </span>
        </div>
        {children}
      </div>
    </div>
  )
}
