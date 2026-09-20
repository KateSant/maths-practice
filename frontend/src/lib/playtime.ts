/**
 * The client half of the play-time ledger: how the countdown is drawn, and how it is guessed at
 * between heartbeats.
 *
 * The server is the only authority on the balance - see `GameService` on the API side. Everything
 * here is presentation. It makes the number tick down smoothly between heartbeats and defers to
 * the server's answer whenever one arrives, so the countdown is never the thing that decides how
 * long a student may play.
 */

/**
 * How often the client tells the server it is still there. Must not exceed the server's
 * `realmaths.game.max-heartbeat-gap-seconds`, which caps what a single gap can cost: a longer
 * interval than that cap would have every beat clipped, and time would quietly go missing.
 */
export const HEARTBEAT_INTERVAL_MS = 10_000

/**
 * `2:40`, and `0:07` rather than `:07`, so the digits do not shift sideways as the countdown
 * shrinks. Negative values are impossible from the server but are clamped rather than shown.
 */
export function formatClock(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds))
  const minutes = Math.floor(whole / 60)
  return `${minutes}:${String(whole % 60).padStart(2, '0')}`
}

/**
 * The locally-guessed balance after `elapsedMs` with no heartbeat. Only whole elapsed seconds are
 * taken off, and the result is floored, so the countdown can only ever reach zero at or before the
 * server would say so - showing "0:00" a fraction early is not a bug worth having in the other
 * direction, where the level stays playable past the balance.
 */
export function tickClock(seconds: number, elapsedMs: number): number {
  if (!Number.isFinite(seconds)) {
    return seconds
  }
  const whole = Math.floor(seconds) - Math.floor(Math.max(0, elapsedMs) / 1000)
  return Math.max(0, whole)
}
