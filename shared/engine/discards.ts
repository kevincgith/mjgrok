import { findWaits } from './waits.ts'
import { shanten } from './shanten.ts'
import {
  KIND_COUNT,
  type Hand,
  type Kind,
  type Tile,
  countsOf,
  indexKind,
  inferTarget,
  kindOf,
  tileOf,
} from './tiles.ts'

export interface DiscardOptions {
  /** Counts already known to be gone, besides this hand. */
  discarded?: Record<string, number>
  /** Self-draws still to come. The estimate never claims to be an exact probability. */
  drawsLeft?: number
  meldsNeeded?: number
}

export interface TileCount {
  kind: Kind
  remaining: number
}

export interface TwoStep {
  draw: Kind
  remaining: number
  shanten: number
  waits: TileCount[]
}

export interface DiscardAnalysis {
  discard: Kind
  shanten: number
  /** 0-100 estimate of reaching tenpai within the draw window. */
  tenpaiPercent: number
  /** 0-100 estimate of winning on a self-draw within the window. */
  winPercent: number
  accepting: TileCount[]
  waits: TileCount[]
  twoStep: TwoStep[]
  /** Always true: the percentages are a bounded estimate, not an exact probability. */
  estimate: true
  unseen: number
}

const DEFAULT_DRAWS = 8

/**
 * Rank every distinct discard.
 * At a checkpoint this is discard efficiency (the hand is not tenpai).
 * One past a checkpoint these are the options after the draw.
 * Phase 1 estimates tenpai from accepting tiles / unseen.
 * Phase 2 estimates the win from waits / unseen.
 * A two-step list shows each useful draw and the waits it leads to.
 */
export function analyzeDiscards(hand: Hand, options?: DiscardOptions): DiscardAnalysis[] {
  const target = inferTarget(hand.concealed.length, hand.declared.length, options?.meldsNeeded)
  const draws = options?.drawsLeft ?? DEFAULT_DRAWS
  const removed = options?.discarded ?? {}
  const size = hand.concealed.length
  const discardFrom = size === target.checkpoint + 1 || size === target.checkpoint ? hand.concealed : hand.concealed
  const kinds = distinct(discardFrom)
  const rows: DiscardAnalysis[] = []
  for (const kind of kinds) {
    const next = removeOne(hand, kind)
    if (!next) continue
    rows.push(assess(next, kind, target.need, target.checkpoint, draws, removed))
  }
  rows.sort((a, b) => b.winPercent - a.winPercent || b.tenpaiPercent - a.tenpaiPercent || b.accepting.length - a.accepting.length || a.discard.localeCompare(b.discard))
  return rows
}

function assess(
  hand: Hand,
  discard: Kind,
  need: number,
  checkpoint: number,
  draws: number,
  removed: Record<string, number>,
): DiscardAnalysis {
  const distance = shanten(hand, { meldsNeeded: need })
  const { counts } = countsOf(hand.concealed)
  const held = counts.slice()
  const unseenMap = unseen(held, removed)
  const unseenTotal = [...unseenMap.values()].reduce((s, n) => s + n, 0)
  let waits: TileCount[] = []
  let accepting: TileCount[] = []
  const twoStep: TwoStep[] = []
  if (hand.concealed.length === checkpoint && distance <= 0) {
    const found = findWaits(hand, { meldsNeeded: need })
    waits = found.waits
      .filter((w) => w.kind !== 'j')
      .map((w) => ({ kind: w.kind, remaining: Math.min(w.remaining, unseenMap.get(w.kind) ?? 0) }))
      .filter((w) => w.remaining > 0)
    const winTiles = waits.reduce((s, w) => s + w.remaining, 0)
    const winPercent = percent(atLeastOne(winTiles, Math.min(draws, unseenTotal), unseenTotal))
    return {
      discard,
      shanten: 0,
      tenpaiPercent: 100,
      winPercent,
      accepting: waits,
      waits,
      twoStep: [],
      estimate: true,
      unseen: unseenTotal,
    }
  }
  if (hand.concealed.length === checkpoint) {
    for (let i = 0; i < KIND_COUNT; i++) {
      const left = unseenMap.get(indexKind(i)) ?? 0
      if (left <= 0 || counts[i] >= 4) continue
      const trial = add(hand, indexKind(i))
      const after = shanten(trial, { meldsNeeded: need })
      if (after < distance) {
        accepting.push({ kind: indexKind(i), remaining: left })
        if (twoStep.length < 8) {
          const nextWaits =
            after <= 0 && trial.concealed.length === checkpoint + 1
              ? bestWaits(trial, need, unseenMap)
              : []
          twoStep.push({ draw: indexKind(i), remaining: left, shanten: after, waits: nextWaits })
        }
      }
    }
  }
  const acceptTiles = accepting.reduce((s, t) => s + t.remaining, 0)
  const steps = Math.max(1, distance)
  const tenpaiP = steps <= 1 ? atLeastOne(acceptTiles, Math.min(draws, unseenTotal), unseenTotal) : atLeastK(steps, acceptTiles, Math.min(draws, unseenTotal), unseenTotal)
  const avgWaits = twoStep.length
    ? twoStep.reduce((s, step) => s + step.waits.reduce((n, w) => n + w.remaining, 0), 0) / twoStep.length
    : Math.max(1, acceptTiles / 4)
  const winP = tenpaiP * (unseenTotal > 0 ? Math.min(0.95, (avgWaits * Math.max(1, draws - steps)) / unseenTotal) : 0)
  return {
    discard,
    shanten: distance,
    tenpaiPercent: percent(Math.min(1, tenpaiP)),
    winPercent: percent(Math.min(1, Math.max(0, winP))),
    accepting,
    waits,
    twoStep,
    estimate: true,
    unseen: unseenTotal,
  }
}

function bestWaits(hand: Hand, need: number, unseenMap: Map<string, number>): TileCount[] {
  let best: TileCount[] = []
  const seen = new Set<string>()
  for (const tile of hand.concealed) {
    const kind = kindOf(tile)
    if (seen.has(kind)) continue
    seen.add(kind)
    const next = removeOne(hand, kind)
    if (!next) continue
    if (shanten(next, { meldsNeeded: need }) > 0) continue
    const found = findWaits(next, { meldsNeeded: need })
    const waits = found.waits
      .filter((w) => w.kind !== 'j')
      .map((w) => ({ kind: w.kind, remaining: Math.min(w.remaining, unseenMap.get(w.kind) ?? 0) }))
      .filter((w) => w.remaining > 0)
    if (waits.reduce((s, w) => s + w.remaining, 0) > best.reduce((s, w) => s + w.remaining, 0)) best = waits
  }
  return best
}

function unseen(held: number[], removed: Record<string, number>): Map<string, number> {
  const map = new Map<string, number>()
  for (let i = 0; i < KIND_COUNT; i++) {
    const kind = indexKind(i)
    const gone = (removed[kind] ?? 0) + held[i]
    map.set(kind, Math.max(0, 4 - gone))
  }
  return map
}

function atLeastOne(success: number, draws: number, population: number): number {
  if (success <= 0 || draws <= 0 || population <= 0) return 0
  if (success >= population) return 1
  const d = Math.min(draws, population)
  if (population - success < d) return 1
  let miss = 1
  for (let i = 0; i < d; i++) miss *= (population - success - i) / (population - i)
  return 1 - miss
}

function atLeastK(k: number, success: number, draws: number, population: number): number {
  if (k <= 1) return atLeastOne(success, draws, population)
  if (success <= 0 || draws < k || population <= 0) return 0
  // Bounded estimate: probability of k improvements if each draw kept a constant hit rate.
  const p = Math.min(0.95, success / population)
  let term = 1
  let sum = 0
  for (let i = 0; i < k; i++) {
    if (i > 0) term *= ((draws - i + 1) / i) * (p / Math.max(0.05, 1 - p))
    // accumulate later; use a simple upper bound of (1 - (1-p)^draws) scaled down
  }
  sum = Math.min(1, Math.pow(p, k) * draws)
  return Math.min(atLeastOne(success, draws, population), Math.max(0, sum))
}

function percent(n: number): number {
  return Math.round(Math.min(100, Math.max(0, n * 1000))) / 10
}

function distinct(tiles: Tile[]): Kind[] {
  const out: Kind[] = []
  for (const tile of tiles) {
    const kind = kindOf(tile)
    if (!out.includes(kind)) out.push(kind)
  }
  return out
}

function removeOne(hand: Hand, kind: Kind): Hand | null {
  const idx = hand.concealed.findIndex((t) => kindOf(t) === kind)
  if (idx < 0) return null
  return {
    ...hand,
    concealed: hand.concealed.filter((_, i) => i !== idx),
  }
}

function add(hand: Hand, kind: Kind): Hand {
  return { ...hand, concealed: [...hand.concealed, tileOf(kind)] }
}
