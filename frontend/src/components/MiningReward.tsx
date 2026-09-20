import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import {
  AIR,
  COLS,
  DIRT,
  ENEMY_H,
  ENEMY_W,
  GRASS,
  JET_FUEL,
  MAX_BULLETS,
  ORE,
  PLAYER_H,
  PLAYER_W,
  ROWS,
  STEP,
  STONE,
  aimDirection,
  buildLevel,
  createWorld,
  materialTier,
  muzzlePosition,
  seededRandom,
  spawnPlayer,
  stepEnemies,
  stepPlayer,
  type AimPoint,
  type Held,
  type PlayerState,
  type World,
} from '../lib/platformer'
import { pluralise } from '../lib/format'
import { HEARTBEAT_INTERVAL_MS, formatClock, tickClock } from '../lib/playtime'
import { createSounds, readSoundOn, writeSoundOn } from '../lib/sound'
import { buttonClasses } from './ui'

/**
 * A small reward at the end of a quiz: a one-screen platformer. It carries one ore block per
 * correct answer, scattered over the ground and the ledges, and ore is mined by touching it - so
 * finishing a quiz hands you a level to climb through. The world, the physics and the jetpack live
 * in lib/platformer.ts and the sound effects in lib/sound.ts; this file is the pixel art, the
 * keyboard, and the render.
 *
 * Deliberately self-contained. It carries its own blocky pixel art rather than relying on a
 * global theme, so the rest of the app looks exactly as it did - an earlier attempt at theming
 * the whole product was scrapped, and this keeps the fun bit without that cost.
 *
 * The loop runs at a fixed 120Hz step off requestAnimationFrame and writes the sprite's position
 * through a ref: a React render per frame would repaint a couple of hundred tiles to move one
 * character.
 *
 * Bump the level if it ever needs to be bigger: COLS and ROWS in lib/platformer.ts set the grid,
 * and the art below is authored in pixels, so nothing here has to change with them.
 *
 * Time in the level is metered by the server. See the heartbeat effect below: the client says
 * "still here" and the server decides what that cost, so the countdown on screen is a courtesy to
 * the student rather than the thing enforcing the limit.
 */

// ---------------------------------------------------------------------------------------------
// Pixel art
// ---------------------------------------------------------------------------------------------

const TEXTURE = 16

/**
 * Turns rows of palette keys into a CSS background. Drawn as an SVG data URI rather than an image
 * file: it scales to whatever size the board is, stays crisp because every edge is axis-aligned,
 * and adds nothing to fetch.
 *
 * Consecutive pixels of one colour are merged into a single rect. A 16x16 tile is 256 cells but
 * only a few dozen runs, which keeps the data URI small enough to inline five times over.
 */
function pixelArt(rows: readonly string[], palette: Record<string, string>): React.CSSProperties {
  const rects: string[] = []
  rows.forEach((row, y) => {
    let x = 0
    while (x < row.length) {
      const colour = palette[row[x] ?? '.']
      let run = 1
      while (x + run < row.length && row[x + run] === row[x]) run += 1
      if (colour) rects.push(`<rect x="${x}" y="${y}" width="${run}" height="1" fill="${colour}"/>`)
      x += run
    }
  })

  const width = rows[0]?.length ?? 0
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${rows.length}"` +
    ` shape-rendering="crispEdges">${rects.join('')}</svg>`

  return {
    backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(svg)}")`,
    backgroundSize: '100% 100%',
    backgroundRepeat: 'no-repeat',
  }
}

/** A base colour with a scatter of darker and lighter pixels - how stone, dirt and the ore matrix
 *  are all built, and close enough to how Minecraft's own textures are made. */
function speckled(seed: number, density: number): string[] {
  const random = seededRandom(seed)
  return Array.from({ length: TEXTURE }, () =>
    Array.from({ length: TEXTURE }, () => {
      const roll = random()
      if (roll < density * 0.5) return 'd'
      if (roll < density) return 'l'
      return 'b'
    }).join(''),
  )
}

/** Dirt with a green cap and a ragged lower edge: a grass block seen from the side. */
function grassTexture(seed: number, density: number, flowers: boolean): string[] {
  const rows = speckled(seed, density)
  const random = seededRandom(seed + 1)
  for (let x = 0; x < TEXTURE; x++) {
    const depth = 3 + Math.round(random() * 2) // 3-5px of green, so the edge is not a ruler line
    for (let y = 0; y < depth; y++) {
      const row = [...(rows[y] ?? '')]
      const flower = flowers && y === 0 && random() < 0.14
      row[x] = flower ? 'f' : y === 0 ? 'H' : random() < 0.3 ? 'G' : 'g'
      rows[y] = row.join('')
    }
  }
  return rows
}

/** Stone with clusters of mineral in it, each cluster lit from the top left. */
function oreTexture(seed: number, clusters: number, density: number): string[] {
  const rows = speckled(seed + 7, density).map((row) => [...row])
  const random = seededRandom(seed + 11)
  const shape: [number, number][] = [
    [0, 0],
    [1, 0],
    [0, 1],
    [1, 1],
    [2, 0],
    [1, 2],
    [2, 1],
    [2, 2],
  ]
  for (let cluster = 0; cluster < clusters; cluster++) {
    const cx = 2 + Math.floor(random() * (TEXTURE - 4))
    const cy = 2 + Math.floor(random() * (TEXTURE - 4))
    shape.forEach(([dx, dy], index) => {
      const x = cx + dx
      const y = cy + dy
      const row = rows[y]
      if (!row || x < 0 || x >= TEXTURE) return
      row[x] = index === 0 ? 'M' : 'm'
    })
  }
  return rows.map((row) => row.join(''))
}

/**
 * The reward is built out of a single material, chosen by how the quiz went - see materialTier in
 * the game rules. Each is a little richer than the last: cleaner stone, lusher grass, more mineral
 * in the ore, and flowers in the grass from gold upwards. Same pixel art, better world.
 */
interface Material {
  label: string
  /** Base, dark and light speckles. */
  stone: Record<string, string>
  dirt: Record<string, string>
  /** Cap colours, which must not reuse the dirt keys. */
  grass: Record<string, string>
  mineral: Record<string, string>
  /** Clusters of mineral per ore block. */
  clusters: number
  /** How much speckle: 0.16 is a plain block, 0.28 a busy one. */
  density: number
  flowers: boolean
}

const COAL: Material = {
  label: 'coal',
  stone: { b: '#838383', d: '#6e6e6e', l: '#949494' },
  dirt: { b: '#7f5f45', d: '#66492f', l: '#936e4e' },
  grass: { g: '#5e9347', G: '#6ea755', H: '#7dbb5e', f: '#cfe0a8' },
  mineral: { m: '#2f3237', M: '#4b5158' },
  clusters: 3,
  density: 0.16,
  flowers: false,
}

const MATERIALS: Material[] = [
  COAL,
  {
    label: 'iron',
    stone: { b: '#8a8a8a', d: '#757575', l: '#9c9c9c' },
    dirt: { b: '#866043', d: '#6d4c33', l: '#9a7350' },
    grass: { g: '#6aa84f', G: '#7cbb56', H: '#8ed167', f: '#e8e2b0' },
    mineral: { m: '#c98f74', M: '#e8b79c' },
    clusters: 4,
    density: 0.2,
    flowers: false,
  },
  {
    label: 'gold',
    stone: { b: '#8f8f92', d: '#7a7a7e', l: '#a3a3a8' },
    dirt: { b: '#8d6547', d: '#73503a', l: '#a1785a' },
    grass: { g: '#6fb653', G: '#82c95f', H: '#95dc70', f: '#f6e7a6' },
    mineral: { m: '#d99f14', M: '#f8c627' },
    clusters: 5,
    density: 0.24,
    flowers: true,
  },
  {
    label: 'diamond',
    stone: { b: '#8b9096', d: '#757a80', l: '#a0a6ad' },
    dirt: { b: '#8a6a52', d: '#6f5340', l: '#a4826a' },
    grass: { g: '#63c46a', G: '#77d97e', H: '#8ded93', f: '#eaf7ff' },
    mineral: { m: '#2fbfae', M: '#4aedd9' },
    clusters: 6,
    density: 0.28,
    flowers: true,
  },
]

interface Textures {
  grass: React.CSSProperties
  dirt: React.CSSProperties
  stone: React.CSSProperties
  ore: React.CSSProperties
}

/** Built on demand and kept: a level only ever uses one tier, so only that one is ever generated. */
const textureCache = new Map<number, Textures>()

function texturesFor(tier: number): Textures {
  const cached = textureCache.get(tier)
  if (cached) return cached

  const material = MATERIALS[tier] ?? COAL
  const seed = tier * 97
  const textures: Textures = {
    // The grass palette is spread over the dirt one: the cap is painted into a dirt block, and the
    // keys do not overlap, so the light-speckle key means the right thing in each.
    grass: pixelArt(grassTexture(11 + seed, material.density, material.flowers), {
      ...material.dirt,
      ...material.grass,
    }),
    dirt: pixelArt(speckled(22 + seed, material.density), material.dirt),
    stone: pixelArt(speckled(33 + seed, material.density), material.stone),
    ore: pixelArt(oreTexture(44 + seed, material.clusters, material.density), {
      ...material.stone,
      ...material.mineral,
    }),
  }
  textureCache.set(tier, textures)
  return textures
}

/** The bevel that makes a block read as a block rather than a coloured square. */
const BEVEL = 'inset -2px -2px 0 rgba(0,0,0,0.22), inset 2px 2px 0 rgba(255,255,255,0.22)'

function tileStyle(tile: number, textures: Textures): React.CSSProperties | undefined {
  if (tile === GRASS) return textures.grass
  if (tile === DIRT) return textures.dirt
  if (tile === STONE) return textures.stone
  if (tile === ORE) return textures.ore
  return undefined
}

/**
 * A slime, 16x16 so it fills exactly one tile: a domed green blob with glints for eyes and a flat
 * little mouth. Generated rows, checked to the character - a row one pixel long skews the sprite.
 */
const SLIME_ART = [
  '................',
  '................',
  '................',
  '......GGGG......',
  '....GwwGGGGG....',
  '...GwGGGGGGGG...',
  '..gggggggggggg..',
  '..gggweggweggg..',
  '.ggggeeggeegggg.',
  '.gggggggggggggg.',
  '.gggggggggggggg.',
  '.ggggggeegggggg.',
  '..gggggggggggg..',
  '..dddddddddddd..',
  '....dddddddd....',
  '................',
]

const SLIME_PALETTE = { G: '#8fd85f', g: '#6abf40', d: '#4a8f2c', e: '#1c2b16', w: '#eaffd8' }
const SLIME = pixelArt(SLIME_ART, SLIME_PALETTE)

/**
 * Steve, 16x24 so the sprite is exactly the collision box: one tile wide and one and a half tall.
 * Hair, eyes, nose, mouth, cyan shirt, blue trousers and a shaded outer column on each arm - the
 * readable parts of the classic skin at this size.
 */
const STEVE_ART = [
  '....hhhhhhhh....',
  '....hhhhhhhh....',
  '....ssssssss....',
  '....sepsspes....',
  '....sssnnsss....',
  '....ssmmmmss....',
  '....ssssssss....',
  '....SSSSSSSS....',
  'cccccccccccccccc',
  'cccccccccccccccc',
  'SsssccccccccsssS',
  'SsssccccccccsKKK',
  'Ssssccccccccskkk',
  'Ssssccccccccskkk',
  'SsssccccccccsssS',
  'SsssccccccccsssS',
  '....bbbBbbbb....',
  '....bbbBbbbb....',
  '....bbbBbbbb....',
  '....bbbBbbbb....',
  '....bbbBbbbb....',
  '....bbbBbbbb....',
  '....ggggBggg....',
  '....GGGGGGGG....',
]

const STEVE_PALETTE = {
  h: '#3b2413',
  s: '#c98d5c',
  S: '#a5714a',
  e: '#f2f2f2',
  p: '#2b2823',
  n: '#a5714a',
  m: '#6b432c',
  c: '#00a8a8',
  b: '#3f3fbf',
  B: '#32329c',
  g: '#6b6b6b',
  G: '#3f3f3f',
  // The gun: dark metal with a lighter top edge, held in the arm and pointing the way he faces.
  k: '#4a4a52',
  K: '#8f8f9c',
}

const STEVE = pixelArt(STEVE_ART, STEVE_PALETTE)

/** The jetpack flame, drawn under the character's feet only while it is firing. */
const FLAME_ART = [
  '..yYy..',
  '.yYYYy.',
  'yYYoYYy',
  'yYoOoYy',
  '.yOoOy.',
  '..oOo..',
]

const FLAME_PALETTE = { y: '#ffe066', Y: '#ffb703', o: '#fb8500', O: '#e85d04' }
const FLAME = pixelArt(FLAME_ART, FLAME_PALETTE)

/** The flash at the barrel, shown for MUZZLE_FLASH seconds after each shot. It sits inside the
 *  sprite, so it mirrors with the character and always points the way the gun does. */
const FLASH_ART = [
  '..y..',
  '.yYy.',
  'yYWYy',
  '.yYy.',
  '..y..',
]
const FLASH_PALETTE = { y: '#ffb703', Y: '#ffe066', W: '#fffbe6' }
const FLASH = pixelArt(FLASH_ART, FLASH_PALETTE)

/** A pellet, drawn pointing right: white core at the front, amber trail behind. It is rotated to
 *  its heading when it is drawn. */
const BULLET_ART = ['.yy.', 'yWWW', '.yy.']
const BULLET_PALETTE = { W: '#fffbe6', y: '#ffb703' }
const BULLET = pixelArt(BULLET_ART, BULLET_PALETTE)

// ---------------------------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------------------------

/** The level fills its container up to this width, and the tiles scale with it. Inline it is the
 *  page column that binds - about 730px on a results page, so a 30px tile over 288 tiles - and
 *  the full-screen option lifts that cap and sizes the board against the viewport instead. */
const BOARD_MAX_WIDTH = 960

const LEFT_KEYS = new Set(['arrowleft', 'a'])
const RIGHT_KEYS = new Set(['arrowright', 'd'])
const JUMP_KEYS = new Set(['arrowup', 'w', ' '])
const FIRE_KEYS = new Set(['f'])

export function MiningReward({
  correctCount,
  questionCount,
  playSecondsEarned,
  live = false,
  retryHref,
}: {
  correctCount: number
  questionCount: number
  /** Seconds this quiz earned, shown with the countdown so the trade is visible rather than folklore. */
  playSecondsEarned?: number
  /**
   * Run the server-side play-time ledger. Off in the development preview, which has no account to
   * bill against - and which is the way to inspect the level without spending anything.
   */
  live?: boolean
  /** Where to send a student who has run out of time and wants to earn more. */
  retryHref?: string
}) {
  const level = useMemo(() => buildLevel(correctCount), [correctCount])
  // The score decides what the world is made of: the same level, in a better material.
  const tier = materialTier(correctCount, questionCount)
  const material = MATERIALS[tier] ?? COAL
  const textures = useMemo(() => texturesFor(tier), [tier])
  const sounds = useMemo(() => createSounds(), [])
  const [mined, setMined] = useState<ReadonlySet<number>>(new Set())
  const [slimesLeft, setSlimesLeft] = useState(level.enemySpawns.length)
  const [playing, setPlaying] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [soundOn, setSoundOn] = useState(readSoundOn)
  /**
   * Play time left, or null when this level is untimed - either the development preview, or a
   * ledger that could not be reached. `null` deliberately means "let them play": the reward is
   * meant to be the fun part, and a level that refuses to start is a worse bug than untimed play.
   */
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null)

  const panelRef = useRef<HTMLDivElement>(null)
  const shellRef = useRef<HTMLDivElement>(null)
  const spriteRef = useRef<HTMLDivElement>(null)
  const flameRef = useRef<HTMLDivElement>(null)
  const fuelRef = useRef<HTMLDivElement>(null)
  const flashRef = useRef<HTMLDivElement>(null)
  const bulletRefs = useRef<(HTMLDivElement | null)[]>([])
  const slimeRefs = useRef<(HTMLDivElement | null)[]>([])
  /** Where the pointer last was, in tiles. Null until the mouse has been over the level. */
  const aimRef = useRef<AimPoint | null>(null)

  // The player and the keys held down live in refs: the loop reads them 120 times a second, and
  // none of it belongs in React state. `mined` is the exception, because it changes the tiles.
  const worldRef = useRef<World>(createWorld(level))
  const playerRef = useRef<PlayerState>(spawnPlayer(level))
  const heldRef = useRef<Set<Held>>(new Set())
  const jumpRequestAtRef = useRef(-Infinity)
  const clockRef = useRef(0)
  const celebratedRef = useRef(false)

  const perfect = questionCount > 0 && correctCount === questionCount

  useEffect(() => {
    sounds.setMuted(!soundOn)
    writeSoundOn(soundOn)
  }, [soundOn, sounds])

  // The play-time heartbeat. The client only ever says "still here"; the server measures the gap
  // and bills it against the stored balance, so this can run on a fixed interval without the
  // student being able to mint time by editing the bundle. The countdown ticks down locally in
  // between and is corrected by every response, which is what keeps it honest.
  useEffect(() => {
    if (!live) return

    let cancelled = false
    let sinceBeat = 0

    // The balance without spending any of it: landing on a results page and reading it for a
    // moment should not cost play time.
    api
      .gameStatus()
      .then((status) => {
        if (!cancelled) setSecondsLeft(status.secondsRemaining)
      })
      .catch(() => {
        if (!cancelled) setSecondsLeft(null)
      })

    const timer = setInterval(() => {
      sinceBeat += 1000
      setSecondsLeft((current) => (current === null ? current : tickClock(current, 1000)))
      if (sinceBeat < HEARTBEAT_INTERVAL_MS) return
      sinceBeat = 0
      api
        .gameHeartbeat()
        .then((status) => {
          if (!cancelled) setSecondsLeft(status.secondsRemaining)
        })
        .catch(() => {
          if (!cancelled) setSecondsLeft(null)
        })
    }, 1000)

    return () => {
      cancelled = true
      clearInterval(timer)
      // One last beat as the level closes, to bill the part-interval at this end of it. How long
      // that was is the server's to work out from its own clock; all this says is "no longer here".
      void api.gameHeartbeat().catch(() => {})
    }
  }, [live])

  const outOfTime = live && secondsLeft !== null && secondsLeft <= 0

  const paint = useCallback(() => {
    const player = playerRef.current
    const sprite = spriteRef.current
    if (sprite) {
      sprite.style.left = `${(player.x / COLS) * 100}%`
      sprite.style.top = `${(player.y / ROWS) * 100}%`
      sprite.style.transform = player.facing < 0 ? 'scaleX(-1)' : ''
    }
    // The flame, the muzzle flash, the fuel gauge and the shots are written here too, for the same
    // reason as the sprite: they all change every frame, and a render per frame is not worth it.
    if (flameRef.current) flameRef.current.style.opacity = player.thrusting ? '1' : '0'
    if (flashRef.current) {
      const shooting = player.muzzleUntil > clockRef.current
      flashRef.current.style.opacity = shooting ? '1' : '0'
      if (shooting) {
        // At the barrel rather than beside the sprite, so it moves round the character with the aim.
        const direction = aimDirection(player, aimRef.current)
        const muzzle = muzzlePosition(player, direction)
        flashRef.current.style.left = `${(muzzle.x / COLS) * 100}%`
        flashRef.current.style.top = `${(muzzle.y / ROWS) * 100}%`
      }
    }
    if (fuelRef.current) {
      const fraction = Math.max(0, Math.min(1, player.fuel / JET_FUEL))
      fuelRef.current.style.width = `${fraction * 100}%`
      fuelRef.current.style.backgroundColor = fraction < 0.25 ? '#f87171' : '#fb923c'
    }
    // Blinking while recovering makes the immunity legible rather than mysterious.
    if (sprite) {
      const recovering = player.hurtUntil > clockRef.current
      sprite.style.opacity = recovering && Math.floor(clockRef.current * 14) % 2 === 0 ? '0.4' : '1'
    }

    // One element per slime the level started with, matched by id, so squashing one does not make
    // the others jump to a different element.
    const { enemies } = worldRef.current
    const showing = new Set<number>()
    for (const enemy of enemies) {
      const element = slimeRefs.current[enemy.id]
      if (!element) continue
      showing.add(enemy.id)
      element.style.opacity = '1'
      element.style.left = `${(enemy.x / COLS) * 100}%`
      element.style.top = `${(enemy.y / ROWS) * 100}%`
      element.style.transform = enemy.direction < 0 ? 'scaleX(-1)' : ''
    }
    slimeRefs.current.forEach((element, id) => {
      if (element && !showing.has(id)) element.style.opacity = '0'
    })

    // A fixed pool of elements, shown and hidden as shots come and go: the pool size is the most
    // shots the gun can have in the air at once.
    const { bullets } = worldRef.current
    bulletRefs.current.forEach((element, index) => {
      if (!element) return
      const bullet = bullets[index]
      element.style.opacity = bullet ? '1' : '0'
      if (!bullet) return
      element.style.left = `${(bullet.x / COLS) * 100}%`
      element.style.top = `${(bullet.y / ROWS) * 100}%`
      // Turned to its heading, so a diagonal shot looks diagonal.
      const heading = (Math.atan2(bullet.vy, bullet.vx) * 180) / Math.PI
      element.style.transform = `translate(-50%, -50%) rotate(${heading}deg)`
    })
  }, [])

  // New level, e.g. moving between two results pages: back to the start with the ore restored.
  useEffect(() => {
    worldRef.current = createWorld(level)
    playerRef.current = spawnPlayer(level)
    heldRef.current.clear()
    jumpRequestAtRef.current = -Infinity
    clockRef.current = 0
    celebratedRef.current = false
    setMined(new Set())
    setSlimesLeft(level.enemySpawns.length)
    // The keyboard only reaches the level through this panel, so it takes focus as soon as it
    // appears. Without this the level is a picture and the character will not move - and
    // `preventScroll` keeps landing on the results page from jumping down to the reward.
    panelRef.current?.focus({ preventScroll: true })
  }, [level])

  // Before paint, so the sprite never flashes at the top-left corner on the first frame.
  useLayoutEffect(paint, [paint, level, playing])

  // Ringing out is a hard stop: a jump in progress must not leave a key held down or the jetpack
  // hissing behind the overlay, and the level stops taking focus as somewhere to play.
  useEffect(() => {
    if (!outOfTime) return
    heldRef.current.clear()
    jumpRequestAtRef.current = -Infinity
    sounds.thrust(false)
    setPlaying(false)
  }, [outOfTime, sounds])

  const fullscreenAvailable = typeof document !== 'undefined' && document.fullscreenEnabled

  // Full screen is requested on this wrapper rather than the board itself, so the heading,
  // instructions and progress stay on screen with the level instead of being hidden behind it.
  useEffect(() => {
    const onFullscreenChange = () => {
      const active = document.fullscreenElement !== null && document.fullscreenElement === shellRef.current
      setIsFullscreen(active)
      // The keys only reach the level through the panel's own handler, so focus has to follow it
      // into full screen or the character stops responding.
      if (active) panelRef.current?.focus({ preventScroll: true })
    }
    document.addEventListener('fullscreenchange', onFullscreenChange)
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange)
      // Navigating away mid-game - which unmounts this - would otherwise leave the browser
      // stranded in full screen with no level in it.
      if (document.fullscreenElement === shellRef.current) void document.exitFullscreen().catch(() => {})
    }
  }, [])

  const toggleFullscreen = useCallback(() => {
    if (!fullscreenAvailable) return
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => {})
      return
    }
    // Rejections are ignored on purpose: the only realistic one is the browser refusing the
    // request, and there is nothing useful to say about it beyond staying as we were.
    void shellRef.current?.requestFullscreen().catch(() => {})
  }, [fullscreenAvailable])

  // The loop only runs while the panel has focus: nothing moves while the level is just sitting
  // there on a results page, and there is no reason to burn a frame budget on a static picture.
  // Nor does it run once the balance is spent, which is the whole point of metering play time.
  useEffect(() => {
    if (!playing || outOfTime) return

    let frame = 0
    let previous = performance.now()
    let accumulator = 0

    const tick = (now: number) => {
      accumulator += Math.min((now - previous) / 1000, 0.25)
      previous = now

      let collected = false
      let jumpedNow = false
      let minedNow = false
      let firedNow = false
      let killedNow = false
      let hurtNow = false
      let impact = 0

      while (accumulator >= STEP) {
        clockRef.current += STEP
        // Slimes walk first, so contact is judged against where they have actually got to.
        stepEnemies(worldRef.current, STEP)
        const outcome = stepPlayer(
          playerRef.current,
          worldRef.current,
          {
            held: heldRef.current,
            jumpRequestedAt: jumpRequestAtRef.current,
            clock: clockRef.current,
            aimPoint: aimRef.current,
          },
          STEP,
        )
        if (outcome.jumped) jumpRequestAtRef.current = -Infinity
        collected ||= outcome.minedNow.length > 0
        minedNow ||= outcome.minedNow.length > 0
        jumpedNow ||= outcome.jumped
        firedNow ||= outcome.fired
        killedNow ||= outcome.kills > 0
        hurtNow ||= outcome.hurt
        impact = Math.max(impact, outcome.impact)
        accumulator -= STEP
      }

      // Sounds are played once per frame rather than once per step, so a frame that resolved two
      // collisions does not double up. The jetpack hiss is level-triggered and starts and stops
      // itself.
      if (jumpedNow) sounds.jump()
      if (minedNow) sounds.mine()
      if (firedNow) sounds.shoot()
      if (killedNow) sounds.squash()
      if (hurtNow) sounds.hurt()
      if (impact > 9) sounds.land(impact)
      sounds.thrust(playerRef.current.thrusting)

      // One render per frame at most, however many ores the step collected - and one more for the
      // slime count, which only changes when one of them is squashed.
      if (collected) setMined(new Set(worldRef.current.mined))
      if (killedNow) setSlimesLeft(worldRef.current.enemies.length)

      paint()
      frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(frame)
      // Losing focus mid-flight must not leave the jetpack hissing.
      sounds.thrust(false)
    }
  }, [level, paint, playing, sounds, outOfTime])

  // The fanfare fires once, on the step that clears the last ore.
  useEffect(() => {
    const complete = mined.size >= level.oreCount
    if (complete && !celebratedRef.current) sounds.fanfare()
    celebratedRef.current = complete
  }, [mined, level, sounds])

  /** Turns a pointer event into a point in tile coordinates, relative to the board. */
  const aimAtPointer = (event: React.PointerEvent<HTMLDivElement>) => {
    const panel = panelRef.current
    if (!panel) return
    const bounds = panel.getBoundingClientRect()
    aimRef.current = {
      x: ((event.clientX - bounds.left) / bounds.width) * COLS,
      y: ((event.clientY - bounds.top) / bounds.height) * ROWS,
    }
  }

  const releaseTrigger = () => heldRef.current.delete('fire')

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const key = event.key.toLowerCase()
    if (LEFT_KEYS.has(key)) heldRef.current.add('left')
    else if (RIGHT_KEYS.has(key)) heldRef.current.add('right')
    else if (JUMP_KEYS.has(key)) {
      heldRef.current.add('jump')
      // Auto-repeat is ignored, so holding jump does not count as pressing it again. The time, not
      // a flag, so the press can expire instead of bouncing the character on landing.
      if (!event.repeat) jumpRequestAtRef.current = clockRef.current
    } else if (FIRE_KEYS.has(key)) heldRef.current.add('fire')
    else {
      return
    }
    // Arrow keys and space scroll the page otherwise, which makes the level unplayable.
    event.preventDefault()
  }

  const handleKeyUp = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const key = event.key.toLowerCase()
    if (LEFT_KEYS.has(key)) heldRef.current.delete('left')
    else if (RIGHT_KEYS.has(key)) heldRef.current.delete('right')
    else if (JUMP_KEYS.has(key)) heldRef.current.delete('jump')
    else if (FIRE_KEYS.has(key)) heldRef.current.delete('fire')
  }

  // Pointer capture is not reliable for a mouse dragged off the board, and a trigger that sticks
  // down would keep firing and kicking long after the button came up.
  useEffect(() => {
    window.addEventListener('pointerup', releaseTrigger)
    window.addEventListener('blur', releaseTrigger)
    return () => {
      window.removeEventListener('pointerup', releaseTrigger)
      window.removeEventListener('blur', releaseTrigger)
    }
  }, [])

  const allMined = mined.size >= level.oreCount

  return (
    <div
      ref={shellRef}
      className={
        isFullscreen
          ? 'flex h-screen w-screen items-center justify-center overflow-hidden bg-slate-900 p-4'
          : ''
      }
    >
      {/* In full screen the card takes the viewport: as wide as the screen, or as wide as the
          screen is tall allows once the heading, instructions and padding have had their share. */}
      <div
        className="w-full rounded-2xl bg-white/90 p-5 shadow-sm ring-1 ring-slate-200/70"
        style={isFullscreen ? { maxWidth: `min(92vw, ${(COLS / ROWS) * 72}vh)` } : undefined}
      >
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <h2 className="text-xl font-semibold text-slate-900">Your reward: mine your ore</h2>
          <div className="flex items-center gap-3">
            <p className="text-sm text-slate-500">
              {mined.size} of {level.oreCount} {material.label} mined
              {level.enemySpawns.length > 0 ? ` · ${slimesLeft} slimes left` : ''}
            </p>
            {secondsLeft === null ? null : (
              <span
                data-testid="play-clock"
                title="Play time left. Answer more questions to earn more."
                className={`rounded-lg px-2.5 py-1.5 text-sm font-semibold tabular-nums ${
                  outOfTime
                    ? 'bg-rose-50 text-rose-700'
                    : secondsLeft <= 30
                      ? 'bg-amber-50 text-amber-700'
                      : 'bg-slate-100 text-slate-600'
                }`}
              >
                {formatClock(secondsLeft)} left
              </span>
            )}
            <button
              type="button"
              onClick={() => setSoundOn((on) => !on)}
              aria-pressed={soundOn}
              aria-label={soundOn ? 'Mute sound effects' : 'Unmute sound effects'}
              title={soundOn ? 'Mute sound effects' : 'Unmute sound effects'}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm leading-none text-slate-600 transition hover:border-indigo-300 hover:bg-indigo-50/40"
            >
              {soundOn ? '🔊' : '🔇'}
            </button>
            {fullscreenAvailable ? (
              <button
                type="button"
                onClick={toggleFullscreen}
                aria-pressed={isFullscreen}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:border-indigo-300 hover:bg-indigo-50/40 hover:text-indigo-700"
              >
                {isFullscreen ? 'Exit full screen' : 'Full screen'}
              </button>
            ) : null}
          </div>
        </div>

        {playSecondsEarned && playSecondsEarned > 0 ? (
          <p className="mt-1 text-xs font-medium text-emerald-700">
            That quiz earned {pluralise(playSecondsEarned, 'second')} of play time.
          </p>
        ) : null}

        <p className="mt-1 text-xs text-slate-500">
          Move with <kbd className="rounded bg-slate-100 px-1">A</kbd> and{' '}
          <kbd className="rounded bg-slate-100 px-1">D</kbd> or the arrow keys, jump with{' '}
          <kbd className="rounded bg-slate-100 px-1">Space</kbd> and hold it in the air for the
          jetpack. <strong className="font-medium text-slate-600">Left click</strong> shoots at the
          pointer (<kbd className="rounded bg-slate-100 px-1">F</kbd> shoots straight ahead), and
          the recoil is enormous — aim it at the floor to launch yourself. Ore is mined by touching
          it or by shooting it.
        </p>

        <div className="mt-2 flex items-center gap-2">
          <span className="text-xs font-medium text-slate-500">Jetpack</span>
          <div className="h-2 w-32 overflow-hidden rounded-full bg-slate-200">
            <div ref={fuelRef} className="h-full w-full rounded-full bg-orange-400" />
          </div>
          <span className="text-xs text-slate-400">
            refills on the ground, trickles in the air · this level is built from {material.label}
          </span>
        </div>

        <div
          ref={panelRef}
          tabIndex={0}
          data-testid="dig-patch"
          onKeyDown={handleKeyDown}
          onKeyUp={handleKeyUp}
          onPointerMove={aimAtPointer}
          onPointerDown={(event) => {
            // Explicitly, because Safari does not focus a div from a click: without this the level
            // is clickable but dead on any browser that behaves that way.
            panelRef.current?.focus({ preventScroll: true })
            aimAtPointer(event)
            // Left button only: this is the trigger.
            if (event.button === 0) heldRef.current.add('fire')
          }}
          onPointerUp={releaseTrigger}
          onPointerCancel={releaseTrigger}
          onPointerLeave={releaseTrigger}
          onFocus={() => setPlaying(true)}
          onBlur={() => {
            heldRef.current.clear()
            jumpRequestAtRef.current = -Infinity
            setPlaying(false)
          }}
          aria-label="Platform level: move with A and D or the arrow keys, jump with Space, hold Space in the air for the jetpack, left click to shoot at the pointer"
          className="relative mx-auto mt-4 w-full cursor-crosshair touch-none select-none overflow-hidden rounded-lg bg-gradient-to-b from-sky-300 to-sky-100 outline-none ring-1 ring-slate-300 focus:ring-2 focus:ring-indigo-500"
          style={{
            // Inline it is the page column that limits the level. Full screen hands the width to
            // the card, which is sized against the viewport, so the board just fills it.
            maxWidth: isFullscreen ? '100%' : BOARD_MAX_WIDTH,
          }}
        >
          <div
            className="grid"
            style={{
              // Square tiles by construction: the board keeps the grid's aspect ratio and both
              // axes are divided evenly, so no tile size has to be computed or measured.
              aspectRatio: `${COLS} / ${ROWS}`,
              gridTemplateColumns: `repeat(${COLS}, 1fr)`,
              gridTemplateRows: `repeat(${ROWS}, 1fr)`,
            }}
          >
            {level.tiles.map((tile, index) => {
              const gone = tile === ORE && mined.has(index)
              return (
                <div
                  key={index}
                  style={{
                    ...(gone ? undefined : tileStyle(tile, textures)),
                    boxShadow: gone || tile === AIR ? undefined : BEVEL,
                  }}
                />
              )
            })}
          </div>

          {/* The sprite is the collision box: one tile wide, one and a half tall. Its position is
              written by the game loop through this ref, so React never re-renders it. */}
          <div
            ref={spriteRef}
            className="pointer-events-none absolute"
            data-testid="miner"
            style={{
              ...STEVE,
              width: `${(PLAYER_W / COLS) * 100}%`,
              height: `${(PLAYER_H / ROWS) * 100}%`,
            }}
          >
            {/* Hangs below the feet and is faded in and out by the loop, so it costs no render. */}
            <div
              ref={flameRef}
              className="absolute left-1/2 top-full w-[70%] -translate-x-1/2 animate-pulse"
              style={{ ...FLAME, height: '40%', opacity: 0 }}
            />
          </div>

          {/* At the barrel, wherever the gun is pointing: on the board rather than inside the sprite
              so that aiming up or down does not have to fight the sprite's mirroring. */}
          <div
            ref={flashRef}
            data-testid="muzzle-flash"
            className="pointer-events-none absolute"
            style={{
              ...FLASH,
              width: `${(0.7 / COLS) * 100}%`,
              height: `${(0.7 / ROWS) * 100}%`,
              transform: 'translate(-50%, -50%)',
              opacity: 0,
            }}
          />

          {/* One element per slime the level spawned, positioned by the loop and hidden once
              squashed. */}
          {level.enemySpawns.map((spawn, id) => (
            <div
              key={id}
              ref={(element) => {
                slimeRefs.current[id] = element
              }}
              data-testid="slime"
              aria-hidden="true"
              className="pointer-events-none absolute"
              style={{
                ...SLIME,
                left: `${(spawn.x / COLS) * 100}%`,
                top: `${((spawn.y + 1 - ENEMY_H) / ROWS) * 100}%`,
                width: `${(ENEMY_W / COLS) * 100}%`,
                height: `${(ENEMY_H / ROWS) * 100}%`,
                opacity: 0,
              }}
            />
          ))}

          {/* A fixed pool of shot elements, positioned by the loop. They sit outside the sprite so
              the character's mirroring does not flip the whole volley. */}
          {Array.from({ length: MAX_BULLETS }, (_, index) => (
            <div
              key={index}
              ref={(element) => {
                bulletRefs.current[index] = element
              }}
              data-testid="bullet"
              className="pointer-events-none absolute"
              style={{
                ...BULLET,
                width: `${(0.5 / COLS) * 100}%`,
                height: `${(0.5 * (3 / 4) / ROWS) * 100}%`,
                transform: 'translate(-50%, -50%)',
                opacity: 0,
              }}
            />
          ))}

          {/* Out of time. The overlay covers the board rather than replacing it, so the ore already
              mined stays visible and the level does not vanish out from under the student. */}
          {outOfTime ? (
            <div
              data-testid="out-of-time"
              className="absolute inset-0 grid place-items-center bg-slate-900/85 p-4 text-center"
            >
              <div>
                <p className="text-base font-semibold text-white">Out of play time</p>
                <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-slate-300">
                  What you have already mined is safe. Answer some more questions to earn more time
                  down the mine.
                </p>
                {retryHref ? (
                  <Link to={retryHref} className={`${buttonClasses('primary', 'md')} mt-4`}>
                    Earn more play time
                  </Link>
                ) : null}
              </div>
            </div>
          ) : null}

          {/* Nothing moves until the panel has focus, so say so rather than leaving a dead
              controller on screen. Pointer events pass through to the panel underneath. */}
          {playing || outOfTime ? null : (
            <p className="pointer-events-none absolute inset-x-0 top-2 mx-auto w-fit rounded-full bg-slate-900/70 px-3 py-1 text-xs font-medium text-white">
              Click the level to play
            </p>
          )}
        </div>

        {allMined ? (
          <p className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
            All mined{slimesLeft === 0 ? ' and every slime squashed' : ''}.{' '}
            {perfect ? 'Flawless — diamond grade.' : `A ${material.label}-grade run.`}
          </p>
        ) : null}
      </div>
    </div>
  )
}
