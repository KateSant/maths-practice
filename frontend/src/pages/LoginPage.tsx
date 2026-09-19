import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ApiRequestError } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { isGoogleConfigured, renderGoogleButton } from '../auth/google'
import { Button } from '../components/ui'

const HIGHLIGHTS = [
  'Multiple-choice questions across five topics',
  'Instant feedback with a worked explanation',
  'Points, streaks and per-topic progress',
]

export function LoginPage() {
  const { signInWithGoogle, continueAsGuest, profile, restoring } = useAuth()
  const navigate = useNavigate()
  const buttonHost = useRef<HTMLDivElement>(null)

  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!restoring && profile) {
      navigate('/', { replace: true })
    }
  }, [restoring, profile, navigate])

  const run = useCallback(
    async (action: () => Promise<void>) => {
      setMessage('')
      setBusy(true)
      try {
        await action()
        navigate('/', { replace: true })
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

  // Google renders its own button into our element, so it is wired up imperatively
  // rather than as a normal React component.
  useEffect(() => {
    const host = buttonHost.current
    if (!isGoogleConfigured || !host) {
      return
    }

    let cancelled = false
    void (async () => {
      try {
        await renderGoogleButton(host, (credential) => {
          void run(() => signInWithGoogle(credential))
        })
      } catch (error) {
        // A blocked or failed script must say so, not leave a blank space.
        if (!cancelled) {
          setMessage(error instanceof Error ? error.message : 'Google sign-in is unavailable.')
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [run, signInWithGoogle])

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-indigo-600 p-10 text-white lg:flex">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            background:
              'radial-gradient(600px 300px at 20% 10%, rgba(255,255,255,0.35), transparent 70%), radial-gradient(500px 320px at 90% 90%, rgba(139,92,246,0.6), transparent 70%)',
          }}
        />
        <div className="relative">
          <div className="flex items-center gap-3 text-2xl font-bold">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-white/15 text-xl">∑</span>
            Real Maths
          </div>
          <p className="mt-6 max-w-sm text-lg text-indigo-100">
            Short, focused maths practice that shows you exactly where you went wrong.
          </p>
        </div>

        <ul className="relative space-y-3">
          {HIGHLIGHTS.map((item) => (
            <li key={item} className="flex items-start gap-3 text-indigo-50">
              <span className="mt-1 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-white/20 text-xs">
                ✓
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ul>

        <p className="relative text-xs text-indigo-200">
          Prototype · starter question bank of 32 questions
        </p>
      </div>

      {/* Sign-in panel */}
      <div className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-sm animate-rise">
          <div className="mb-8 flex items-center gap-3 text-xl font-bold text-slate-900 lg:hidden">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-indigo-600 text-white">∑</span>
            Real Maths
          </div>

          <h1 className="text-2xl font-bold text-slate-900">Welcome back</h1>
          <p className="mt-1 text-sm text-slate-500">
            Sign in to pick up where you left off. Your progress is saved to your account.
          </p>

          <div className="mt-8">
            {isGoogleConfigured ? (
              <div ref={buttonHost} className="flex min-h-[44px] justify-center" />
            ) : (
              // Almost always a missing VITE_GOOGLE_CLIENT_ID at build time. Saying so
              // beats an unexplained blank space above the guest button.
              <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
                Google sign-in is not configured for this build. Set{' '}
                <code className="font-mono text-xs">VITE_GOOGLE_CLIENT_ID</code> and rebuild.
              </p>
            )}
          </div>

          {message ? (
            <p role="alert" className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {message}
            </p>
          ) : null}

          <div className="my-6 flex items-center gap-3 text-xs text-slate-400">
            <span className="h-px flex-1 bg-slate-200" />
            or
            <span className="h-px flex-1 bg-slate-200" />
          </div>

          <Button
            variant="secondary"
            size="lg"
            className="w-full"
            onClick={() => void run(continueAsGuest)}
            disabled={busy}
          >
            Quick start as a guest
          </Button>
          <p className="mt-3 text-center text-xs text-slate-400">
            Creates a throwaway account — handy for trying the quiz. Your progress will not be kept.
          </p>

          <p className="mt-8 text-center text-xs text-slate-400">
            <Link to="/privacy" className="hover:text-slate-600">
              Privacy
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
