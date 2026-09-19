import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiRequestError } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { Button } from '../components/ui'

type Mode = 'signin' | 'signup'

const HIGHLIGHTS = [
  'Multiple-choice questions across five topics',
  'Instant feedback with a worked explanation',
  'Points, streaks and per-topic progress',
]

export function LoginPage() {
  const { login, register, profile, restoring } = useAuth()
  const navigate = useNavigate()

  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [message, setMessage] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!restoring && profile) {
      navigate('/', { replace: true })
    }
  }, [restoring, profile, navigate])

  const run = async (action: () => Promise<void>) => {
    setMessage('')
    setFieldErrors({})
    setBusy(true)
    try {
      await action()
      navigate('/', { replace: true })
    } catch (error) {
      if (error instanceof ApiRequestError) {
        setMessage(error.message)
        setFieldErrors(error.fieldErrors)
      } else {
        setMessage('Something went wrong. Please try again.')
      }
    } finally {
      setBusy(false)
    }
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    void run(() =>
      mode === 'signin' ? login(email, password) : register(email, password, displayName),
    )
  }

  const handleGuest = () => {
    const suffix = Math.random().toString(36).slice(2, 8)
    void run(() =>
      register(`guest_${suffix}@realmaths.local`, `guest-${suffix}-password`, `Guest ${suffix.toUpperCase()}`),
    )
  }

  const switchMode = (next: Mode) => {
    setMode(next)
    setMessage('')
    setFieldErrors({})
  }

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

      {/* Form panel */}
      <div className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-sm animate-rise">
          <div className="mb-8 flex items-center gap-3 text-xl font-bold text-slate-900 lg:hidden">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-indigo-600 text-white">∑</span>
            Real Maths
          </div>

          <h1 className="text-2xl font-bold text-slate-900">
            {mode === 'signin' ? 'Welcome back' : 'Create your account'}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {mode === 'signin'
              ? 'Sign in to pick up where you left off.'
              : 'Takes a few seconds — an email and a password is all we need.'}
          </p>

          <div className="mt-6 grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
            {(['signin', 'signup'] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => switchMode(value)}
                className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                  mode === value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {value === 'signin' ? 'Sign in' : 'Register'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
            {mode === 'signup' ? (
              <Field label="Your name" error={fieldErrors['displayName']}>
                <input
                  type="text"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  autoComplete="name"
                  placeholder="Ada Lovelace"
                  className={inputClass(fieldErrors['displayName'])}
                />
              </Field>
            ) : null}

            <Field label="Email" error={fieldErrors['email']}>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                placeholder="you@example.com"
                className={inputClass(fieldErrors['email'])}
              />
            </Field>

            <Field label="Password" error={fieldErrors['password']} hint={mode === 'signup' ? 'At least 8 characters' : undefined}>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                placeholder="••••••••"
                className={inputClass(fieldErrors['password'])}
              />
            </Field>

            {message ? (
              <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {message}
              </p>
            ) : null}

            <Button type="submit" size="lg" className="w-full" disabled={busy}>
              {busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
            </Button>
          </form>

          <div className="my-6 flex items-center gap-3 text-xs text-slate-400">
            <span className="h-px flex-1 bg-slate-200" />
            or
            <span className="h-px flex-1 bg-slate-200" />
          </div>

          <Button variant="secondary" size="lg" className="w-full" onClick={handleGuest} disabled={busy}>
            Quick start as a guest
          </Button>
          <p className="mt-3 text-center text-xs text-slate-400">
            Creates a throwaway account — handy for trying the quiz.
          </p>
        </div>
      </div>
    </div>
  )
}

function inputClass(error?: string): string {
  return [
    'w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400',
    'focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20',
    error ? 'border-rose-300' : 'border-slate-200',
  ].join(' ')
}

function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string
  error?: string
  hint?: string
  children: ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-700">{label}</span>
      {children}
      {error ? (
        <span className="mt-1 block text-xs text-rose-600">{error}</span>
      ) : hint ? (
        <span className="mt-1 block text-xs text-slate-400">{hint}</span>
      ) : null}
    </label>
  )
}
