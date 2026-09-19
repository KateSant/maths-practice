import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { SIGN_IN_ROLES } from '../auth/roles'
import { AuthShell } from '../components/AuthShell'

/**
 * Step one: who is signing in.
 *
 * These are links rather than buttons, because they navigate — so the browser's back button,
 * middle-click and "open in new tab" all behave, and the choice ends up in the URL where it can
 * be seen.
 *
 * The choice cannot be a permission and is not treated as one: it decides which sign-in page and
 * which landing page, and nothing else. See `auth/roles.ts`.
 */
export function LoginPage() {
  const { profile, restoring } = useAuth()

  // Someone already signed in has no business here, but wait for the session to be checked first
  // or a refresh would flash this page before the profile arrives.
  if (!restoring && profile) {
    return <Navigate to="/" replace />
  }

  return (
    <AuthShell subtitle="Short, focused maths practice that shows you where you went wrong.">
      <p className="mt-8 text-center text-sm font-medium text-slate-700">Who's signing in?</p>

      <div className="mt-3 space-y-3">
        {SIGN_IN_ROLES.map((option) => (
          <Link
            key={option.value}
            to={`/login/${option.value}`}
            className="block rounded-2xl border border-slate-200 bg-white/70 p-4 transition hover:border-indigo-300 hover:bg-white focus-visible:border-indigo-400"
          >
            <span className="flex items-center justify-between gap-3">
              <span className="font-semibold text-slate-900">{option.label}</span>
              <span aria-hidden="true" className="text-slate-400">
                →
              </span>
            </span>
            <span className="mt-1 block text-sm leading-snug text-slate-500">{option.description}</span>
          </Link>
        ))}
      </div>
    </AuthShell>
  )
}
