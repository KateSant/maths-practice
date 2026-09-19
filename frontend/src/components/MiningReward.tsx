import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

/**
 * A small reward at the end of a quiz: a patch of ground you can walk a character around,
 * with one ore block per correct answer to find and mine by stepping on it.
 *
 * Deliberately self-contained. It carries its own blocky styling rather than relying on a
 * global theme, so the rest of the app looks exactly as it did - an earlier attempt at
 * theming the whole product was scrapped, and this keeps the fun bit without that cost.
 *
 * Movement is one tile per keypress rather than a continuous game loop: it is far less to get
 * wrong, it is naturally discrete so the collection logic is trivial, and stepping between
 * blocks is legible at this size. A CSS transition makes the steps read as movement.
 */

const COLS = 12
const ROWS = 6
const TILE = 34

const GRASS = 0
const STONE = 1
const ORE = 2

const COLOURS = {
  grassTop: '#7cbb56',
  grassSide: '#866043',
  stone: '#8a8a8a',
  stoneDark: '#7a7a7a',
  gold: '#f8c627',
  diamond: '#4aedd9',
}

const KEYS: Record<string, { x: number; y: number }> = {
  arrowup: { x: 0, y: -1 },
  w: { x: 0, y: -1 },
  arrowdown: { x: 0, y: 1 },
  s: { x: 0, y: 1 },
  arrowleft: { x: -1, y: 0 },
  a: { x: -1, y: 0 },
  arrowright: { x: 1, y: 0 },
  d: { x: 1, y: 0 },
}

/** Small deterministic generator, so a layout is stable across re-renders but varies by score. */
function seededRandom(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 0x100000000
  }
}

/** Tiles reachable from a position, walking only over non-stone tiles. */
function reachableFrom(tiles: number[], start: { x: number; y: number }): Set<number> {
  const startIndex = start.y * COLS + start.x
  const seen = new Set<number>([startIndex])
  const queue: number[] = [startIndex]

  while (queue.length > 0) {
    const index = queue.shift()
    if (index === undefined) break
    const x = index % COLS
    const y = Math.floor(index / COLS)

    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + (dx ?? 0)
      const ny = y + (dy ?? 0)
      if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) continue
      const neighbour = ny * COLS + nx
      if (seen.has(neighbour) || tiles[neighbour] === STONE) continue
      seen.add(neighbour)
      queue.push(neighbour)
    }
  }

  return seen
}

interface Layout {
  tiles: number[]
  start: { x: number; y: number }
  oreCount: number
}

function buildLayout(oreWanted: number): Layout {
  const tiles = new Array<number>(COLS * ROWS).fill(GRASS)
  const random = seededRandom(oreWanted * 7919 + 13)

  // A stone border, so the world has edges and the character cannot walk out of it.
  for (let x = 0; x < COLS; x++) {
    tiles[x] = STONE
    tiles[(ROWS - 1) * COLS + x] = STONE
  }
  for (let y = 0; y < ROWS; y++) {
    tiles[y * COLS] = STONE
    tiles[y * COLS + COLS - 1] = STONE
  }

  const start = { x: 1, y: 1 }
  const inner: number[] = []
  for (let y = 1; y < ROWS - 1; y++) {
    for (let x = 1; x < COLS - 1; x++) {
      if (x === start.x && y === start.y) continue
      inner.push(y * COLS + x)
    }
  }

  // A few stone obstacles first, then the ores, so the patch is not a bare field.
  const shuffled = inner
    .map((index) => ({ index, order: random() }))
    .sort((a, b) => a.order - b.order)
    .map((entry) => entry.index)

  const obstacles = Math.min(5, Math.max(0, Math.floor(shuffled.length / 8)))
  for (const index of shuffled.slice(0, obstacles)) {
    tiles[index] = STONE
  }

  // Ore goes only where the character can actually walk to. Placing it on any free tile
  // allowed an ore to end up walled in by obstacles, which made the patch impossible to
  // finish - a reward that cannot be completed, and a bug that only shows up on the unlucky
  // layouts. Flood filling first makes every ore reachable by construction.
  const reachable = reachableFrom(tiles, start)
  const oreTiles = shuffled
    .slice(obstacles)
    .filter((index) => reachable.has(index))

  const oreCount = Math.min(Math.max(oreWanted, 1), oreTiles.length)
  for (const index of oreTiles.slice(0, oreCount)) {
    tiles[index] = ORE
  }

  return { tiles, start, oreCount }
}

function tileBackground(tile: number, oreColour: string): React.CSSProperties {
  if (tile === ORE) {
    return {
      backgroundColor: COLOURS.stone,
      // Two speckles, which is enough to read as ore at this size without an image per tile.
      backgroundImage:
        `radial-gradient(circle at 28% 32%, ${oreColour} 13%, transparent 14%),` +
        `radial-gradient(circle at 68% 66%, ${oreColour} 13%, transparent 14%)`,
    }
  }
  if (tile === STONE) {
    return { backgroundColor: COLOURS.stone }
  }
  // Grass: a green cap over dirt, which is the most recognisable block there is.
  return {
    backgroundImage: `linear-gradient(to bottom, ${COLOURS.grassTop} 0 30%, ${COLOURS.grassSide} 30% 100%)`,
  }
}

/** A compact blocky character, drawn on the same grid style as the blocks. */
function Character({ size }: { size: number }) {
  return (
    <svg viewBox="0 0 16 32" width={size} height={size * 2} shapeRendering="crispEdges" aria-hidden="true">
      <rect x={4} y={0} width={8} height={8} fill="#c98d5c" />
      <rect x={4} y={0} width={8} height={2} fill="#3a2a1c" />
      <rect x={5} y={4} width={2} height={1} fill="#f2f2f2" />
      <rect x={9} y={4} width={2} height={1} fill="#f2f2f2" />
      <rect x={6} y={4} width={1} height={1} fill="#2b2823" />
      <rect x={10} y={4} width={1} height={1} fill="#2b2823" />
      <rect x={6} y={6} width={4} height={1} fill="#2b2823" />
      <rect x={0} y={8} width={4} height={12} fill="#c98d5c" />
      <rect x={12} y={8} width={4} height={12} fill="#c98d5c" />
      <rect x={4} y={8} width={8} height={12} fill="#4a7ab5" />
      <rect x={4} y={20} width={4} height={12} fill="#3b4a63" />
      <rect x={8} y={20} width={4} height={12} fill="#3b4a63" />
    </svg>
  )
}

export function MiningReward({ correctCount, questionCount }: { correctCount: number; questionCount: number }) {
  const layout = useMemo(() => buildLayout(correctCount), [correctCount])
  const [position, setPosition] = useState(layout.start)
  const [mined, setMined] = useState<ReadonlySet<number>>(new Set())
  const panelRef = useRef<HTMLDivElement>(null)

  const perfect = questionCount > 0 && correctCount === questionCount
  const oreColour = perfect ? COLOURS.diamond : COLOURS.gold

  // Reset when the score changes, e.g. moving between two results pages.
  useEffect(() => {
    setPosition(layout.start)
    setMined(new Set())
    // Focus without scrolling, so the keys work immediately but landing on the results page
    // does not jump the viewport down to the patch.
    panelRef.current?.focus({ preventScroll: true })
  }, [layout])

  const move = useCallback(
    (delta: { x: number; y: number }) => {
      // Computed outside a setState updater on purpose: collecting an ore is a second state
      // change, and updaters must stay pure - React may invoke them more than once.
      const next = { x: position.x + delta.x, y: position.y + delta.y }
      if (next.x < 0 || next.y < 0 || next.x >= COLS || next.y >= ROWS) return

      const index = next.y * COLS + next.x
      if (layout.tiles[index] === STONE) return

      setPosition(next)
      if (layout.tiles[index] === ORE) {
        setMined((previous) => (previous.has(index) ? previous : new Set(previous).add(index)))
      }
    },
    [position, layout],
  )

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const delta = KEYS[event.key.toLowerCase()]
    if (!delta) return
    // Arrow keys scroll the page otherwise, which makes the patch unusable.
    event.preventDefault()
    move(delta)
  }

  const allMined = mined.size >= layout.oreCount

  return (
    <div className="rounded-2xl bg-white/90 p-5 shadow-sm ring-1 ring-slate-200/70">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-semibold text-slate-900">Your dig</h2>
        <p className="text-sm text-slate-500">
          {mined.size} of {layout.oreCount} {perfect ? 'diamond' : 'gold'} mined
        </p>
      </div>

      <p className="mt-1 text-xs text-slate-500">
        Walk with <kbd className="rounded bg-slate-100 px-1">WASD</kbd> or the arrow keys. Step
        on an ore block to mine it.
      </p>

      <div
        ref={panelRef}
        tabIndex={0}
        data-testid="dig-patch"
        onKeyDown={handleKeyDown}
        aria-label="Walk with WASD or the arrow keys to mine ore"
        className="relative mx-auto mt-4 overflow-hidden rounded-lg outline-none ring-1 ring-slate-300 focus:ring-2 focus:ring-indigo-500"
        style={{ width: COLS * TILE, maxWidth: '100%' }}
      >
        <div
          className="grid"
          style={{ gridTemplateColumns: `repeat(${COLS}, ${TILE}px)`, gridAutoRows: `${TILE}px` }}
        >
          {layout.tiles.map((tile, index) => {
            const isMined = tile === ORE && mined.has(index)
            return (
              <div
                key={index}
                style={{
                  ...(isMined ? { backgroundColor: COLOURS.stoneDark } : tileBackground(tile, oreColour)),
                  boxShadow:
                    'inset -2px -2px 0 rgba(0,0,0,0.16), inset 2px 2px 0 rgba(255,255,255,0.16)',
                }}
              />
            )
          })}
        </div>

        {/* Two tiles tall with its feet on the current tile, as the character is in the game. */}
        <div
          className="pointer-events-none absolute"
          data-testid="miner"
          style={{
            left: position.x * TILE,
            top: (position.y - 1) * TILE,
            transition: 'left 120ms linear, top 120ms linear',
          }}
        >
          <Character size={TILE} />
        </div>
      </div>

      {allMined ? (
        <p className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
          All mined. {perfect ? 'Flawless — diamond grade.' : 'Nice digging.'}
        </p>
      ) : null}
    </div>
  )
}
