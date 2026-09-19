import { useTheme, type Theme } from '../theme/ThemeContext'

const OPTIONS: Array<{ value: Theme; label: string }> = [
  { value: 'vanilla', label: 'Vanilla' },
  { value: 'minecraft', label: 'Minecraft' },
]

/**
 * Theme picker.
 *
 * Both options are shown and the active one is highlighted, rather than a single button
 * naming the current theme. A lone button reading "Minecraft" says what the theme *is* but
 * not that pressing it changes anything - it reads as a label, not a control. Showing the
 * alternatives, next to the word "Theme", makes the choice obvious without a tooltip.
 *
 * Not a native <select>: a two-option segmented control is clearer for two options, and it
 * matches the question-count picker elsewhere in the app.
 */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  return (
    <div
      className="flex items-center gap-1 rounded-xl bg-slate-100 p-1"
      role="group"
      aria-label="Theme"
    >
      <span className="px-1.5 text-xs font-semibold text-slate-500">Theme</span>
      {OPTIONS.map((option) => {
        const active = theme === option.value
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => setTheme(option.value)}
            aria-pressed={active}
            className={`font-display rounded-xl px-2 py-1 text-[11px] font-semibold transition ${
              active ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
