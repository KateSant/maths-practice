import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost'
type Size = 'sm' | 'md' | 'lg'

const BASE =
  'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition ' +
  'disabled:cursor-not-allowed disabled:opacity-50'

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30 hover:bg-indigo-500 active:bg-indigo-700',
  secondary: 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 active:bg-slate-100',
  ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
}

const SIZES: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2.5 text-sm',
  lg: 'px-6 py-3.5 text-base',
}

/** Exported so <Link> can look identical to <Button> without a wrapper component. */
export function buttonClasses(variant: Variant = 'primary', size: Size = 'md', extra = ''): string {
  return [BASE, VARIANTS[variant], SIZES[size], extra].filter(Boolean).join(' ')
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  /** React 19 passes ref as a normal prop; it is spread onto the button below. */
  ref?: Ref<HTMLButtonElement>
}

export function Button({ variant = 'primary', size = 'md', className = '', ...rest }: ButtonProps) {
  return <button className={buttonClasses(variant, size, className)} {...rest} />
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl bg-white/90 shadow-sm ring-1 ring-slate-200/70 ${className}`}>
      {children}
    </div>
  )
}

export function StatTile({
  label,
  value,
  hint,
  accent = 'text-slate-900',
}: {
  label: string
  value: ReactNode
  hint?: string
  accent?: string
}) {
  return (
    <Card className="px-5 py-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${accent}`}>{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-slate-500">{hint}</p> : null}
    </Card>
  )
}

export function ProgressBar({
  value,
  max,
  tone = 'bg-indigo-500',
  label,
}: {
  value: number
  max: number
  tone?: string
  label?: string
}) {
  const safeMax = max > 0 ? max : 1
  const clamped = Math.min(Math.max(value, 0), safeMax)
  const width = `${(clamped / safeMax) * 100}%`

  return (
    <div
      className="h-2 w-full overflow-hidden rounded-full bg-slate-200"
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={safeMax}
      aria-label={label}
    >
      <div className={`h-full rounded-full transition-all duration-500 ${tone}`} style={{ width }} />
    </div>
  )
}

export function Badge({ children, tone = 'slate' }: { children: ReactNode; tone?: 'slate' | 'indigo' | 'emerald' | 'green' | 'amber' | 'rose' }) {
  const tones = {
    slate: 'bg-slate-100 text-slate-600',
    indigo: 'bg-indigo-50 text-indigo-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    // Deeper than emerald on purpose: the top band has to look like more than the one below it.
    green: 'bg-green-100 text-green-800',
    amber: 'bg-amber-50 text-amber-700',
    rose: 'bg-rose-50 text-rose-700',
  }
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${tones[tone]}`}>
      {children}
    </span>
  )
}

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-10 text-slate-500">
      <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z" />
      </svg>
      <span className="text-sm">{label}</span>
    </div>
  )
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 px-6 py-10 text-center">
      <p className="font-semibold text-slate-700">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">{body}</p>
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  )
}
