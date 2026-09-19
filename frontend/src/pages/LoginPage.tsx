import { useCallback, useEffect, useRef, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { ApiRequestError } from '../api/client'
import type { Profile } from '../api/types'
import { useAuth } from '../auth/AuthContext'
import { isGoogleConfigured, renderGoogleButton } from '../auth/google'
import { Button } from '../components/ui'

/**
 * Sign in, then go where your account says you belong.
 *
 * There is deliberately no "are you a student or a teacher?" step. The role is a property of the
 * account, so asking someone to declare it before signing in is asking them to guess about
 * themselves, and the guess cannot be checked — the client has no say in what a token may do.
 * Whoever an administrator is, their role is already known by the time they are signed in.
 *
 * The teacher side is still signposted, because a visitor cannot see the Admin tab until they are
 * signed in *and* an administrator, so without a word about it a teacher arrives at what looks
 * like a maths quiz and never discovers the questions are editable. One line of copy does that job
 * without pretending to be a choice.
 *
 * Google renders its own button inside an iframe, so the sign-in button has to be theirs.
 */
export function LoginPage() {
  const { signInWithGoogle, continueAsGuest, profile, restoring } = useAuth()
  const navigate = useNavigate()
  const buttonHost = useRef<HTMLDivElement>(null)

  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  /**
   * Set once we have decided where to go. Without it the "already signed in" check below can win
   * the race against the navigation and send a teacher to the student home instead.
   */
  const leaving = useRef(false)

  const run = useCallback(
    async (action: () => Promise<Profile>) => {
      setMessage('')
      setBusy(true)
      try {
        const who = await action()
        leaving.current = true
        navigate(who.user.role === 'ADMIN' ? '/admin/questions' : '/', { replace: true })
      } catch (error) {
        setMessage(
          error instanceof ApiRequestError ? error.message : 'Something went wrong. Please try again.',
        )
      } finally {
        setBusy(false)
      }
    },
    [navigate],
  )

  useEffect(() => {
    const host = buttonHost.current
    if (!isGoogleConfigured || !host) return

    let cancelled = false
    void (async () => {
      try {
        await renderGoogleButton(host, (credential) => {
          void run(() => signInWithGoogle(credential))
        })
      } catch (error) {
        if (!cancelled) {
          setMessage(error instanceof Error ? error.message : 'Google sign-in is unavailable.')
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [run, signInWithGoogle])

  // Deliberately after every hook, so the hook order cannot change between renders.
  if (!restoring && !busy && profile && !leaving.current) {
    return <Navigate to="/" replace />
  }

  return (
    <div className="grid min-h-screen place-items-center px-6 py-12">
      <div className="w-full max-w-md animate-rise text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-indigo-600 text-2xl text-white shadow-sm shadow-indigo-600/30">
          ∑
        </span>
        <h1 className="mt-5 text-3xl font-bold text-slate-900">Real Maths</h1>
        <p className="mt-2 text-slate-500">
          Short, focused maths practice that shows you exactly where you went wrong.
        </p>

        <div className="mt-8">
          {isGoogleConfigured ? (
            <div ref={buttonHost} className="flex min-h-[44px] justify-center" />
          ) : (
            // Almost always a missing VITE_GOOGLE_CLIENT_ID at build time. Saying so beats an
            // unexplained blank space above the guest button.
            <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Google sign-in is not configured for this build. Set{' '}
              <code className="font-mono text-xs">VITE_GOOGLE_CLIENT_ID</code> and restart.
            </p>
          )}
        </div>

        {/* Signposting, not a choice. Teachers land in the question bank on their own. */}
        <p className="mt-4 text-xs text-slate-400">
          Teachers: signing in takes you straight to the question bank.
        </p>

        {message ? (
          <p role="alert" className="mt-5 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {message}
          </p>
        ) : null}

        <div className="mt-10">
          <Button variant="ghost" size="sm" disabled={busy} onClick={() => void run(continueAsGuest)}>
            Try it as a guest
          </Button>
          <p className="mt-2 text-xs text-slate-400">A throwaway account. Progress is not kept.</p>
        </div>
      </div>
    </div>
  )
}
