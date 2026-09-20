import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { MiningReward } from '../components/MiningReward'

/**
 * Development-only page showing the mining reward on its own, with no session and no auth,
 * so the game can be looked at and fiddled with directly.
 *
 * Reached at /dev/dig while running `npm run dev`; the route is not registered in a
 * production build. The buttons choose the score fed into the component - 5 of 5 draws the
 * diamond ore, anything less draws gold, and 0 gives the single-ore patch. The reward carries
 * its own full-screen button, which is worth exercising here as well as on a results page.
 *
 * Untimed on purpose: there is no signed-in account here to bill play time against. The live
 * countdown and the out-of-time overlay only appear on a real results page.
 */

const SCORES = [0, 1, 2, 3, 4, 5]

/** `?score=5&questions=5` picks the score on load, so a material tier can be linked to directly. */
function fromQuery(params: URLSearchParams, key: string, fallback: number, max: number): number {
  const parsed = Number(params.get(key))
  if (!Number.isFinite(parsed)) return fallback
  return Math.max(0, Math.min(Math.floor(parsed), max))
}

export function DevDigPage() {
  const [params] = useSearchParams()
  const questions = Math.max(1, fromQuery(params, 'questions', 5, 50))
  const [correct, setCorrect] = useState(() => fromQuery(params, 'score', 3, questions))
  // Bumping this remounts the reward so the patch resets to its starting position, which is
  // otherwise only possible by changing the score.
  const [resetKey, setResetKey] = useState(0)
  const scores = questions <= 5 ? SCORES : Array.from({ length: 6 }, (_, i) => Math.round((i * questions) / 5))

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-10">
      <div className="mx-auto max-w-4xl space-y-4">
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/70">
          <h1 className="font-semibold text-slate-900">Mining reward — preview</h1>
          <p className="mt-1 text-xs text-slate-500">
            Dev only. Pick a score to see the level it produces — the material follows the score:
            coal, iron, gold, then diamond for a clean sweep. Add <code>?score=5&amp;questions=5</code>{' '}
            to the URL to link straight to one.
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {scores.map((score) => (
              <button
                key={score}
                type="button"
                onClick={() => setCorrect(score)}
                aria-pressed={score === correct}
                className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
                  score === correct
                    ? 'border-indigo-400 bg-indigo-50 text-indigo-700 ring-2 ring-indigo-500/20'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-300 hover:bg-indigo-50/40'
                }`}
              >
                {score}/{questions}
                {score === questions ? ' ★' : ''}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setResetKey((current) => current + 1)}
              className="ml-auto rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-500 hover:border-slate-300 hover:text-slate-700"
            >
              Reset patch
            </button>
          </div>
        </div>

        <MiningReward key={`${correct}-${questions}-${resetKey}`} correctCount={correct} questionCount={questions} />
      </div>
    </div>
  )
}
