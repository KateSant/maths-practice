import { useState, type MouseEvent } from 'react'
import { Badge, Button, Card } from '../components/ui'
import {
  GRID,
  POINTS_REQUIRED,
  SAMPLE_ITEM,
  clipLine,
  formatLine,
  isCorrect,
  lineThrough,
  parsePoints,
  readMistake,
  withPointToggled,
  type Point,
} from '../lib/plotItem'

/**
 * A mockup of a drawn answer, on a page with no sign-in and no session.
 *
 * It exists to be looked at, not to be used: the item is not in the question bank, nothing is
 * saved, and there is no marking server involved. The grading rule is the real shape of the idea
 * though — see `lib/plotItem.ts` — and the line is drawn under the points only after the answer is
 * committed, which is where a server-side key would put it.
 *
 * Reached at /dev/plot while running `npm run dev`; the route is not registered in a production
 * build.
 *
 * The grid is snapped to whole numbers. That is a deliberate limit rather than a shortcut: it makes
 * the answer exact, it makes grading a comparison rather than a tolerance judgement, and it lets the
 * same item be answered by typing coordinates, which is the keyboard path the drawing itself has no
 * way to offer.
 */

const SIZE = 440
const PAD = 26
const STEP = (SIZE - PAD * 2) / (GRID.max - GRID.min)
const TICKS = Array.from({ length: GRID.max - GRID.min + 1 }, (_, index) => GRID.min + index)

const px = (x: number) => PAD + (x - GRID.min) * STEP
const py = (y: number) => SIZE - PAD - (y - GRID.min) * STEP

export function DevPlotPage() {
  const [points, setPoints] = useState<Point[]>([])
  const [submitted, setSubmitted] = useState(false)
  const [typed, setTyped] = useState('')
  const [typedError, setTypedError] = useState<string | null>(null)

  const correct = isCorrect(SAMPLE_ITEM, points)
  const reading = submitted && !correct ? readMistake(SAMPLE_ITEM, points) : null

  const target = clipLine(SAMPLE_ITEM, GRID.min, GRID.max)
  const ownLine = submitted && !correct ? lineThrough(points) : null
  const ownSegment = ownLine ? clipLine(ownLine, GRID.min, GRID.max) : null

  // What the request body would be. Shown because "what does a drawing reduce to" is the whole
  // design question, and here it is: a type and three pairs of integers. No SVG, no pixels.
  const payload = JSON.stringify({ type: 'POINT_SET', points: points.map((point) => [point.x, point.y]) })

  const dotClass = !submitted ? 'fill-indigo-600' : correct ? 'fill-emerald-500' : 'fill-rose-500'

  /**
   * Taps land on the nearest intersection rather than where the finger went, so a point is always a
   * point and never 3.2 pixels off one. `getBoundingClientRect` is in screen pixels while the viewBox
   * is in grid pixels, hence the division.
   */
  function handleGridClick(event: MouseEvent<SVGSVGElement>) {
    if (submitted) return
    const rect = event.currentTarget.getBoundingClientRect()
    const x = ((event.clientX - rect.left) / rect.width) * SIZE
    const y = ((event.clientY - rect.top) / rect.height) * SIZE
    const gridX = Math.round(GRID.min + (x - PAD) / STEP)
    const gridY = Math.round(GRID.min + (SIZE - PAD - y) / STEP)
    if (gridX < GRID.min || gridX > GRID.max || gridY < GRID.min || gridY > GRID.max) return
    setPoints((current) => withPointToggled(current, { x: gridX, y: gridY }))
  }

  function placeTypedPoints() {
    const parsed = parsePoints(typed)
    if (!parsed) {
      setTypedError(`Write up to ${POINTS_REQUIRED} whole-number coordinates between ${GRID.min} and ${GRID.max}, like (0,-1) (2,3).`)
      return
    }
    setTypedError(null)
    setPoints(parsed.slice(0, POINTS_REQUIRED))
  }

  function reset() {
    setPoints([])
    setSubmitted(false)
    setTyped('')
    setTypedError(null)
  }

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-10">
      <div className="mx-auto max-w-2xl space-y-4">
        <Card className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="font-semibold text-slate-900">Plot three points — preview</h1>
              <p className="mt-1 text-xs text-slate-500">
                Dev only, and a mockup: nothing is saved and no server is asked. A drawn answer to an
                item that would otherwise be a multiple choice.
              </p>
            </div>
            <Badge tone="indigo">mockup</Badge>
          </div>

          <div className="mt-5 flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-slate-800">{SAMPLE_ITEM.prompt}</p>
            <span className="shrink-0 text-xs tabular-nums text-slate-500">
              {points.length}/{POINTS_REQUIRED} plotted
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-500">Plot three points that lie on the line.</p>

          <svg
            viewBox={`0 0 ${SIZE} ${SIZE}`}
            className="mt-4 w-full max-w-[440px] touch-manipulation select-none rounded-xl bg-white ring-1 ring-slate-200"
            role="img"
            aria-label="Coordinate grid from −5 to 5. Tap an intersection to plot a point."
            onClick={handleGridClick}
          >
            {TICKS.map((value) => (
              <line
                key={`v${value}`}
                x1={px(value)}
                y1={PAD}
                x2={px(value)}
                y2={SIZE - PAD}
                strokeWidth={1}
                className={value === 0 ? 'stroke-slate-400' : 'stroke-slate-200'}
              />
            ))}
            {TICKS.map((value) => (
              <line
                key={`h${value}`}
                x1={PAD}
                y1={py(value)}
                x2={SIZE - PAD}
                y2={py(value)}
                strokeWidth={1}
                className={value === 0 ? 'stroke-slate-400' : 'stroke-slate-200'}
              />
            ))}

            {TICKS.filter((value) => value !== 0).map((value) => (
              <g key={`label${value}`} className="fill-slate-400 text-[9px]">
                <text x={px(value)} y={py(0) + 14} textAnchor="middle">
                  {value}
                </text>
                <text x={px(0) - 7} y={py(value) + 3} textAnchor="end">
                  {value}
                </text>
              </g>
            ))}

            {/* The reveal. Drawn only once the answer is committed, in the place a server-side key
                would be allowed to arrive. */}
            {submitted && target ? (
              <line
                x1={px(target.a.x)}
                y1={py(target.a.y)}
                x2={px(target.b.x)}
                y2={py(target.b.y)}
                strokeWidth={2.5}
                strokeDasharray="7 5"
                className="stroke-emerald-500"
              />
            ) : null}

            {/* The student's own line, drawn behind their points when it is one: the two lines
                sitting on the same grid is the whole feedback. */}
            {ownSegment ? (
              <line
                x1={px(ownSegment.a.x)}
                y1={py(ownSegment.a.y)}
                x2={px(ownSegment.b.x)}
                y2={py(ownSegment.b.y)}
                strokeWidth={2}
                strokeDasharray="2 4"
                className="stroke-rose-400"
              />
            ) : null}

            {points.map((point) => (
              <circle
                key={`${point.x},${point.y}`}
                cx={px(point.x)}
                cy={py(point.y)}
                r={6}
                strokeWidth={2}
                className={`${dotClass} stroke-white`}
              />
            ))}
          </svg>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button onClick={() => setSubmitted(true)} disabled={submitted || points.length === 0}>
              Check my answer
            </Button>
            <Button variant="secondary" onClick={reset}>
              {submitted ? 'Try another' : 'Clear'}
            </Button>
            {submitted ? null : (
              <span className="text-xs text-slate-500">Tap a point again to remove it.</span>
            )}
          </div>

          <div className="mt-4 border-t border-slate-100 pt-4">
            <label className="text-xs font-medium text-slate-600" htmlFor="typed-points">
              Or type them — the grid snaps to whole numbers, so tapping is not the only way in.
            </label>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <input
                id="typed-points"
                value={typed}
                onChange={(event) => setTyped(event.target.value)}
                placeholder="(0,-1) (2,3) (3,5)"
                className="min-w-[12rem] flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20"
              />
              <Button variant="secondary" size="sm" onClick={placeTypedPoints}>
                Place
              </Button>
            </div>
            {typedError ? <p className="mt-2 text-xs text-rose-600">{typedError}</p> : null}
          </div>
        </Card>

        {submitted ? (
          <Card className="p-5">
            <div className="flex items-center gap-3">
              {correct ? <Badge tone="emerald">all three on the line</Badge> : <Badge tone="rose">not there yet</Badge>}
              <p className="text-sm text-slate-600">
                The target line is {formatLine(SAMPLE_ITEM)}, dashed in green on the grid.
              </p>
            </div>

            <p className="mt-3 text-sm text-slate-700">{SAMPLE_ITEM.explanation}</p>

            {reading ? (
              <div className="mt-4 rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200/70">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    What the drawing says
                  </span>
                  <code className="rounded bg-white px-1.5 py-0.5 text-[11px] text-indigo-700 ring-1 ring-indigo-100">
                    {reading.code}
                  </code>
                </div>
                <p className="mt-1.5 text-sm text-slate-600">{reading.note}</p>
                <p className="mt-2 text-xs text-slate-400">
                  A heuristic over three points in this mockup. In the real thing it runs beside the
                  grading rule, on the server, because it needs the line the student was not sent.
                </p>
              </div>
            ) : null}
          </Card>
        ) : null}

        <Card className="p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            What would be submitted
          </p>
          <code className="mt-2 block overflow-x-auto rounded-xl bg-slate-900 px-3 py-2 text-xs text-slate-100">
            {payload}
          </code>
          <p className="mt-2 text-xs text-slate-500">
            No pixels and no SVG: a type and a handful of integers, order irrelevant, graded by asking
            whether each pair satisfies the line. The correct line is never sent to the client before
            the answer is committed.
          </p>
        </Card>
      </div>
    </div>
  )
}
