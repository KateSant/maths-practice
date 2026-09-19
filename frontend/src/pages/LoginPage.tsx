import { useCallback, useEffect, useRef, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { ApiRequestError } from '../api/client'
import type { Profile } from '../api/types'
import { useAuth } from '../auth/AuthContext'
import { isGoogleConfigured, renderGoogleButton } from '../auth/google'
import { Button } from '../components/ui'

type Mode = 'student' | 'teacher'

/**
 * What you want to do, then who you are.
 *
 * The two doors are signposting and the sign-in is identity, and they answer different questions.
 * A visitor cannot see the Admin tab until they are signed in *and* an administrator, so without
 * a visible Teacher door a teacher arrives at what looks like a maths quiz and has no idea the
 * question bank is editable.
 *
 * The door cannot be a gate, though — the role lives on the account and the client has no say in
 * it — so it is treated as a statement of intent. The role is what decides, and when the two
 * disagree the page says so rather than quietly landing someone somewhere they did not ask for.
 *
 * Google renders its own button inside an iframe, so the sign-in button has to be theirs even
 * though the choice above it is ours.
 */
const MODES: { value: Mode; label: string; description: string }[] = [
  { value: 'student', label: 'Student', description: 'Practise questions and track your progress.' },
  { value: 'teacher', label: 'Teacher', description: 'Write and edit the question bank.' },
]

function landingFor(chosen: Mode): string {
  return chosen === 'teacher' ? '/admin/questions' : '/'
}

export function LoginPage() {
  const { signInWithGoogle, continueAsGuest, logout, profile, restoring } = useAuth()
  const navigate = useNavigate()
  const buttonHost = useRef<HTMLDivElement>(null)

  const [mode, setMode] = useState<Mode>('student')
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
    async (action: () => Promise<Profile>, chosen: Mode) => {
      setMessage('')
      setBusy(true)
      try {
        const who = await action()

        if (chosen === 'teacher' && who.user.role !== 'ADMIN') {
          // Say so, rather than silently landing them on practice. Most likely cause is signing
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
  }, [run, signInWithGoogle, mode, notATeacher])

  // Deliberately after every hook, so the hook order cannot change between renders.
  if (!restoring && !busy && profile && !leaving.current && !notATeacher) {
    return <Navigate to="/" replace />
  }

  if (notATeacher) {
    return (
      <div className="grid min-h-screen place-items-center px-6 py-12">
        <div className="w-full max-w-md animate-rise text-center">
          <h1 className="text-2xl font-bold text-slate-900">Let's get you practising</h1>
          <p className="mt-3 text-slate-600">
            You're signed in as <strong className="font-semibold">{profile?.user.displayName}</strong>. That
            account isn't set up for teaching, so the question bank isn't available — nothing is broken,
            there's just no teacher access on it.
          </p>
          <p className="mt-3 text-sm text-slate-500">
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
        </div>
      </div>
    )
  }

  const active = MODES.find((option) => option.value === mode)

  return (
    <div className="grid min-h-screen place-items-center px-6 py-12">
      <div className="w-full max-w-md animate-rise">
        <div className="flex flex-col items-center text-center">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-indigo-600 text-2xl text-white shadow-sm shadow-indigo-600/30">
            ∑
          </span>
          <h1 className="mt-5 text-3xl font-bold text-slate-900">Real Maths</h1>
          <p className="mt-2 text-slate-500">{active?.description}</p>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-3" role="group" aria-label="What are you here to do">
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
      </div>
    </div>
  )
}
