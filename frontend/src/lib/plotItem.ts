/**
 * The grading rule for a "plot three points on a line" item, as plain functions.
 *
 * A mockup of an answer type the app does not have yet, so nothing here is wired to the API.
 * It is written as pure functions rather than inside the component for the reason the project
 * gives about the frontend suite having no DOM: this is the logic worth asserting, and a function
 * is where it can be asserted. Nothing here touches the screen or the network.
 *
 * The interesting difference from every item the app has today is that the answer is a *rule*
 * rather than a key. A multiple-choice item is graded by comparing against stored option ids; this
 * one is graded by asking whether each plotted point satisfies y = mx + c, so there is no fixed
 * right answer to compare against and no key to send to the client. A student may legitimately plot
 * (0, −1), (1, 1), (2, 3) or (4, 7), (0, −1), (−1, −3) and be equally right.
 */

/** A point in grid coordinates, snapped to whole numbers. */
export interface Point {
  x: number
  y: number
}

export interface Line {
  gradient: number
  intercept: number
}

/**
 * One item. When this becomes real, the rule moves onto the question record on the server — the
 * client is sent the prompt and the grid's range, never the line. The mockup keeps it in the bundle
 * only because there is no server side to this yet.
 */
export interface LineItem extends Line {
  prompt: string
  explanation: string
}

/** The visible grid, in grid coordinates. Snap-to-integer is what makes the answer exact. */
export const GRID = { min: -5, max: 5 } as const

/** Three, not one: one wrong point is a slip, three coherently wrong points are a belief. */
export const POINTS_REQUIRED = 3

export const SAMPLE_ITEM: LineItem = {
  prompt: 'A straight line has gradient 2 and crosses the y-axis at −1.',
  gradient: 2,
  intercept: -1,
  explanation:
    'Gradient 2 means y rises by 2 for every 1 across. Starting from the crossing point (0, −1): ' +
    '(1, 1), (2, 3), (3, 5) — and (3, 5) is the last one that fits this grid, with (−1, −3) and ' +
    '(−2, −5) behind it. Any three of those six are on the line.',
}

const EPSILON = 1e-9

export function yOnLine(line: Line, x: number): number {
  return line.gradient * x + line.intercept
}

export function onLine(line: Line, point: Point): boolean {
  return point.y === yOnLine(line, point.x)
}

/**
 * Whether the plotted points answer the item: exactly three of them, every one on the line.
 *
 * Order does not matter and which three does not matter, so this is a predicate over the set rather
 * than a comparison with a key. Three distinct points on a straight line are three chances to be
 * wrong, which is what makes guessing useless here — the multiple-choice version of this item is a
 * one-in-four coin flip.
 */
export function isCorrect(item: LineItem, points: Point[]): boolean {
  return points.length === POINTS_REQUIRED && points.every((point) => onLine(item, point))
}

/**
 * Adds a point, or removes it if it is already there.
 *
 * Tapping a dot again takes it away, so the grid needs no separate undo. A fourth point is ignored
 * rather than accepted-and-graded-wrong: the item asks for three, and the widget should not let a
 * student build an answer the marker will refuse.
 */
export function withPointToggled(points: Point[], point: Point): Point[] {
  const existing = points.findIndex((p) => p.x === point.x && p.y === point.y)
  if (existing >= 0) return points.filter((_, index) => index !== existing)
  if (points.length >= POINTS_REQUIRED) return points
  return [...points, point]
}

/**
 * The line the points sit on, or null if they do not all sit on one.
 *
 * Null also covers the case where every point shares an x — that is a vertical line, which this
 * shape cannot express, and {@link readMistake} says so rather than pretending.
 */
export function lineThrough(points: Point[]): Line | null {
  const first = points[0]
  if (!first) return null
  const second = points.find((point) => point.x !== first.x)
  if (!second) return null

  const gradient = (second.y - first.y) / (second.x - first.x)
  const intercept = first.y - gradient * first.x
  const collinear = points.every((point) => Math.abs(point.y - yOnLine({ gradient, intercept }, point.x)) < EPSILON)
  return collinear ? { gradient, intercept } : null
}

/** True when every point shares an x, so the points describe a vertical line. */
export function isVertical(points: Point[]): boolean {
  const first = points[0]
  return !!first && points.every((point) => point.x === first.x)
}

/** "y = 2x − 1", or "y = 2x" when it goes through the origin. Uses the content's minus sign. */
export function formatLine(line: Line): string {
  const gradient =
    line.gradient === 1 ? '' : line.gradient === -1 ? '−' : formatNumber(line.gradient)
  if (line.intercept === 0) return `y = ${gradient}x`
  const sign = line.intercept < 0 ? '−' : '+'
  return `y = ${gradient}x ${sign} ${formatNumber(Math.abs(line.intercept))}`
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2)
}

/**
 * Where a line crosses the visible grid, for drawing it. Null when it misses the grid entirely.
 *
 * Both the target line and the student's own line go through here, so the reveal is drawn the same
 * way as the answer — which is the point of drawing it: their line and the right one, on one grid.
 */
export function clipLine(line: Line, min: number, max: number): { a: Point; b: Point } | null {
  const candidates: Point[] = []
  const consider = (point: Point) => {
    const inside =
      point.x >= min - EPSILON && point.x <= max + EPSILON && point.y >= min - EPSILON && point.y <= max + EPSILON
    if (inside) candidates.push(point)
  }

  consider({ x: min, y: yOnLine(line, min) })
  consider({ x: max, y: yOnLine(line, max) })
  if (line.gradient !== 0) {
    consider({ x: (min - line.intercept) / line.gradient, y: min })
    consider({ x: (max - line.intercept) / line.gradient, y: max })
  }

  const ordered = [...candidates].sort((left, right) => left.x - right.x)
  const a = ordered[0]
  const b = ordered[ordered.length - 1]
  if (!a || !b || (a.x === b.x && a.y === b.y)) return null
  return { a, b }
}

export interface Reading {
  code: string
  note: string
}

/**
 * What the student's points say they believe.
 *
 * A mockup of the diagnostic payoff, and the reason a drawn item is worth more than a tapped one:
 * a wrong drawing is not merely wrong, it is a drawing of the line the student thinks is right.
 * Reading gradient and intercept off their own points names the error, and the student authored it
 * — nobody had to write a distractor that catches it.
 *
 * A heuristic over three snapped points, not a classifier, and it only knows about this one item.
 * In the real thing this runs on the server beside the grading rule and comes back with the result,
 * because it needs the item's line and the client is not sent one.
 */
export function readMistake(item: LineItem, points: Point[]): Reading | null {
  if (points.length < POINTS_REQUIRED) {
    return { code: 'INCOMPLETE', note: `Plot ${POINTS_REQUIRED} points and the reading appears here.` }
  }

  if (isVertical(points)) {
    return {
      code: 'GRPH-HORIZONTAL',
      note: 'Your three points sit above one another, which is a vertical line. A gradient of ' +
        `${formatNumber(item.gradient)} means going across as well as up.`,
    }
  }

  const line = lineThrough(points)
  if (!line) {
    return {
      code: 'NO-SINGLE-LINE',
      note: 'Your three points do not lie on one straight line, so there is no single line to read. ' +
        'Three points on a straight line is the answer; three points that wander are not.',
    }
  }

  const sameGradient = Math.abs(line.gradient - item.gradient) < EPSILON
  const sameIntercept = Math.abs(line.intercept - item.intercept) < EPSILON
  if (sameGradient && sameIntercept) return null

  if (sameGradient) {
    return {
      code: 'GRPH-ADD-NOT-TIMES',
      note:
        `Your points lie on ${formatLine(line)} — the right gradient, the wrong crossing point. ` +
        'Multiply by 2 first, then apply the constant, rather than the other way round.',
    }
  }

  return {
    code: 'GRPH-GRADIENT',
    note:
      `Your points lie on ${formatLine(line)}, so the gradient itself is off. Gradient is how far ` +
      'up the line goes for one step across, from any point to the next.',
  }
}

/**
 * Reads points typed as coordinates, so the grid has a keyboard path.
 *
 * Snapping to whole numbers is what buys this: because the answer is integers, the same item is
 * answerable by tapping or by typing, and the marking rule does not care which happened. A freehand
 * version of this item could not be answered this way, which is a good reason to keep it snapped.
 */
export function parsePoints(raw: string): Point[] | null {
  const found = [...raw.matchAll(/\(?\s*(-?\d+)\s*,\s*(-?\d+)\s*\)?/g)]
  if (found.length === 0) return null

  const points: Point[] = []
  for (const match of found) {
    const x = Number(match[1])
    const y = Number(match[2])
    if (x < GRID.min || x > GRID.max || y < GRID.min || y > GRID.max) return null
    if (!points.some((point) => point.x === x && point.y === y)) points.push({ x, y })
  }
  return points
}
