import type { ReactNode } from 'react'
import { APP_NAME } from '../lib/branding'

/**
 * The centred layout both sign-in steps sit in, so the choice and the sign-in look like one
 * continuous flow rather than two unrelated screens.
 */
export function AuthShell({ subtitle, children }: { subtitle?: string; children: ReactNode }) {
  return (
    <div className="grid min-h-screen place-items-center px-6 py-12">
      <div className="w-full max-w-md animate-rise">
        <div className="flex flex-col items-center text-center">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-indigo-600 text-2xl text-white shadow-sm shadow-indigo-600/30">
            ∑
          </span>
          <h1 className="mt-5 text-3xl font-bold text-slate-900">{APP_NAME}</h1>
          {subtitle ? <p className="mt-2 text-slate-500">{subtitle}</p> : null}
        </div>
        {children}
      </div>
    </div>
  )
}
