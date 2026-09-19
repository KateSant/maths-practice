import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { ApiRequestError } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { isGoogleConfigured, renderGoogleButton } from '../auth/google'
import { Button } from '../components/ui'

type Mode = 'student' | 'teacher'

/**
 * Who you are, and then how you sign in.
 *
 * The choice is wayfinding, not a permission: both doors lead to the same Google sign-in, and it
 * only decides where you land afterwards. It cannot be a gate, because the client has no say in
 * what a token may do — that is the API's job, and a student who picked "Teacher" is bounced by
 * the role guard on the admin routes.
 *
 * Google renders its own button inside an iframe, so the choice above it has to be ours and the
 * sign-in button has to be theirs.
 */
const MODES: { value: Mode; label: string; description: string }[] = [
  { value: 'student', label: 'Student', description: 'Practise questions and track your progress.' },
  { value: 'teacher', label: 'Teacher', description: 'Write and edit the question bank.' },
]

/** A teacher lands in the admin tools; everyone else lands on practice. */
function landingFor(chosen: Mode): string {
  return chosen === 'teacher' ? '/admin/questions' : '/'
}

export function LoginPage() {
  const { signInWithGoogle, continueAsGuest, profile, restoring } = useAuth()
  const navigate = useNavigate()
  const buttonHost = useRef<HTMLDivElement>(null)

  const [mode, setMode] = useState<Mode>('student')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  /**
   * Set once we have decided where to go. Without it the "already signed in" check below can win
   * the race against the navigation and send a teacher to the student home instead.
   */
  const leaving = useRef(false)

  const run = useCallback(
    async (action: () => Promise<void>, chosen: Mode) => {
      setMessage('')
      setBusy(true)
      try {
        await action()
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
    if (!isGoogleConfigured || !host) return

    let cancelled = false
    void (async () => {
      try {
        await renderGoogleButton(host, (credential) => {
          // mode is read when the button is clicked, so the button does not need re-rendering
          // when the choice changes.
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
  }, [run, signInWithGoogle, mode])

  // Deliberately after every hook, so the hook order cannot change between renders.
  if (!restoring && !busy && profile && !leaving.current) {
    return <Navigate to="/" replace />
  }

  const active = MODES.find((option) => option.value === mode)

  return (
    <div className="grid min-h-screen place-items-center px-6 py-12">
      <div className="w-full max-w-md animate-rise">
        <div className="flex flex-col items-center text-center">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-indigo-600 text-2xl text-white shadow-sm shadow-indigo-600/30">
            ∑
          </span>
          <h1 className="mt-5 text-3xl font-bold text-slate-900">Joy for Maths</h1>
          <p className="mt-2 text-slate-500">{active?.description}</p>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-3" role="group" aria-label="Who is signing in">
          {MODES.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setMode(option.value)}
              aria-pressed={mode === option.value}
              className={`rounded-2xl border p-4 text-left transition ${
                mode === option.value
                  ? 'border-indigo-400 bg-indigo-50 ring-2 ring-indigo-500/20'
                  : 'border-slate-200 bg-white/70 hover:border-indigo-200 hover:bg-white'
              }`}
            >
              <span className="block font-semibold text-slate-900">{option.label}</span>
              <span className="mt-1 block text-xs leading-snug text-slate-500">{option.description}</span>
            </button>
          ))}
        </div>

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

        {message ? (
          <p role="alert" className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-center text-sm text-rose-700">
            {message}
          </p>
        ) : null}

        <div className="mt-10 text-center">
          <Button
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={() => void run(continueAsGuest, 'student')}
          >
            Try it as a guest
          </Button>
          <p className="mt-2 text-xs text-slate-400">A throwaway account. Progress is not kept.</p>
        </div>

        <p className="mt-10 text-center text-xs text-slate-400">
          <Link to="/privacy" className="hover:text-slate-600">
            Privacy
          </Link>
        </p>
      </div>
    </div>
  )
}
