import { describe, expect, it } from 'vitest'
import {
  AIR,
  COLS,
  GRASS,
  GUN_COOLDOWN,
  JET_AIR_REFILL,
  JET_FUEL,
  JET_GROUND_REFILL,
  JUMP_RISE,
  JUMP_SPEED,
  LEDGE_GAP,
  MAX_BULLETS,
  MAX_FALL,
  MUZZLE_FLASH,
  ORE,
  PLAYER_H,
  PLAYER_W,
  ROWS,
  ENEMY_H,
  HURT_INVULNERABLE,
  STEP,
  STONE,
  buildLevel,
  createWorld,
  isSolid,
  materialTier,
  seededRandom,
  spawnPlayer,
  stepEnemies,
  stepPlayer,
  tileAt,
  type AimPoint,
  type Held,
  type Input,
  type Level,
  type PlayerState,
  type World,
} from './platformer'

const GROUND_SURFACE = ROWS - 2

const keys = (...held: Held[]) => new Set<Held>(held)
const input = (
  held: ReadonlySet<Held>,
  clock: number,
  pressedAt = -Infinity,
  aimPoint: AimPoint | null = null,
): Input => ({ held, jumpRequestedAt: pressedAt, clock, aimPoint })

/** Runs the physics for a while, holding `held`, optionally pressing jump once at `pressAt`. */
function play(
  world: World,
  player: PlayerState,
  held: ReadonlySet<Held>,
  seconds: number,
  options: { from?: number; pressAt?: number; pressAgain?: boolean } = {},
) {
  let clock = options.from ?? 0
  let pressAt = options.pressAt ?? -Infinity
  const end = clock + seconds
  while (clock < end) {
    clock += STEP
    if (options.pressAgain && player.grounded) pressAt = clock
    const outcome = stepPlayer(player, world, input(held, clock, pressAt), STEP)
    if (outcome.jumped) pressAt = options.pressAgain ? pressAt : -Infinity
  }
  return clock
}

/** Holds nothing until the character is standing on something. */
function settle(world: World, player: PlayerState, seconds = 3) {
  play(world, player, keys(), seconds)
  return player
}

/**
 * A bare level: a floor, two walls, no ledges. Aiming tests need a clear line of fire, and a
 * generated level will happily put a ledge exactly where a shot is going.
 */
function bareLevel(): Level {
  const tiles = new Array<number>(COLS * ROWS).fill(AIR)
  for (let x = 0; x < COLS; x++) {
    tiles[(ROWS - 2) * COLS + x] = GRASS
    tiles[(ROWS - 1) * COLS + x] = STONE
  }
  for (let y = 0; y < ROWS; y++) {
    tiles[y * COLS] = STONE
    tiles[y * COLS + COLS - 1] = STONE
  }
  return { tiles, spawn: { x: 12, y: ROWS - 2 - PLAYER_H }, oreCount: 0, enemySpawns: [] }
}

/** A bare level with room on the floor and one platform to patrol. */
function patrolLevel(): Level {
  const level = bareLevel()
  for (let x = 4; x <= 6; x++) level.tiles[6 * COLS + x] = STONE
  return level
}

/** An enemy standing on the floor at `tx`, in the same shape createWorld would make. */
function enemyAt(tx: number, y = ROWS - 2 - ENEMY_H) {
  return { id: 0, x: tx, y, vy: 0, direction: 1 as const }
}

/** The first ore in any level matching `wanted`, with the level it came from. Which ore sits where
 *  depends on the score, so tests ask for the situation they need rather than guessing. */
function levelWithOre(wanted: (level: Level, tx: number, ty: number) => boolean) {
  for (let score = 1; score <= COLS; score++) {
    const level = buildLevel(score)
    for (let ty = 0; ty < ROWS; ty++) {
      for (let tx = 0; tx < COLS; tx++) {
        if (tileAt(level, tx, ty) === ORE && wanted(level, tx, ty)) return { level, ore: { tx, ty } }
      }
    }
  }
  throw new Error('no level had ore where the test needed it')
}

describe('buildLevel', () => {
  it('is deterministic, so a level does not change shape between renders', () => {
    expect(buildLevel(3).tiles).toEqual(buildLevel(3).tiles)
    expect(buildLevel(4).tiles).not.toEqual(buildLevel(3).tiles)
  })

  it('always has a continuous floor and walls at both ends', () => {
    for (const score of [0, 1, 5, 20]) {
      const level = buildLevel(score)
      for (let tx = 0; tx < COLS; tx++) {
        expect(tileAt(level, tx, ROWS - 2)).not.toBe(AIR)
        expect(tileAt(level, tx, ROWS - 1)).not.toBe(AIR)
      }
      for (let ty = 0; ty < ROWS; ty++) {
        expect(tileAt(level, 0, ty)).not.toBe(AIR)
        expect(tileAt(level, COLS - 1, ty)).not.toBe(AIR)
      }
    }
  })

  it('places one ore per correct answer, and at least one even for no score', () => {
    expect(buildLevel(0).oreCount).toBe(1)
    expect(buildLevel(5).oreCount).toBe(5)
    expect(buildLevel(20).oreCount).toBe(20)

    const counted = (level: Level) => level.tiles.filter((tile) => tile === ORE).length
    expect(counted(buildLevel(7))).toBe(7)
    expect(counted(buildLevel(0))).toBe(1)
  })

  it('needs more ore than the level has room for before it clamps', () => {
    // Not an expected input, but a clamp that silently produced unreachable ore would be worse.
    const level = buildLevel(10_000)
    expect(level.oreCount).toBe(level.tiles.filter((tile) => tile === ORE).length)
    expect(level.oreCount).toBeLessThan(COLS * ROWS)
  })

  it('never floats an ore in mid-air, so every ore can be stood next to', () => {
    for (const score of [0, 1, 6, 12, 20]) {
      const level = buildLevel(score)
      level.tiles.forEach((tile, index) => {
        if (tile !== ORE) return
        const ty = Math.floor(index / COLS)
        const tx = index % COLS
        expect(isSolid(level, new Set(), tx, ty + 1)).toBe(true)
      })
    }
  })

  it('keeps every ledge one jump above something solid below it', () => {
    // The invariant that makes a generated level completable: nothing is further than a jump
    // above the surface it hangs off, horizontally within reach of it.
    for (const score of [0, 4, 9, 20]) {
      const level = buildLevel(score)
      for (let ty = 0; ty < ROWS - 2; ty++) {
        for (let tx = 1; tx < COLS - 1; tx++) {
          if (tileAt(level, tx, ty) === AIR) continue
          let supported = false
          for (let dx = -3; dx <= 3 && !supported; dx++) {
            for (let gap = 1; gap <= LEDGE_GAP && !supported; gap++) {
              const below = ty + gap
              if (below >= ROWS) continue
              if (isSolid(level, new Set(), tx + dx, below)) supported = true
            }
          }
          expect(`${tx},${ty}`).toBe(supported ? `${tx},${ty}` : 'unsupported ledge')
        }
      }
    }
  })

  it('states the jump-height invariant the level generator relies on', () => {
    expect(JUMP_RISE).toBeGreaterThan(LEDGE_GAP)
  })
})

describe('stepPlayer', () => {
  it('falls to the ground and stays there', () => {
    const level = buildLevel(3)
    const player = spawnPlayer(level)
    settle(createWorld(level), player)
    expect(player.grounded).toBe(true)
    expect(player.y).toBeCloseTo(GROUND_SURFACE - PLAYER_H, 6)
    expect(player.vy).toBe(0)
  })

  it('does not fall through the floor at terminal velocity', () => {
    const world = createWorld(buildLevel(3))
    const player = spawnPlayer(world.level)
    player.y = 0
    player.vy = MAX_FALL
    play(world, player, keys(), 0.5)
    // Landed on whichever surface was under it, and never below the floor of the level.
    expect(player.grounded).toBe(true)
    expect(player.y).toBeGreaterThanOrEqual(0)
    expect(isSolid(world.level, world.mined, Math.floor(player.x), Math.floor(player.y + PLAYER_H))).toBe(true)
    expect(player.y).toBeLessThanOrEqual(GROUND_SURFACE - PLAYER_H + 1e-9)
  })

  it('reaches the next ledge with a held jump, and stays inside the level', () => {
    const world = createWorld(buildLevel(3))
    const player = settle(world, spawnPlayer(world.level))
    const rest = player.y

    let apex = rest
    let clock = 1
    const held = keys('jump')
    // Holding the key means jump then jetpack, so this is a long lift - but a bounded one.
    while (clock < 6) {
      clock += STEP
      stepPlayer(player, world, input(held, clock, clock), STEP)
      apex = Math.min(apex, player.y)
    }
    const rise = rest - apex
    expect(rise).toBeGreaterThan(LEDGE_GAP)
    expect(rise).toBeLessThan(ROWS)
  })

  it('makes a tapped jump a hop, because releasing cuts the arc short', () => {
    const world = createWorld(buildLevel(3))
    const player = settle(world, spawnPlayer(world.level))
    const rest = player.y
    let apex = rest
    let clock = 1
    for (let step = 0; step < 240; step++) {
      clock += STEP
      // One press, then released: no jetpack, and the cut ends the climb almost immediately.
      const held = step === 0 ? keys('jump') : keys()
      stepPlayer(player, world, input(held, clock, step === 0 ? clock : -Infinity), STEP)
      apex = Math.min(apex, player.y)
    }
    expect(rest - apex).toBeLessThan(1)
    expect(player.grounded).toBe(true)
  })

  it('can be cut short by releasing jump early', () => {
    const world = createWorld(buildLevel(3))
    const tall = settle(world, spawnPlayer(world.level))
    const short = { ...tall }

    let clock = 1
    let tallApex = tall.y
    let shortApex = short.y
    for (let step = 0; step < 240; step++) {
      clock += STEP
      stepPlayer(tall, world, input(keys('jump'), clock, step === 0 ? clock : -Infinity), STEP)
      stepPlayer(short, world, input(keys(), clock, step === 0 ? clock : -Infinity), STEP)
      tallApex = Math.min(tallApex, tall.y)
      shortApex = Math.min(shortApex, short.y)
    }
    expect(tall.y - short.y).toBeCloseTo(0, 6)
    expect(shortApex).toBeGreaterThan(tallApex)
  })

  it('runs into a wall and stops against it, rather than through it', () => {
    const world = createWorld(buildLevel(3))
    const player = settle(world, spawnPlayer(world.level))
    play(world, player, keys('left'), 2, { from: 5 })
    expect(player.x).toBeGreaterThanOrEqual(1)
    expect(player.x).toBeCloseTo(1, 6)
  })

  it('runs at a speed that crosses the level in a few seconds', () => {
    const world = createWorld(bareLevel())
    const player = settle(world, spawnPlayer(world.level))
    const from = player.x
    play(world, player, keys('right'), 1, { from: 5 })
    // A whole 24-tile level in about three seconds, so getting around is not a chore.
    expect(player.x - from).toBeGreaterThan(6)
    expect(player.x - from).toBeLessThan(9)
  })

  it('mines an ore on the ground by walking into it, and then walks through the gap', () => {
    // Ground ore: the tile directly above the grass, at the height of the character's legs.
    const { level, ore } = levelWithOre((_, __, ty) => ty === ROWS - 3)
    const world = createWorld(level)
    const index = ore.ty * COLS + ore.tx
    const player: PlayerState = {
      ...spawnPlayer(level),
      x: ore.tx - 1.2,
      y: GROUND_SURFACE - PLAYER_H,
      grounded: true,
      lastGroundedAt: 0,
    }
    play(world, player, keys('right'), 1.5)

    expect(world.mined.has(index)).toBe(true)
    expect(isSolid(level, world.mined, ore.tx, ore.ty)).toBe(false)
    // Walked past it, which is only possible because the ore stopped blocking once mined.
    expect(player.x).toBeGreaterThan(ore.tx)
  })

  it('mines the ore it lands on, then settles onto the ledge underneath', () => {
    // An ore with clear air above it, so the drop is a landing on the ore and nothing else.
    const { level, ore } = levelWithOre(
      (lvl, tx, ty) => tileAt(lvl, tx, ty - 1) === AIR && tileAt(lvl, tx, ty - 2) === AIR,
    )
    const world = createWorld(level)
    const player: PlayerState = {
      ...spawnPlayer(level),
      x: ore.tx,
      y: ore.ty - PLAYER_H - 0.5,
    }
    settle(world, player)

    expect(world.mined.has(ore.ty * COLS + ore.tx)).toBe(true)
    expect(player.grounded).toBe(true)
    // Mined on the way down, then in the block's place, standing on the ledge it was sitting on.
    expect(player.y).toBeCloseTo(ore.ty + 1 - PLAYER_H, 6)
  })

  it('stops at the invisible ceiling instead of climbing out of the level', () => {
    const world = createWorld(buildLevel(3))
    const player = spawnPlayer(world.level)
    player.y = 0.2
    player.vy = -JUMP_SPEED
    play(world, player, keys('jump'), 1, { from: 5 })
    expect(player.y).toBeGreaterThanOrEqual(0)
  })

  it('ignores a jump stamp from another clock base', () => {
    // A level reset restarts the clock. A stamp from the old one - or any future one - must not
    // read as "pressed just now", or the character gets free jumps forever.
    const world = createWorld(buildLevel(2))
    const player = settle(world, spawnPlayer(world.level))
    let jumped = false
    let clock = 0
    for (let step = 0; step < 240; step++) {
      clock += STEP
      // The last grounded tick and the press are both far in this clock's future.
      jumped ||= stepPlayer(player, world, input(keys('jump'), clock, clock + 100), STEP).jumped
    }
    expect(jumped).toBe(false)
    expect(player.grounded).toBe(true)
  })

  it('leaves the sprite exactly on the collision box', () => {
    // The art is authored 16x24 for a 1 x 1.5 tile box; if these drift apart the sprite floats.
    expect(PLAYER_W).toBe(1)
    expect(PLAYER_H).toBe(1.5)
  })
})

describe('jetpack', () => {
  /** Flies with the jump key held from the ground, and reports what the tank did. */
  function flight(level: Level, seconds: number) {
    const world = createWorld(level)
    const player = settle(world, spawnPlayer(level))
    const rest = player.y
    let clock = 1
    let apex = rest
    let lowestFuel = player.fuel
    let touchedDownAfterDry = false
    let wentDry = false

    while (clock < 1 + seconds) {
      clock += STEP
      stepPlayer(player, world, input(keys('jump'), clock, clock), STEP)
      apex = Math.min(apex, player.y)
      lowestFuel = Math.min(lowestFuel, player.fuel)
      if (player.fuel <= 0) wentDry = true
      if (wentDry && player.grounded) touchedDownAfterDry = true
    }
    return { player, rise: rest - apex, lowestFuel, touchedDownAfterDry }
  }

  it('lifts the character well above a plain jump', () => {
    // JUMP_RISE is what a jump alone can reach; the jetpack has to beat it clearly, or it is not
    // worth a fuel tank.
    const { rise } = flight(buildLevel(2), 1.2)
    expect(rise).toBeGreaterThan(JUMP_RISE + 1)
    expect(rise).toBeLessThan(ROWS)
  })

  it('runs out of fuel, so it is a lift rather than a flight mode', () => {
    const { rise, lowestFuel, touchedDownAfterDry } = flight(buildLevel(2), 8)
    expect(lowestFuel).toBe(0)
    expect(rise).toBeLessThan(ROWS)
    // Once dry, gravity wins: the character comes back down instead of hovering.
    expect(touchedDownAfterDry).toBe(true)
  })

  it('recharges on the ground, and trickles in the air', () => {
    const world = createWorld(buildLevel(2))
    const player = settle(world, spawnPlayer(world.level))

    // Burn most of the tank: jump and hold.
    let clock = play(world, player, keys('jump'), 0.5, { from: 1, pressAt: 1 })
    const burnt = player.fuel
    expect(burnt).toBeLessThan(JET_FUEL)

    // In the air with the key released the tank refills - but far slower than it burns.
    const airborneFrom = player.fuel
    let airborne = 0
    while (!player.grounded && airborne < 1) {
      clock += STEP
      airborne += STEP
      stepPlayer(player, world, input(keys(), clock), STEP)
    }
    const airGain = player.fuel - airborneFrom
    expect(airGain).toBeGreaterThan(0)
    expect(airGain / airborne).toBeCloseTo(JET_AIR_REFILL, 2)
    // The whole point: the trickle is slower than a grounded refill.
    expect(JET_AIR_REFILL).toBeLessThan(JET_GROUND_REFILL)

    settle(world, player)
    expect(player.fuel).toBe(JET_FUEL)
  })

  it('will not fire on fumes, so a trickle cannot be milked into a hover', () => {
    const world = createWorld(buildLevel(2))
    const player = spawnPlayer(world.level)
    // In the air on almost nothing, holding jump: the jet stays off and the character keeps falling.
    player.y = 2
    player.fuel = JET_FUEL * 0.05

    const startY = player.y
    let clock = 0
    let fired = false
    for (let step = 0; step * STEP < 0.25; step++) {
      clock += STEP
      stepPlayer(player, world, input(keys('jump'), clock), STEP)
      fired ||= player.thrusting
    }
    expect(fired).toBe(false)
    expect(player.y).toBeGreaterThan(startY)

    // Given time the tank trickles back past the ignition point, and only then does it light.
    let litAt = -1
    for (let step = 0; step * STEP < 6 && litAt < 0; step++) {
      clock += STEP
      stepPlayer(player, world, input(keys('jump'), clock), STEP)
      if (player.thrusting) litAt = clock
    }
    expect(litAt).toBeGreaterThan(0)
  })

  it('cannot be held aloft forever, even mashing the key on every landing', () => {
    const world = createWorld(buildLevel(2))
    const player = settle(world, spawnPlayer(world.level))
    let clock = 1
    let firstApex = player.y
    let overallApex = player.y
    let landings = 0

    // Twenty seconds of holding jump and pressing again the instant the character touches down:
    // the most generous case for staying up. Air refill keeps handing out bursts, so the question
    // is whether they ever add up to a climb.
    while (clock < 21) {
      clock += STEP
      const outcome = stepPlayer(player, world, input(keys('jump'), clock, player.grounded ? clock : -Infinity), STEP)
      if (outcome.impact > 0) landings += 1
      overallApex = Math.min(overallApex, player.y)
      if (clock < 5) firstApex = Math.min(firstApex, player.y)
    }

    // It keeps coming back down, and the later bursts never beat the first tank's height.
    expect(landings).toBeGreaterThan(3)
    expect(overallApex).toBeGreaterThan(firstApex - 0.5)
  })

  it('does not fire without the key held', () => {
    const world = createWorld(buildLevel(2))
    const player = settle(world, spawnPlayer(world.level))
    play(world, player, keys(), 2, { from: 5 })
    expect(player.fuel).toBe(JET_FUEL)
    expect(player.thrusting).toBe(false)
  })

  it('reports a landing impact that grows with the drop', () => {
    const drop = (fromHeight: number) => {
      const world = createWorld(buildLevel(2))
      const player = spawnPlayer(world.level)
      player.y = fromHeight
      let impact = 0
      let clock = 0
      for (let step = 0; step < 400; step++) {
        clock += STEP
        impact = Math.max(impact, stepPlayer(player, world, input(keys(), clock), STEP).impact)
      }
      return { impact, player }
    }

    const short = drop(GROUND_SURFACE - PLAYER_H - 1)
    const long = drop(0)
    expect(short.impact).toBeGreaterThan(9) // loud enough to be worth a thud
    expect(long.impact).toBeGreaterThan(short.impact)
    expect(long.player.grounded).toBe(true)
  })
})

describe('gun', () => {
  /** A bare level: the gun mechanics are not about dodging slimes or ledges. */
  function ready() {
    const world = createWorld(bareLevel())
    const player = settle(world, spawnPlayer(world.level))
    return { world, player }
  }

  it('fires a shot out of the barrel and kicks the character the other way', () => {
    const { world, player } = ready()
    // Mid-level, so the kick has room to travel - at the spawn it just slams into the wall.
    player.x = 12
    const from = player.x
    const outcome = stepPlayer(player, world, input(keys('fire'), 5), STEP)

    expect(outcome.fired).toBe(true)
    // Exactly one shot left the barrel - still flying, or already spent on whatever it hit, since a
    // shot fired at point-blank ore is mined within the step it was fired.
    expect(world.bullets.length + outcome.minedNow.length).toBe(1)
    // The shove: sent backwards, and popped upwards, in the same step it fired.
    expect(player.recoil).toBeLessThan(0)
    expect(player.vy).toBeLessThan(0)

    play(world, player, keys(), 1, { from: 5 })
    expect(from - player.x).toBeGreaterThan(2) // a couple of tiles of slide, at least
    expect(from - player.x).toBeLessThan(4)
  })

  it('kicks towards the wall it is facing away from, and gives control back', () => {
    const { world, player } = ready()
    player.x = 12
    // Facing left, so the kick goes right; then the keys take over again.
    play(world, player, keys('left'), 0.3, { from: 5 })
    const firedAt = player.x
    stepPlayer(player, world, input(keys('fire', 'left'), 6), STEP)
    expect(player.recoil).toBeGreaterThan(0)

    play(world, player, keys('left'), 1.5, { from: 6 })
    // The shove is long gone and the character is walking left again under its own steam.
    expect(player.x).toBeLessThan(firedAt)
    expect(player.recoil).toBeCloseTo(0, 6)
  })

  it('mines the ore its shot hits, and the shot stops there', () => {
    // A ground ore, so a shot fired from beside it, at chest height, is on its level.
    const { level, ore } = levelWithOre((_, __, ty) => ty === ROWS - 3)
    const world = createWorld(level)
    const player: PlayerState = {
      ...spawnPlayer(level),
      x: ore.tx - 4,
      y: GROUND_SURFACE - PLAYER_H,
      grounded: true,
      lastGroundedAt: 0,
    }

    let clock = 0
    let fired = false
    const index = ore.ty * COLS + ore.tx
    for (let step = 0; step < 400 && !world.mined.has(index); step++) {
      clock += STEP
      // Facing right, held down: the recoil walks the character back, the shot goes forward.
      const outcome = stepPlayer(player, world, input(keys('fire', 'right'), clock), STEP)
      fired ||= outcome.fired
    }

    expect(fired).toBe(true)
    expect(world.mined.has(index)).toBe(true)
    expect(isSolid(level, world.mined, ore.tx, ore.ty)).toBe(false)
  })

  it('stops at stone rather than tunnelling through the level', () => {
    const level = buildLevel(3)
    const world = createWorld(level)
    const player: PlayerState = {
      ...spawnPlayer(level),
      // Facing the left wall, with nothing but air between.
      x: 2,
      y: GROUND_SURFACE - PLAYER_H,
      grounded: true,
      lastGroundedAt: 0,
      facing: -1,
    }
    stepPlayer(player, world, input(keys('fire'), 1), STEP)
    expect(world.bullets).toHaveLength(1)

    play(world, player, keys(), 1, { from: 1 })
    expect(world.bullets).toHaveLength(0)
    // The wall is still a wall.
    expect(isSolid(level, world.mined, 0, ROWS - 2)).toBe(true)
  })

  it('has a cooldown, so the recoil cannot be spammed into a launch', () => {
    const { world, player } = ready()
    let clock = 0
    let shots = 0
    for (let step = 0; step < 120; step++) {
      clock += STEP
      if (stepPlayer(player, world, input(keys('fire'), clock), STEP).fired) shots += 1
    }
    // One second at a 0.35s cooldown: three shots, give or take the first.
    expect(shots).toBeGreaterThanOrEqual(2)
    expect(shots).toBeLessThanOrEqual(3)
    expect(world.bullets.length).toBeLessThanOrEqual(MAX_BULLETS)
  })

  it('shows the muzzle flash for a moment after each shot', () => {
    const { world, player } = ready()
    stepPlayer(player, world, input(keys('fire'), 5), STEP)
    expect(player.muzzleUntil).toBeGreaterThan(5)
    expect(player.muzzleUntil).toBeLessThanOrEqual(5 + MUZZLE_FLASH + 1e-9)
    stepPlayer(player, world, input(keys(), 5 + MUZZLE_FLASH), STEP)
    // The cooldown is still ticking, so the gun cannot fire twice in a flash.
    expect(player.gunCooldown).toBeGreaterThan(0)
    expect(player.gunCooldown).toBeLessThan(GUN_COOLDOWN)
  })

  it('shoots at the pointer, and the kick goes the other way', () => {
    const world = createWorld(bareLevel())
    const player = spawnPlayer(world.level)
    // Mid-air: firing straight down while standing on the ground just shoots the floor.
    player.y = 3
    player.grounded = false
    const middle = { x: player.x + PLAYER_W / 2, y: player.y + PLAYER_H / 2 }

    // Straight down: the shot goes down, and the recoil throws the character up hard.
    const down = stepPlayer(player, world, input(keys('fire'), 5, -Infinity, { x: middle.x, y: middle.y + 6 }), STEP)
    expect(down.fired).toBe(true)
    const shot = world.bullets[0]
    expect(shot?.vy).toBeGreaterThan(0)
    expect(Math.abs(shot?.vx ?? 1)).toBeLessThan(0.2)
    expect(player.vy).toBeLessThan(-JUMP_SPEED) // harder than the usual pop
  })

  it('slams the character down when firing upwards', () => {
    const world = createWorld(bareLevel())
    const player = spawnPlayer(world.level)
    player.y = 3
    player.grounded = false
    const middle = { x: player.x + PLAYER_W / 2, y: player.y + PLAYER_H / 2 }
    stepPlayer(player, world, input(keys('fire'), 5, -Infinity, { x: middle.x, y: middle.y - 6 }), STEP)
    expect(world.bullets[0]?.vy).toBeLessThan(0)
    // Fired away from the ground, so the kick drives the character towards it.
    expect(player.vy).toBeGreaterThan(0)
  })

  it('aims a diagonal shot along the line to the pointer', () => {
    const world = createWorld(bareLevel())
    const player = spawnPlayer(world.level)
    const target = { x: player.x + PLAYER_W / 2 + 4, y: player.y + PLAYER_H / 2 - 4 }
    stepPlayer(player, world, input(keys('fire'), 5, -Infinity, target), STEP)
    const shot = world.bullets[0]
    expect(shot).toBeDefined()
    // 45 degrees: equal and opposite components, and it is a unit vector times bullet speed.
    expect(shot?.vx).toBeCloseTo(-(shot?.vy ?? 0), 6)
    expect(Math.hypot(shot?.vx ?? 0, shot?.vy ?? 0)).toBeCloseTo(30, 6)
    // Turns to face the shot.
    expect(player.facing).toBe(1)
  })

  it('faces the way it shoots', () => {
    const world = createWorld(bareLevel())
    const player = spawnPlayer(world.level)
    player.facing = 1
    const middle = { x: player.x + PLAYER_W / 2, y: player.y + PLAYER_H / 2 }
    stepPlayer(player, world, input(keys('fire'), 5, -Infinity, { x: middle.x - 6, y: middle.y }), STEP)
    expect(player.facing).toBe(-1)
    expect(world.bullets[0]?.vx).toBeLessThan(0)
  })

  it('never lets continuous fire become flight', () => {
    // The nastiest case: hold fire in the air for ten seconds. Each shot lifts, but gravity and the
    // cooldown win, and the character has to come down.
    const { world, player } = ready()
    let clock = 0
    let apex = player.y
    let landed = false
    for (let step = 0; step * STEP < 10; step++) {
      clock += STEP
      stepPlayer(player, world, input(keys('fire', 'jump'), clock, clock), STEP)
      apex = Math.min(apex, player.y)
      if (clock > 3 && player.grounded) landed = true
    }
    expect(apex).toBeGreaterThanOrEqual(0)
    expect(apex).toBeLessThan(ROWS)
    expect(landed).toBe(true)
  })
})

describe('seededRandom', () => {
  it('produces the same sequence for the same seed', () => {
    const a = seededRandom(42)
    const b = seededRandom(42)
    expect([a(), a(), a()]).toEqual([b(), b(), b()])
    expect(seededRandom(43)()).not.toBe(seededRandom(42)())
  })
})

describe('slimes', () => {
  it('puts a couple of them on surfaces, clear of the opening columns', () => {
    for (const score of [0, 3, 20]) {
      const level = buildLevel(score)
      const wanted = Math.min(2 + Math.floor(score / 6), 5)
      expect(level.enemySpawns).toHaveLength(wanted)
      for (const spawn of level.enemySpawns) {
        const tx = Math.round(spawn.x)
        const ty = Math.round(spawn.y)
        // Standing room: the tile it is in is empty, and the one below is solid.
        expect(tileAt(level, tx, ty)).toBe(AIR)
        expect(isSolid(level, new Set(), tx, ty + 1)).toBe(true)
        // Never in the character's lap on the first frame.
        expect(tx).toBeGreaterThanOrEqual(6)
      }
    }
  })

  it('patrols a ledge and turns round rather than walking off it', () => {
    const world = createWorld(patrolLevel())
    world.enemies.push(enemyAt(4, 5)) // standing on the ledge at row 6
    const start = world.enemies[0]?.x ?? 0
    let turned = false

    for (let step = 0; step < 600; step++) {
      stepEnemies(world, STEP)
      const enemy = world.enemies[0]
      if (!enemy) break
      if (enemy.direction === -1) turned = true
      expect(enemy.x).toBeGreaterThanOrEqual(4)
      expect(enemy.x).toBeLessThanOrEqual(6)
    }
    expect(turned).toBe(true)
    expect(world.enemies[0]?.x).not.toBe(start)
  })

  it('falls to the surface under it', () => {
    const world = createWorld(bareLevel())
    world.enemies.push(enemyAt(8, 0))
    for (let step = 0; step < 400; step++) stepEnemies(world, STEP)
    expect(world.enemies[0]?.y).toBeCloseTo(ROWS - 2 - ENEMY_H, 6)
  })

  it('is killed by a shot, which is used up doing it', () => {
    const world = createWorld(bareLevel())
    world.enemies.push(enemyAt(15))
    const player = spawnPlayer(world.level)

    let clock = 0
    let kills = 0
    for (let step = 0; step < 200 && world.enemies.length > 0; step++) {
      clock += STEP
      kills += stepPlayer(player, world, input(keys('fire'), clock), STEP).kills
    }

    expect(kills).toBe(1)
    expect(world.enemies).toHaveLength(0)
    expect(world.bullets).toHaveLength(0)
  })

  it('is squashed by landing on it, which bounces the character', () => {
    const world = createWorld(bareLevel())
    world.enemies.push(enemyAt(14))
    const player = spawnPlayer(world.level)
    player.x = 14
    player.y = 6
    player.vy = 6

    let clock = 0
    let kills = 0
    for (let step = 0; step < 200 && world.enemies.length > 0; step++) {
      clock += STEP
      kills += stepPlayer(player, world, input(keys(), clock), STEP).kills
    }

    expect(kills).toBe(1)
    expect(player.vy).toBeLessThan(0) // thrown back up off it
    expect(player.hurtUntil).toBe(0) // and not hurt for the privilege
  })

  it('throws the character back when walked into, once, with a moment of immunity', () => {
    const world = createWorld(bareLevel())
    world.enemies.push(enemyAt(14))
    const player = spawnPlayer(world.level)
    player.x = 13.2

    let clock = 0
    let hurts = 0
    let recoilAtHit = 0
    // Walking right, straight into it, then standing in it while the immunity runs out.
    for (let step = 0; step * STEP < 0.6; step++) {
      clock += STEP
      if (stepPlayer(player, world, input(keys('right'), clock), STEP).hurt) {
        hurts += 1
        recoilAtHit = player.recoil
      }
    }

    expect(hurts).toBe(1)
    expect(recoilAtHit).toBeLessThan(0) // sent back the way it came
    expect(player.hurtUntil).toBeGreaterThan(clock - HURT_INVULNERABLE)
  })

  it('cannot hit again while the character is still recovering', () => {
    const world = createWorld(bareLevel())
    world.enemies.push(enemyAt(14))
    const player = spawnPlayer(world.level)
    player.x = 13.2

    let clock = 0
    let hurts = 0
    for (let step = 0; step * STEP < HURT_INVULNERABLE * 0.8; step++) {
      clock += STEP
      if (stepPlayer(player, world, input(keys('right'), clock), STEP).hurt) hurts += 1
    }
    expect(hurts).toBe(1)
  })
})

describe('materialTier', () => {
  it('climbs with the score', () => {
    expect(materialTier(0, 5)).toBe(0)
    expect(materialTier(1, 5)).toBe(0)
    expect(materialTier(2, 5)).toBe(1) // 40%
    expect(materialTier(3, 5)).toBe(1)
    expect(materialTier(4, 5)).toBe(2) // 80%
    expect(materialTier(19, 20)).toBe(2)
    expect(materialTier(5, 5)).toBe(3) // a clean sweep is diamond, whatever the length
    expect(materialTier(20, 20)).toBe(3)
  })

  it('does not divide by zero on an empty quiz', () => {
    expect(materialTier(0, 0)).toBe(0)
  })
})
