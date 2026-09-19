/**
 * A quiet marker that this is not finished software.
 *
 * Fixed to the bottom corner so it does not move with the page or take part in any layout, and
 * `pointer-events-none` so it can never intercept a click meant for something underneath it.
 * Muted rather than coloured: it should be findable when looked for and ignorable otherwise.
 */
export function PrototypeBadge() {
  return (
    <p
      title="An early prototype. Content and behaviour are still changing."
      className="pointer-events-none fixed bottom-3 right-3 z-20 text-[11px] font-medium uppercase tracking-wide text-slate-400/80"
    >
      Prototype
    </p>
  )
}
