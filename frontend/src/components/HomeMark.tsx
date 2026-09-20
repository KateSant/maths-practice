import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { APP_FULL_NAME, APP_MARK } from '../lib/branding'

/**
 * The monogram, top left, on every screen.
 *
 * It is the way back to wherever "home" is for whoever is looking: the sign-in page for a visitor,
 * and the app for anyone signed in. One component rather than a mark drawn by each layout, because
 * what the mark does depends on who is looking rather than on which screen is showing it - and a
 * mark that goes somewhere different on each screen is a mark nobody can learn.
 *
 * The `M` is the whole mark: a monogram needs no glyph beside it, and it wears the same blue as
 * every button in the app, so the brand and the interface are one colour.
 *
 * `to` is for the one case the rule cannot see. Inside the question bank a teacher's home is the
 * bank, not the practice screens, so the caller overrides the destination there.
 */
export function HomeMark({ to }: { to?: string }) {
  const { profile } = useAuth()
  const signedIn = Boolean(profile)

  return (
    <Link
      to={to ?? (signedIn ? '/' : '/login')}
      aria-label={signedIn ? `${APP_FULL_NAME} home` : `${APP_FULL_NAME} - sign in`}
      title={APP_FULL_NAME}
      className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-indigo-600 text-sm font-bold text-white shadow-sm shadow-indigo-600/30"
    >
      {APP_MARK}
    </Link>
  )
}
