/**
 * Token persistence. Wrapped in try/catch because localStorage throws in some
 * privacy modes, and a prototype should degrade to "logged out" rather than crash.
 */
const TOKEN_KEY = 'realmaths.token'

export function readToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function writeToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token)
  } catch {
    // Non-fatal: the user stays logged in for this tab only.
  }
}

export function clearToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY)
  } catch {
    // Nothing useful to do.
  }
}
