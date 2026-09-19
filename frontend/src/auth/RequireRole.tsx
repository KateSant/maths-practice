import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { Spinner } from '../components/ui'

/**
 * Gate for the admin screens.
 *
 * Cosmetic, like every client-side check: the API refuses `/api/admin/**` without the ADMIN role,
 * so this only decides whether to render a page that would otherwise fill with errors. It is a
 * separate component from RequireAuth because the two answer different questions — "are you
 * signed in" and "are you allowed" — and they nest, with RequireAuth outside.
 */
export function RequireRole({ role, children }: { role: string; children: ReactNode }) {
  const { profile, restoring } = useAuth()
  const location = useLocation()

  // Wait for the stored session to be checked, or a refresh would bounce an admin to the home
  // page for a frame before the profile arrives.
  if (restoring) {
    return <Spinner label="Checking your access…" />
  }

  if (!profile) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />
  }

  if (profile.user.role !== role) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
