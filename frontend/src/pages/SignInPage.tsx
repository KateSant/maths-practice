import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { ApiRequestError } from '../api/client'
import type { Profile } from '../api/types'
import { useAuth } from '../auth/AuthContext'
import { isGoogleConfigured, renderGoogleButton } from '../auth/google'
import { allowsGuest, landingFor, parseRole, SIGN_IN_ROLES, type SignInRole } from '../auth/roles'
import { AuthShell } from '../components/AuthShell'
import { Button } from '../components/ui'

/**
 * Step two: sign in as the person you said you were.
 *
 * The role comes from the URL rather than from state, so a refresh or a shared link lands on the
 * same page, and the two steps stay independent.
 *
 * Google renders its own button inside an iframe, which is why this page exists at all: our own
 * button cannot open Google's account chooser, so the best available flow is to make the first
 * click lead somewhere that plainly continues it.
 */
export function SignInPage() {
  const { role } = useParams()
  const mode = parseRole(role)

  const { signInWithGoogle, continueAsGuest, logout, profile, restoring } = useAuth()
  const navigate = useNavigate()
  const buttonHost = useRef<HTMLDivElement>(null)

  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  /** Signed in, but not into the area they asked for. */
  const [notATeacher, setNotATeacher] = useState(false)

  /**
   * Set once we have decided where to go. Without it the "already signed in" check below can win
   * the race against the navigation and send a teacher to the student home instead.
   */
  const leaving = useRef(false)

  const run = useCallback(
    async (action: () => Promise<Profile>, chosen: SignInRole) => {
      setMessage('')
      setBusy(true)
      try {
        const who = await action()

        if (chosen === 'teacher' && who.user.role !== 'ADMIN') {
          // Say so, rather than silently landing them on practice. The likeliest cause is signing
          // in with the wrong Google account, so the panel offers a way to try another.
          setNotATeacher(true)
          return
        }

        leaving.current = true
        navigate(landingFor(chosen), { replace: true })
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
    if (!isGoogleConfigured || !host || notATeacher) return

    let cancelled = false
    void (async () => {
      try {
        await renderGoogleButton(host, (credential) => {
          if (!mode) return
          void run(() => signInWithGoogle(credential), mode)
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
  }, [run, signInWithGoogle, mode, notATeacher])

  // Everything below is after the hooks, so the hook order cannot change between renders.

  if (!mode) {
    // An invented role in the URL is not a reason to guess at one.
    return <Navigate to="/login" replace />
  }

  if (!restoring && !busy && profile && !leaving.current && !notATeacher) {
    return <Navigate to="/" replace />
  }

  const option = SIGN_IN_ROLES.find((candidate) => candidate.value === mode)

  if (notATeacher) {
    return (
      <AuthShell>
        <h1 className="mt-8 text-center text-xl font-bold text-slate-900">
          You're not a teacher on this account
        </h1>
        <p className="mt-3 text-center text-slate-600">
          You're signed in as <strong className="font-semibold">{profile?.user.displayName}</strong>. The
          question bank is only available to teacher accounts, so it isn't shown here.
        </p>
        <p className="mt-3 text-center text-sm text-slate-500">
          If you meant to use a different Google account, sign out and try again.
        </p>
        <div className="mt-8 flex flex-col gap-3">
          <Button size="lg" onClick={() => navigate('/', { replace: true })}>
            Carry on as a student
          </Button>
          <Button variant="secondary" size="lg" onClick={logout}>
            Use a different account
          </Button>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell>
      <h1 className="mt-8 text-center text-xl font-bold text-slate-900">Sign in as a {mode}</h1>
      <p className="mt-2 text-center text-sm text-slate-500">{option?.description}</p>

      <div className="mt-7">
        {isGoogleConfigured ? (
          <div ref={buttonHost} className="flex min-h-[44px] justify-center" />
        ) : (
          // Almost always a missing VITE_GOOGLE_CLIENT_ID at build time. Saying so beats an
          // unexplained blank space.
          <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Google sign-in is not configured for this build. Set{' '}
            <code className="font-mono text-xs">VITE_GOOGLE_CLIENT_ID</code> and restart.
          </p>
        )}
      </div>

      {message ? (
        <p role="alert" className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-center text-sm text-rose-700">
          {message}
        </p>
      ) : null}

      {/*
        Guests are offered only to students. A guest account has no Google identity, so it can
        never be granted teacher access - offering it here would be a door into a room that does
        not exist.
      */}
      {allowsGuest(mode) ? (
        <>
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
              onClick={() => void run(continueAsGuest, mode)}
            >
              Try it as a guest student
            </Button>
            <p className="mt-2 text-xs text-slate-400">
              A throwaway student account. Progress is not kept.
            </p>
          </div>
        </>
      ) : null}

      <p className="mt-8 text-center text-sm">
        <Link to="/login" className="text-slate-500 hover:text-slate-800">
          ← Back
        </Link>
      </p>
    </AuthShell>
  )
}
