/**
 * Chiptune sound effects for the reward, synthesised rather than loaded: there is nothing to ship,
 * nothing to fail to fetch, and a jump, a clink and a jetpack are a handful of oscillators each.
 *
 * The sounds are only ever triggered by a key press or a click, which is exactly the gesture
 * browsers need before they will start audio - so the context is created on first use and never
 * blocked in practice.
 */

let context: AudioContext | null = null

/** One context for the page, shared by every mount: browsers cap how many a page may have. */
function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return null
  try {
    context ??= new Ctor()
  } catch {
    return null // Some privacy modes refuse audio outright.
  }
  if (context.state === 'suspended') void context.resume()
  return context
}

const SOUND_KEY = 'realmaths.sound'

/** Muting is remembered, because a game that shouts again on every navigation is a game people
 *  turn off. Wrapped in try/catch for the same reason the token is: localStorage throws in some
 *  privacy modes, and losing a preference is not worth an error. */
export function readSoundOn(): boolean {
  try {
    return localStorage.getItem(SOUND_KEY) !== 'off'
  } catch {
    return true
  }
}

export function writeSoundOn(on: boolean): void {
  try {
    localStorage.setItem(SOUND_KEY, on ? 'on' : 'off')
  } catch {
    // Non-fatal: the choice just will not outlive the tab.
  }
}

export interface Sounds {
  setMuted(muted: boolean): void
  jump(): void
  mine(): void
  land(impact: number): void
  /** Called every frame; only acts when the jetpack starts or stops firing. */
  thrust(active: boolean): void
  shoot(): void
  /** A slime squashed. */
  squash(): void
  /** A slime landing one on the character. */
  hurt(): void
  fanfare(): void
}

interface Blip {
  from: number
  to?: number
  duration?: number
  type?: OscillatorType
  gain?: number
  delay?: number
}

/** A second of white noise, built once and reused: it is the body of both the jetpack and the gun. */
let noise: AudioBuffer | null = null
function noiseBuffer(ctx: AudioContext): AudioBuffer {
  if (noise) return noise
  noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
  const samples = noise.getChannelData(0)
  for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1
  return noise
}

export function createSounds(): Sounds {
  let muted = false
  let jet: { source: AudioBufferSourceNode; gain: GainNode } | null = null

  const blip = ({ from, to, duration = 0.1, type = 'square', gain = 0.07, delay = 0 }: Blip) => {
    const ctx = muted ? null : audio()
    if (!ctx) return
    const start = ctx.currentTime + delay
    const oscillator = ctx.createOscillator()
    const envelope = ctx.createGain()

    oscillator.type = type
    oscillator.frequency.setValueAtTime(from, start)
    if (to) oscillator.frequency.exponentialRampToValueAtTime(to, start + duration)

    // Instant attack, quick decay: enough to read as a blip rather than a click, and short enough
    // that a jump and a mine landing on the same frame still sound like two things.
    envelope.gain.setValueAtTime(0.0001, start)
    envelope.gain.exponentialRampToValueAtTime(gain, start + 0.01)
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration)

    oscillator.connect(envelope)
    envelope.connect(ctx.destination)
    oscillator.start(start)
    oscillator.stop(start + duration + 0.03)
  }

  const stopJet = () => {
    if (!jet) return
    const ctx = audio()
    const { source, gain } = jet
    jet = null
    if (ctx) {
      gain.gain.cancelScheduledValues(ctx.currentTime)
      gain.gain.setValueAtTime(Math.max(gain.gain.value, 0.0001), ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.08)
      source.stop(ctx.currentTime + 0.12)
      return
    }
    try {
      source.stop()
    } catch {
      // Already stopped; nothing to do.
    }
  }

  const startJet = () => {
    const ctx = muted ? null : audio()
    if (!ctx || jet) return

    // Looped and low-passed: a hiss rather than a tone, which is what reads as escaping gas.
    const source = ctx.createBufferSource()
    source.buffer = noiseBuffer(ctx)
    source.loop = true

    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 900

    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.0001, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.045, ctx.currentTime + 0.06)

    source.connect(filter)
    filter.connect(gain)
    gain.connect(ctx.destination)
    source.start()
    jet = { source, gain }
  }

  return {
    setMuted(next: boolean) {
      muted = next
      if (next) stopJet()
    },
    jump: () => blip({ from: 340, to: 620, duration: 0.11 }),
    mine: () => {
      blip({ from: 880, duration: 0.05 })
      blip({ from: 1320, duration: 0.12, delay: 0.045 })
    },
    // Heavier landings are lower and shorter, so a hop and a long drop do not sound the same.
    land: (impact) =>
      blip({ from: Math.max(70, 150 - impact * 2), to: 60, duration: 0.09, type: 'triangle', gain: 0.05 }),
    thrust: (active) => {
      if (active) startJet()
      else stopJet()
    },
    // A crack of noise over a falling tone: the body of the bang, then the pitch of the kick.
    shoot: () => {
      blip({ from: 760, to: 90, duration: 0.13, gain: 0.09 })
      blip({ from: 210, to: 55, duration: 0.1, type: 'triangle', gain: 0.07 })
      const ctx = muted ? null : audio()
      if (!ctx) return
      const source = ctx.createBufferSource()
      source.buffer = noiseBuffer(ctx)
      const crack = ctx.createBiquadFilter()
      crack.type = 'bandpass'
      crack.frequency.value = 1800
      const envelope = ctx.createGain()
      envelope.gain.setValueAtTime(0.12, ctx.currentTime)
      envelope.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.06)
      source.connect(crack)
      crack.connect(envelope)
      envelope.connect(ctx.destination)
      source.start()
      source.stop(ctx.currentTime + 0.08)
    },
    // Wet and downward: a splat rather than a tone.
    squash: () => {
      blip({ from: 420, to: 70, duration: 0.16, type: 'triangle', gain: 0.09 })
      blip({ from: 180, to: 50, duration: 0.2, type: 'sawtooth', gain: 0.05 })
      const ctx = muted ? null : audio()
      if (!ctx) return
      const source = ctx.createBufferSource()
      source.buffer = noiseBuffer(ctx)
      const splat = ctx.createBiquadFilter()
      splat.type = 'lowpass'
      splat.frequency.value = 700
      const envelope = ctx.createGain()
      envelope.gain.setValueAtTime(0.09, ctx.currentTime)
      envelope.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.12)
      source.connect(splat)
      splat.connect(envelope)
      envelope.connect(ctx.destination)
      source.start()
      source.stop(ctx.currentTime + 0.14)
    },
    // Two flat low notes: unmistakably "that was a mistake".
    hurt: () => {
      blip({ from: 150, to: 110, duration: 0.12, type: 'square', gain: 0.07 })
      blip({ from: 110, to: 80, duration: 0.16, delay: 0.1, type: 'square', gain: 0.07 })
    },
    fanfare: () => [523, 659, 784, 1046].forEach((note, index) => blip({ from: note, duration: 0.18, delay: index * 0.085, gain: 0.06 })),
  }
}
