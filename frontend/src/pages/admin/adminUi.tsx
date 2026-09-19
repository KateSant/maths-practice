import { Link } from 'react-router-dom'
import type { QuestionOrigin, QuestionStatus } from '../../api/admin'
import { Badge } from '../../components/ui'
import { difficultyLabel } from '../../lib/format'

/**
 * Shared status and origin display for the admin screens.
 *
 * Status colours are deliberately distinguishable without relying on hue alone — the label is
 * always present — for the same reason the quiz marks answers with a tick as well as a colour.
 */
export function StatusBadge({ status }: { status: QuestionStatus }) {
  const tone = status === 'PUBLISHED' ? 'emerald' : status === 'DRAFT' ? 'amber' : 'slate'
  const label = status === 'PUBLISHED' ? 'Published' : status === 'DRAFT' ? 'Draft' : 'Retired'
  return <Badge tone={tone}>{label}</Badge>
}

/**
 * Only shown when it is not AUTHORED, to keep the common case quiet. Its job is to make the
 * prototype's 32 questions identifiable at a glance.
 */
export function OriginBadge({ origin }: { origin: QuestionOrigin }) {
  if (origin === 'AUTHORED') return null
  const label = origin === 'SEED' ? 'Starter set' : 'Imported'
  return <Badge tone="slate">{label}</Badge>
}

/** Difficulty as a plain label, matching how the quiz shows it now the theme has gone. */
export function DifficultyBadge({ difficulty }: { difficulty: number }) {
  return <Badge tone="indigo">{difficultyLabel(difficulty)}</Badge>
}

export function AdminHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  )
}

export function AdminNav() {
  return (
    <nav className="flex gap-2 text-sm">
      <Link to="/admin/questions" className="text-slate-500 hover:text-slate-800">
        Questions
      </Link>
      <span className="text-slate-300">·</span>
      <Link to="/admin/topics" className="text-slate-500 hover:text-slate-800">
        Topics
      </Link>
    </nav>
  )
}
