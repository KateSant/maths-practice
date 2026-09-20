/**
 * The world and the physics behind the mining reward: a one-screen platformer with a jetpack and a
 * gun that kicks like a mule.
 *
 * Deliberately outside the component. The things that can actually be wrong here - the level
 * generator, the collision resolution, the jetpack and the recoil - need no DOM, so they live here
 * where they can be driven by tests instead of by hand.
 */

export const COLS = 24
export const ROWS = 12

export const AIR = 0
export const GRASS = 1
export const DIRT = 2
export const STONE = 3
export const ORE = 4

/** Rows between one walkable surface and the next: every ledge is one jump above the last. */
export const LEDGE_GAP = 3

// Physics, in tiles and seconds.
export const MOVE_SPEED = 7.5
export const GRAVITY = 42
export const JUMP_SPEED = 18 // clears 3.86 tiles, comfortably more than LEDGE_GAP
export const MAX_FALL = 34

/** How far a plain jump lifts the character, which is the number LEDGE_GAP is measured against. */
export const JUMP_RISE = (JUMP_SPEED * JUMP_SPEED) / (2 * GRAVITY)

const JUMP_CUT = 7 // upward speed left when jump is released early
const COYOTE_TIME = 0.09
const JUMP_BUFFER = 0.14 // how early a jump press still counts when the character lands

export const PLAYER_W = 1
export const PLAYER_H = 1.5
export const STEP = 1 / 120
const EPSILON = 1e-6

// The jetpack. A duration rather than a speed limit is what stops it being a flight mode: the tank
// is worth about three quarters of a second of lift, and it tops a jump up to the next ledge or two
// without carrying the character to the ceiling.
//
// It also recharges in the air, which is what turns a fall into a glide - but not into flight. Two
// things keep it honest: firing needs a quarter tank to light, so a slow trickle cannot be milked
// one frame at a time, and by the time the trickle has lit the jet again the character is falling
// fast enough that a quarter tank only slows the descent. The cycle loses height every time.
export const JET_FUEL = 0.8
const JET_THRUST = 60 // tiles/s² against a gravity of 42
const JET_MAX_RISE = 7.5 // tiles/s: the jet holds a steady climb instead of accelerating
/** Fuel per second, standing on something. */
export const JET_GROUND_REFILL = 0.5
/** Fuel per second in the air: enough to light once more on the way down, not enough to hover. */
export const JET_AIR_REFILL = 0.45
/** Fraction of the tank needed to light. Once lit the jet runs until it is dry. */
const JET_IGNITION = 0.25

// The gun. The recoil is the point: it is deliberately much stronger than walking, so firing shoves
// the character two or three tiles backwards and pops them into the air. That makes it a movement
// tool as much as a mining one - and, with a cooldown, still not a way to fly.
export const GUN_COOLDOWN = 0.35
const RECOIL_SPEED = 16 // tiles/s, backwards
const RECOIL_LIFT = 9 // tiles/s, upwards
const RECOIL_DECAY = 45 // tiles/s² the shove is bled off at
const MAX_RECOIL_RISE = 24 // tiles/s, so stacked shots cannot launch the character off the board
const BULLET_SPEED = 30 // tiles/s
const MUZZLE_ORIGIN_Y = PLAYER_H / 2 // level with the gun
const MUZZLE_REACH = 0.55 // tiles the barrel sticks out from the middle of the character
/** How long the muzzle flash shows. */
export const MUZZLE_FLASH = 0.08
/** Also the size of the render pool, so live shots never outnumber the elements drawn. */
export const MAX_BULLETS = 8

// Slimes. They patrol a surface and turn at walls and edges. There is no health and no death: walk
// into one and you are thrown back, land on one and it is squashed, shoot one and it is gone. A
// reward level should have a threat, not a fail state.
export const ENEMY_W = 1
export const ENEMY_H = 1
export const ENEMY_SPEED = 2.4 // tiles/s
/** How long after a hit the character cannot be hit again. */
export const HURT_INVULNERABLE = 0.9
const ENEMY_KNOCKBACK = 14 // tiles/s, away from whatever hit them
const ENEMY_KNOCKBACK_LIFT = 10
const STOMP_BOUNCE = 12 // tiles/s, off the top of a squashed slime
const STOMP_TOLERANCE = 0.5 // how far into the top of a slime counts as landing on it

/**
 * The reward's material, by how the quiz went. The whole level is built from it, so a better score
 * means a visibly better-looking world: coal, then iron, then gold, then diamond for a clean sweep.
 */
export function materialTier(correctCount: number, questionCount: number): number {
  if (questionCount <= 0) return 0
  const accuracy = correctCount / questionCount
  if (accuracy >= 1) return 3
  if (accuracy >= 0.7) return 2
  if (accuracy >= 0.4) return 1
  return 0
}

export type Held = 'left' | 'right' | 'jump' | 'fire'

/** A horizontal run of tiles. `start` is inclusive, `end` exclusive. */
export interface Run {
  start: number
  end: number
}

export interface Level {
  tiles: number[]
  spawn: { x: number; y: number }
  oreCount: number
  /** Where the slimes start, in the order they are handed their ids. */
  enemySpawns: { x: number; y: number }[]
}

export interface Enemy {
  /** Stable across removals, so the render can keep one element per slime. */
  id: number
  x: number
  y: number
  vy: number
  direction: 1 | -1
}

export interface Bullet {
  x: number
  y: number
  vx: number
  vy: number
}

/** A point in tile coordinates that the gun is being pointed at. */
export interface AimPoint {
  x: number
  y: number
}

/** Everything the physics mutates besides the character. */
export interface World {
  level: Level
  mined: Set<number>
  bullets: Bullet[]
  enemies: Enemy[]
}

export interface Input {
  held: ReadonlySet<Held>
  /** Clock time of the last unconsumed jump press, or -Infinity. */
  jumpRequestedAt: number
  clock: number
  /** Where the gun is pointed, in tiles. Null fires along the way the character is facing. */
  aimPoint: AimPoint | null
}

export interface PlayerState {
  x: number
  y: number
  vx: number
  vy: number
  facing: 1 | -1
  grounded: boolean
  lastGroundedAt: number
  /** Seconds of jetpack left in the tank. */
  fuel: number
  /** Whether the jetpack is firing right now, for the flame and the sound. */
  thrusting: boolean
  /** Leftover shove from the gun, in tiles/s, bled off over a third of a second. */
  recoil: number
  /** Seconds until the gun can fire again. */
  gunCooldown: number
  /** Clock time the muzzle flash stops showing at. */
  muzzleUntil: number
  /** Where the last shot went, as a unit vector, for aiming the muzzle flash. */
  aimX: number
  aimY: number
  /** Clock time the character stops being knocked-back-and-invulnerable after a hit. */
  hurtUntil: number
}

/** Small deterministic generator, so a level is stable across renders but varies by score. */
export function seededRandom(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 0x100000000
  }
}

/**
 * A ground floor, one tier of ledges above it, and a shorter tier hanging off the ends of those
 * ledges. Every ledge is exactly LEDGE_GAP rows above a surface and starts where the ledge below
 * it finishes, so each one is one jump from the last. Ore goes only on a tile directly above
 * something solid, which means every ore is as reachable as the ledge it sits on.
 */
export function buildLevel(oreWanted: number): Level {
  const tiles = new Array<number>(COLS * ROWS).fill(AIR)
  const random = seededRandom(oreWanted * 7919 + 13)
  const surfaces: number[] = [] // tiles that hold ore: the air directly above solid ground

  // Ground: grass over stone. Flat and continuous, so a missed jump is only ever a short fall
  // onto it rather than a death.
  for (let x = 0; x < COLS; x++) {
    tiles[(ROWS - 2) * COLS + x] = GRASS
    tiles[(ROWS - 1) * COLS + x] = STONE
  }
  // Walls at both ends, so the level has edges the character cannot run off.
  for (let y = 0; y < ROWS; y++) {
    tiles[y * COLS] = STONE
    tiles[y * COLS + COLS - 1] = STONE
  }

  // The ground is clear of ore for the first few columns, so the level does not open with an ore
  // already inside the character.
  for (let x = 4; x < COLS - 1; x++) surfaces.push((ROWS - 3) * COLS + x)

  // Tier one: ledges spread along the ground, one to three columns apart. They start clear of the
  // first few columns, so the character spawns with headroom to jump in rather than in a pocket
  // under a ledge.
  const CLEAR_AT_SPAWN = 4
  const firstTier: Run[] = []
  let x = CLEAR_AT_SPAWN + Math.floor(random() * 2)
  while (x < COLS - 4) {
    const length = 3 + Math.floor(random() * 3)
    firstTier.push({ start: x, end: Math.min(x + length, COLS - 1) })
    x += length + 1 + Math.floor(random() * 2)
  }

  // Tier two: a shorter ledge hanging off one end of a tier-one ledge, never over the top of it.
  // Which end alternates so the level zig-zags, and hanging off the end rather than sitting above
  // is what stops a jump from being cut short by a ceiling directly over the character's head.
  const secondTier: Run[] = []
  firstTier.forEach((ledge, index) => {
    if (random() < 0.3) return
    const length = 2 + Math.floor(random() * 3)
    const start = index % 2 === 0 ? ledge.start - 1 - length : ledge.end
    const end = start + length
    if (start < CLEAR_AT_SPAWN || end > COLS - 1) return
    secondTier.push({ start, end })
  })

  const tiers: Run[][] = [firstTier, secondTier]
  tiers.forEach((runs, tier) => {
    const row = ROWS - 2 - LEDGE_GAP * (tier + 1)
    for (const run of runs) {
      for (let column = run.start; column < run.end; column++) {
        tiles[row * COLS + column] = STONE
        surfaces.push((row - 1) * COLS + column)
      }
    }
  })

  const spots = [...new Set(surfaces)].filter((index) => tiles[index] === AIR)
  const shuffled = spots
    .map((index) => ({ index, order: random() }))
    .sort((a, b) => a.order - b.order)
  // At least one ore whatever the score: a reward that only appears to the successful is not
  // much of a reward, and for a demo it should always be visible.
  const oreCount = Math.min(Math.max(oreWanted, 1), shuffled.length)
  for (const { index } of shuffled.slice(0, oreCount)) tiles[index] = ORE

  // Slimes go on the same kind of surface the ore does, but only where the ore did not land and
  // well clear of the opening columns, so the level does not start with one in the character's lap.
  const enemyWanted = Math.min(2 + Math.floor(oreWanted / 6), 5)
  const enemySpawns = spots
    .filter((index) => tiles[index] === AIR && index % COLS >= 6)
    .map((index) => ({ index, order: random() }))
    .sort((a, b) => a.order - b.order)
    .slice(0, enemyWanted)
    .map(({ index }) => ({ x: index % COLS, y: Math.floor(index / COLS) - (ENEMY_H - 1) }))

  return {
    tiles,
    spawn: { x: 2, y: ROWS - 2 - PLAYER_H },
    oreCount,
    enemySpawns,
  }
}

export function createWorld(level: Level): World {
  return {
    level,
    mined: new Set(),
    bullets: [],
    // Alternate the starting directions, so a fresh level does not look like a parade.
    enemies: level.enemySpawns.map((spawn, id) => ({
      id,
      x: spawn.x,
      y: spawn.y,
      vy: 0,
      direction: id % 2 === 0 ? 1 : -1,
    })),
  }
}

export function spawnPlayer(level: Level): PlayerState {
  return {
    ...level.spawn,
    vx: 0,
    vy: 0,
    facing: 1,
    grounded: false,
    lastGroundedAt: -Infinity,
    fuel: JET_FUEL,
    thrusting: false,
    recoil: 0,
    gunCooldown: 0,
    muzzleUntil: 0,
    aimX: 1,
    aimY: 0,
    hurtUntil: 0,
  }
}

export function tileAt(level: Level, tx: number, ty: number): number {
  if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return AIR
  return level.tiles[ty * COLS + tx] ?? AIR
}

/**
 * The aim as a unit vector: from the middle of the character towards the pointer. Falls back to the
 * way the character is facing, so the keyboard can fire without a mouse.
 */
export function aimDirection(player: PlayerState, aimPoint: AimPoint | null): { x: number; y: number } {
  if (!aimPoint) return { x: player.facing, y: 0 }
  const dx = aimPoint.x - (player.x + PLAYER_W / 2)
  const dy = aimPoint.y - (player.y + MUZZLE_ORIGIN_Y)
  const length = Math.hypot(dx, dy)
  // Pointing at your own middle has no direction: shoot the way you are facing instead.
  if (length < 0.001) return { x: player.facing, y: 0 }
  return { x: dx / length, y: dy / length }
}

/** Where the shot leaves the barrel, pushed out from the character along the aim. */
export function muzzlePosition(
  player: PlayerState,
  direction: { x: number; y: number },
): { x: number; y: number } {
  return {
    x: player.x + PLAYER_W / 2 + direction.x * MUZZLE_REACH,
    y: player.y + MUZZLE_ORIGIN_Y + direction.y * MUZZLE_REACH,
  }
}

/** Whether a tile stops the character, once mined ore is taken into account. */
export function isSolid(level: Level, mined: ReadonlySet<number>, tx: number, ty: number): boolean {
  if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return false
  const index = ty * COLS + tx
  if (mined.has(index)) return false
  return (level.tiles[index] ?? AIR) !== AIR
}

/**
 * Walks the slimes. Kept separate from stepping the character: they are independent of it, and a
 * test can drive a patrol without inventing a player to go with it.
 */
export function stepEnemies(world: World, dt: number): void {
  const { level, mined, enemies } = world
  for (const enemy of enemies) {
    // Settle onto whatever is underneath first, so the surface checks below are at the right height.
    enemy.vy = Math.min(enemy.vy + GRAVITY * dt, MAX_FALL)
    enemy.y += enemy.vy * dt
    const supportRow = Math.floor(enemy.y + ENEMY_H)
    if (isSolid(level, mined, Math.floor(enemy.x), supportRow)) {
      enemy.y = supportRow - ENEMY_H
      enemy.vy = 0
    }

    // Walk, turning at a wall and at the end of the surface it is on rather than walking off it.
    const step = enemy.direction * ENEMY_SPEED * dt
    const frontX = Math.floor(enemy.direction > 0 ? enemy.x + ENEMY_W - EPSILON + step : enemy.x + step)
    const bodyRow = Math.floor(enemy.y)
    const feetRow = Math.floor(enemy.y + ENEMY_H)
    const wallAhead = isSolid(level, mined, frontX, bodyRow)
    const floorAhead = isSolid(level, mined, frontX, feetRow)
    if (wallAhead || !floorAhead) enemy.direction = enemy.direction > 0 ? -1 : 1
    else enemy.x += step
  }
}

export interface StepOutcome {
  /** Ore collected during this step, for the caller to fold into its state. */
  minedNow: number[]
  /** True when a requested jump was spent, so the caller can clear its latch. */
  jumped: boolean
  /** Downward speed at the moment of landing on this step, or 0. Drives the thud. */
  impact: number
  /** True when the gun went off, for the bang. */
  fired: boolean
  /** Slimes killed this step, for the squelch. */
  kills: number
  /** True when a slime landed a hit on the character. */
  hurt: boolean
}

/**
 * Advances one fixed step. Mutates the player and the world rather than returning new copies: this
 * runs 120 times a second, and allocating per step is pure waste.
 */
export function stepPlayer(player: PlayerState, world: World, input: Input, dt: number): StepOutcome {
  const { level, mined, bullets, enemies } = world
  const { held, clock } = input
  const minedNow: number[] = []
  let jumped = false
  let impact = 0
  let kills = 0
  /** True when the tile stops the character. Ore is mined on contact and stops blocking in the
   *  same breath, which is precisely what makes walking into it mine it. */
  const blocks = (tx: number, ty: number) => {
    if (!isSolid(level, mined, tx, ty)) return false
    const index = ty * COLS + tx
    if (level.tiles[index] === ORE) {
      mined.add(index)
      minedNow.push(index)
      return false
    }
    return true
  }

  // Walking is set by the keys; recoil is a separate shove that bleeds off, so the character sails
  // backwards out of control for a moment and then gets their feet back.
  const walking = (held.has('right') ? MOVE_SPEED : 0) - (held.has('left') ? MOVE_SPEED : 0)
  // Facing follows the keys, never the recoil - otherwise holding fire would see the character
  // spin round and shoot the other way the moment the kick landed.
  if (walking !== 0) player.facing = walking > 0 ? 1 : -1
  player.recoil = moveToward(player.recoil, 0, RECOIL_DECAY * dt)
  player.vx = walking + player.recoil

  // Coyote time, and a jump press that survives being a moment early: both are the difference
  // between a jump that feels broken and one that does not. Both windows are one-sided, so a
  // timestamp from a different clock base - a level reset, say - cannot grant a free jump.
  const sincePress = clock - input.jumpRequestedAt
  const sinceGround = clock - player.lastGroundedAt
  const wantedJump = sincePress >= 0 && sincePress <= JUMP_BUFFER
  const onGroundRecently = player.grounded || (sinceGround >= 0 && sinceGround < COYOTE_TIME)
  if (wantedJump && onGroundRecently) {
    jumped = true
    player.vy = -JUMP_SPEED
    player.grounded = false
  }
  // Releasing jump early cuts the arc short, which is what makes small hops possible.
  if (!held.has('jump') && player.vy < -JUMP_CUT) player.vy = -JUMP_CUT

  player.vy = Math.min(player.vy + GRAVITY * dt, MAX_FALL)

  // The jetpack, held in the air. It only boosts up to its own steady climb, so a fresh jump keeps
  // its speed and the jet takes over as gravity slows it - which reads as a jump, then a burst.
  //
  // Lighting needs a quarter tank; once lit it runs until dry. That hysteresis is the whole reason
  // the air trickle does not become a hover: with a bare sliver of fuel the jet stays off and the
  // character keeps falling.
  const wantsJet = held.has('jump') && !player.grounded
  player.thrusting = wantsJet && (player.thrusting ? player.fuel > 0 : player.fuel >= JET_FUEL * JET_IGNITION)
  if (player.thrusting) {
    player.fuel = Math.max(0, player.fuel - dt)
    if (player.vy > -JET_MAX_RISE) {
      player.vy = Math.max(player.vy - JET_THRUST * dt, -JET_MAX_RISE)
    }
  } else {
    const refill = player.grounded ? JET_GROUND_REFILL : JET_AIR_REFILL
    player.fuel = Math.min(JET_FUEL, player.fuel + refill * dt)
  }

  player.gunCooldown = Math.max(0, player.gunCooldown - dt)
  const fired = held.has('fire') && player.gunCooldown <= 0 && bullets.length < MAX_BULLETS
  if (fired) {
    // Pointed with the mouse, or straight ahead on the keyboard.
    const direction = aimDirection(player, input.aimPoint)
    const muzzle = muzzlePosition(player, direction)
    player.aimX = direction.x
    player.aimY = direction.y
    // Turn to face the shot, so the sprite agrees with where the bullet went.
    if (Math.abs(direction.x) > 0.2) player.facing = direction.x > 0 ? 1 : -1

    player.gunCooldown = GUN_COOLDOWN
    player.muzzleUntil = clock + MUZZLE_FLASH
    // The kick is exactly opposite the shot, and every shot also lifts the muzzle a little. Aim
    // down and the recoil throws the character up; aim up and it slams them down.
    player.recoil = -direction.x * RECOIL_SPEED
    player.vy = Math.max(player.vy - direction.y * RECOIL_SPEED - RECOIL_LIFT, -MAX_RECOIL_RISE)
    bullets.push({
      x: muzzle.x,
      y: muzzle.y,
      vx: direction.x * BULLET_SPEED,
      vy: direction.y * BULLET_SPEED,
    })
  }

  // One axis at a time, then push out of whatever was hit. The row the feet are exactly resting
  // on is narrowed by an epsilon so a floor is not mistaken for a wall.
  const rowsTop = Math.floor(player.y)
  const rowsBottom = Math.floor(player.y + PLAYER_H - EPSILON)

  player.x += player.vx * dt
  if (player.vx !== 0) {
    const tx = Math.floor(player.vx > 0 ? player.x + PLAYER_W - EPSILON : player.x)
    for (let ty = rowsTop; ty <= rowsBottom; ty++) {
      if (blocks(tx, ty)) {
        player.x = player.vx > 0 ? tx - PLAYER_W : tx + 1
        break
      }
    }
  }

  // Falling looks at the row the feet are entering - not narrowed by an epsilon, so resting
  // contact is still a collision and the character stays grounded rather than sinking a pixel.
  // The approach speed is kept first: landing on the floor zeroes it, and a slime on the floor has
  // to tell "dropped on top of it" from "walked into it" after that has happened.
  const falling = player.vy > 0
  player.y += player.vy * dt
  player.grounded = false
  const columnsLeft = Math.floor(player.x)
  const columnsRight = Math.floor(player.x + PLAYER_W - EPSILON)
  if (player.vy > 0) {
    const ty = Math.floor(player.y + PLAYER_H)
    for (let tx = columnsLeft; tx <= columnsRight; tx++) {
      if (blocks(tx, ty)) {
        impact = player.vy
        player.y = ty - PLAYER_H
        player.vy = 0
        player.grounded = true
        break
      }
    }
  } else if (player.vy < 0) {
    const ty = Math.floor(player.y)
    for (let tx = columnsLeft; tx <= columnsRight; tx++) {
      if (blocks(tx, ty)) {
        player.y = ty + 1
        player.vy = 0
        break
      }
    }
  }

  // Invisible ceiling at the top of the board: a big jump from the highest ledge would otherwise
  // push the sprite out of the level, where it gets clipped.
  if (player.y < 0) {
    player.y = 0
    player.vy = Math.max(player.vy, 0)
  }

  if (player.grounded) player.lastGroundedAt = clock

  // Slimes. Landing on one squashes it and bounces the character; anything else is a hit, which
  // throws them clear and buys a moment of immunity so one slime cannot land a dozen hits.
  let hurt = false
  for (let index = enemies.length - 1; index >= 0; index--) {
    const enemy = enemies[index]
    if (!enemy) continue
    const overlaps =
      player.x + PLAYER_W > enemy.x &&
      player.x < enemy.x + ENEMY_W &&
      player.y + PLAYER_H > enemy.y &&
      player.y < enemy.y + ENEMY_H
    if (!overlaps) continue

    const squashedIt = falling && player.y + PLAYER_H - enemy.y <= STOMP_TOLERANCE
    if (squashedIt) {
      enemies.splice(index, 1)
      kills += 1
      player.vy = -STOMP_BOUNCE
      player.grounded = false
      continue
    }
    if (player.hurtUntil > clock) continue

    const away = player.x + PLAYER_W / 2 < enemy.x + ENEMY_W / 2 ? -1 : 1
    player.recoil = away * ENEMY_KNOCKBACK
    player.vy = Math.max(player.vy - ENEMY_KNOCKBACK_LIFT, -MAX_RECOIL_RISE)
    player.hurtUntil = clock + HURT_INVULNERABLE
    hurt = true
  }

  // Shots fly flat and stop at the first solid thing. Ore is what the gun is for; stone just stops
  // it, which keeps the level's shape intact.
  for (let index = bullets.length - 1; index >= 0; index--) {
    const bullet = bullets[index]
    if (!bullet) continue
    bullet.x += bullet.vx * dt
    bullet.y += bullet.vy * dt
    const tx = Math.floor(bullet.x)
    const ty = Math.floor(bullet.y)
    if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) {
      bullets.splice(index, 1)
      continue
    }
    const struck = enemies.findIndex(
      (enemy) =>
        bullet.x >= enemy.x &&
        bullet.x <= enemy.x + ENEMY_W &&
        bullet.y >= enemy.y &&
        bullet.y <= enemy.y + ENEMY_H,
    )
    if (struck >= 0) {
      enemies.splice(struck, 1)
      kills += 1
      bullets.splice(index, 1)
      continue
    }
    if (!isSolid(level, mined, tx, ty)) continue
    if (level.tiles[ty * COLS + tx] === ORE) {
      mined.add(ty * COLS + tx)
      minedNow.push(ty * COLS + tx)
    }
    bullets.splice(index, 1)
  }

  return { minedNow, jumped, impact, fired, kills, hurt }
}

function moveToward(value: number, target: number, amount: number): number {
  if (value > target) return Math.max(target, value - amount)
  return Math.min(target, value + amount)
}
