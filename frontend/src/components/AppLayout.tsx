import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { initials } from '../lib/format'
import { PrototypeBadge } from './PrototypeBadge'
import { Button } from './ui'

function navLinkClass({ isActive }: { isActive: boolean }): string {
  return [
    'rounded-lg px-3 py-2 text-sm font-medium transition',
    isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
  ].join(' ')
}

/**
 * The app chrome, which changes shape between the two halves of the product.
 *
 * On the practice side it shows the student things: where to practise, your profile, your points
 * and streak. Inside the question bank it shows the authoring things instead, and drops the
 * gamification — a teacher editing questions does not need to be told their streak is zero, and
 * `★ 0` next to an authoring tool reads as noise.
 *
 * Practice stays off the teacher's navigation entirely, and the question bank never shows on the
 * student side: the two sets of links are disjoint on purpose, and switching halves means signing
 * in through the other door. The mark in the corner follows suit, going to the question bank while
 * you are inside it, and a standing banner says which half you are in rather than leaving a teacher
 * to infer it from a link being absent.
 */
export function AppLayout() {
  const { profile, logout } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()

  const inAdmin = pathname.startsWith('/admin')

  const handleSignOut = () => {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-slate-200/70 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3 sm:px-6">
          {/* The mark stands alone while the product has no name, so the link needs an
              accessible name of its own rather than announcing the sigma. */}
          <Link
            to={inAdmin ? '/admin/questions' : '/'}
            aria-label="Home"
            title="Home"
            className="grid h-8 w-8 place-items-center rounded-xl bg-indigo-600 text-white shadow-sm shadow-indigo-600/30"
          >
            <span aria-hidden="true">∑</span>
          </Link>

          <nav className="ml-2 flex items-center gap-1">
            {inAdmin ? (
              // The question bank's own navigation lives here rather than on each page, so there
              // is one place to look and the pages do not repeat it.
              <>
                <NavLink to="/admin/questions" className={navLinkClass}>
                  Questions
                </NavLink>
                <NavLink to="/admin/topics" className={navLinkClass}>
                  Topics
                </NavLink>
              </>
            ) : (
              <>
                <NavLink to="/" end className={navLinkClass}>
                  Practice
                </NavLink>
                <NavLink to="/profile" className={navLinkClass}>
                  Profile
                </NavLink>
              </>
            )}
          </nav>

          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            {profile ? (
              <>
                {/* Points and streak are the student side of the product, so they step aside for
                    the authoring tools. The teacher still sees them on the home page. */}
                {!inAdmin ? (
                  <>
                    <span
                      className="hidden items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-sm font-semibold text-amber-700 sm:inline-flex"
                      title="Points earned"
                    >
                      <span aria-hidden="true">★</span>
                      <span className="tabular-nums">{profile.user.points}</span>
                    </span>
                    <span
                      className="hidden items-center gap-1.5 rounded-full bg-orange-50 px-3 py-1.5 text-sm font-semibold text-orange-700 sm:inline-flex"
                      title="Weeks practised in a row"
                    >
                      <span aria-hidden="true">🔥</span>
                      <span className="tabular-nums">{profile.user.streakWeeks}</span>
                      <span className="font-normal">
                        {profile.user.streakWeeks === 1 ? 'week' : 'weeks'}
                      </span>
                    </span>
                  </>
                ) : null}
                <Link
                  to="/profile"
                  className="grid h-9 w-9 place-items-center rounded-full bg-slate-900 text-xs font-bold text-white"
                  title={profile.user.displayName}
                >
                  {initials(profile.user.displayName)}
                </Link>
                <Button variant="ghost" size="sm" onClick={handleSignOut}>
                  Sign out
                </Button>
              </>
            ) : null}
          </div>
        </div>

        {/* A standing reminder of which half of the product you are in. The navigation differs
            already, but a teacher should not have to infer that from a link being absent. */}
        {inAdmin ? (
          <div className="border-t border-amber-200 bg-amber-50">
            <div className="mx-auto max-w-5xl px-4 py-1.5 sm:px-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">
                Teacher mode
              </p>
            </div>
          </div>
        ) : null}
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
        <Outlet />
      </main>

      <footer className="mx-auto max-w-5xl px-4 pb-10 pt-4 text-center text-xs text-slate-400 sm:px-6">
        <p>Questions are a starter set</p>
      </footer>

      {/* Rendered here and in the sign-in shell, so it is present whether or not anyone is signed
          in. The footer used to say "prototype" as well; the badge is the one place for it now. */}
      <PrototypeBadge />
    </div>
  )
}
