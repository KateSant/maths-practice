import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { api, setUnauthorizedHandler } from '../api/client'
import type { Profile } from '../api/types'
import { clearToken, readToken, writeToken } from './session'

interface AuthContextValue {
  profile: Profile | null
  /** True only while the stored session is being restored on first load. */
  restoring: boolean
  signInWithGoogle: (idToken: string) => Promise<void>
  continueAsGuest: () => Promise<void>
  logout: () => void
  refresh: () => Promise<void>}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [restoring, setRestoring] = useState(true)

  const logout = useCallback(() => {
    clearToken()
    setProfile(null)
  }, [])

  // A 401 from any request anywhere means the token is gone or expired, so drop
  // straight back to the signed-out state rather than leaving stale UI on screen.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      clearToken()
      setProfile(null)
    })
    return () => setUnauthorizedHandler(null)
  }, [])

  const refresh = useCallback(async () => {
    if (!readToken()) {
      setProfile(null)
      return
    }
    try {
      setProfile(await api.profile())
    } catch {
      clearToken()
      setProfile(null)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        if (readToken()) {
          const loaded = await api.profile()
          if (!cancelled) setProfile(loaded)
        }
      } catch {
        clearToken()
      } finally {
        if (!cancelled) setRestoring(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  /**
   * `idToken` is the Google credential, passed straight through and never stored.
   * What we persist is our own JWT, exactly as before, so nothing downstream of here
   * knows Google was involved.
   */
  const signInWithGoogle = useCallback(async (idToken: string) => {
    const auth = await api.signInWithGoogle(idToken)
    writeToken(auth.token)
    // Fetch the profile so stats come along too, rather than synthesising a stub.
    setProfile(await api.profile())
  }, [])

  const continueAsGuest = useCallback(async () => {
    const auth = await api.continueAsGuest()
    writeToken(auth.token)
    setProfile(await api.profile())
  }, [])

  const value = useMemo(
    () => ({ profile, restoring, signInWithGoogle, continueAsGuest, logout, refresh }),
    [profile, restoring, signInWithGoogle, continueAsGuest, logout, refresh],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used inside an AuthProvider')
  }
  return context
}
