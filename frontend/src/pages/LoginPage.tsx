import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { ApiRequestError } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { SIGN_IN_ROLES } from '../auth/roles'
import { AuthShell } from '../components/AuthShell'
import { Button } from '../components/ui'

/**
 * Step one: who is signing in.
 *
 * These are links rather than buttons, because they navigate — so the browser's back button,
 * middle-click and "open in new tab" all behave, and the choice ends up in the URL where it can
 * be seen.
 *
 * The choice cannot be a permission and is not treated as one: it decides which sign-in page and
 * which landing page, and nothing else. See `auth/roles.ts`.
 *
 * Guest sign-in sits here as well as on the student step, because somebody who just wants a look
 * should not have to choose a role first. It is labelled as a *student* guest, since a guest
 * account has no Google identity and so can never be a teacher.
 */
export function LoginPage() {
  const { continueAsGuest, profile, restoring } = useAuth()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  // Someone already signed in has no business here, but wait for the session to be checked first
  // or a refresh would flash this page before the profile arrives.
  if (!restoring && profile) {
    return <Navigate to="/" replace />
  }

  const startGuestSession = async () => {
    setMessage('')
    setBusy(true)
    try {
      await continueAsGuest()
      // A guest is a student, so there is no landing decision to make here.
      navigate('/', { replace: true })
    } catch (error) {
      setMessage(
        error instanceof ApiRequestError ? error.message : 'Could not start a guest session.',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell subtitle="Short, focused maths practice that shows you where you went wrong.">
      {/* This is the page heading now that no product name sits above it. */}
      <h1 className="mt-8 text-center text-xl font-bold text-slate-900">Who's signing in?</h1>

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

      <div className="my-7 flex items-center gap-3 text-xs text-slate-400">
        <span className="h-px flex-1 bg-slate-200" />
        or
        <span className="h-px flex-1 bg-slate-200" />
      </div>

      <div className="text-center">
        <Button
          variant="secondary"
          size="lg"
          className="w-full"
          disabled={busy}
          onClick={() => void startGuestSession()}
        >
          {busy ? 'Please wait…' : 'Try it as a guest student'}
        </Button>
        <p className="mt-2 text-xs text-slate-400">
          A throwaway student account. Progress is not kept.
        </p>
      </div>

      {message ? (
        <p role="alert" className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-center text-sm text-rose-700">
          {message}
        </p>
      ) : null}
    </AuthShell>
  )
}
