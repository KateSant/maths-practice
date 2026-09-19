import { useTheme } from '../theme/ThemeContext'

/**
 * Switches between the default look and the Minecraft-style one.
 *
 * A real button with aria-pressed rather than a styled div, so it is reachable by keyboard
 * and announces its state. "Vanilla" is deliberately the label for the default: it is what
 * the app called it before, and it also happens to be the Minecraft term for unmodded.
 */
export function ThemeToggle() {
  const { isMinecraft, toggleTheme } = useTheme()

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-pressed={isMinecraft}
      title={isMinecraft ? 'Switch back to the standard theme' : 'Switch to the Minecraft-style theme'}
      className="font-display inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-semibold ring-1 ring-slate-200 transition hover:bg-slate-100"
    >
      <span aria-hidden="true">{isMinecraft ? '🟩' : '⬜'}</span>
      <span className="hidden sm:inline">{isMinecraft ? 'Minecraft' : 'Vanilla'}</span>
    </button>
  )
}
