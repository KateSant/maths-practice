import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

export type Theme = 'vanilla' | 'minecraft'

const STORAGE_KEY = 'realmaths.theme'

/**
 * Read once at module load so the first render already agrees with the inline script in
 * index.html. If these two disagreed, the page would paint one theme and then swap.
 */
function readStoredTheme(): Theme {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'minecraft' ? 'minecraft' : 'vanilla'
  } catch {
    return 'vanilla'
  }
}

interface ThemeContextValue {
  theme: Theme
  isMinecraft: boolean
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(readStoredTheme)

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'minecraft') {
      root.dataset.theme = 'minecraft'
    } else {
      // Removing the attribute rather than setting it to "vanilla" keeps the selector
      // in CSS as a single override of the defaults, so the default theme needs no rules.
      delete root.dataset.theme
    }
    try {
      localStorage.setItem(STORAGE_KEY, theme)
    } catch {
      // Non-fatal: the theme just will not persist.
    }
  }, [theme])

  const value = useMemo(() => ({ theme, isMinecraft: theme === 'minecraft', setTheme }), [theme])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used inside a ThemeProvider')
  }
  return context
}
