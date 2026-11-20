import { isCompleteCounts, shanten, shantenByBestDiscard } from './shanten.ts'
import {
  KIND_COUNT,
  type Hand,
  type Kind,
  type Tile,
  countsOf,
  declaredCounts,
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
  /** Return no rows once this becomes true, so a stale worker request can stop. */
  aborted?: () => boolean
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
    if (options?.aborted?.()) return []
    const next = removeOne(hand, kind)
    if (!next) continue
    rows.push(assess(next, kind, target.need, target.checkpoint, draws, removed, hand.declared.length === 0 && target.need === 5))
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
  specials: boolean,
): DiscardAnalysis {
  const distance = shanten(hand, { meldsNeeded: need })
  const { counts, jokers } = countsOf(hand.concealed)
  const held = counts.slice()
  const declared = declaredCounts(hand)
  for (let i = 0; i < KIND_COUNT; i++) held[i] += declared[i]
  const unseenMap = unseen(held, removed)
  const unseenTotal = [...unseenMap.values()].reduce((s, n) => s + n, 0)
  let waits: TileCount[] = []
  let accepting: TileCount[] = []
  const twoStep: TwoStep[] = []
  if (hand.concealed.length === checkpoint && distance <= 0) {
    waits = waitCounts(counts, jokers, need, specials, held, unseenMap)
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
      if (left <= 0 || held[i] >= 4) continue
      counts[i] += 1
      const improved = shantenByBestDiscard(counts, jokers, need, checkpoint, specials, distance - 1) < distance
      let after = distance
      let nextWaits: TileCount[] = []
      if (improved && twoStep.length < 8) {
        after = shantenByBestDiscard(counts, jokers, need, checkpoint, specials, -1)
        if (after <= 0) nextWaits = bestWaits(counts, jokers, need, specials, hand.declared, declared, unseenMap)
      }
      counts[i] -= 1
      if (improved) {
        accepting.push({ kind: indexKind(i), remaining: left })
        if (twoStep.length < 8) twoStep.push({ draw: indexKind(i), remaining: left, shanten: after, waits: nextWaits })
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

function waitCounts(counts: number[], jokers: number, need: number, specials: boolean, held: number[], unseenMap: Map<string, number>): TileCount[] {
  const waits: TileCount[] = []
  for (let i = 0; i < KIND_COUNT; i++) {
    if (counts[i] >= 4) continue
    counts[i] += 1
    const wins = isCompleteCounts(counts, jokers, need, specials)
    counts[i] -= 1
    if (!wins) continue
    const kind = indexKind(i)
    const remaining = Math.min(Math.max(0, 4 - held[i]), unseenMap.get(kind) ?? 0)
    if (remaining > 0) waits.push({ kind, remaining })
  }
  return waits
}

/** Waits after the tenpai discard that leaves the most tiles out. Same tiles findWaits would name, without building every meld. */
function bestWaits(counts: number[], jokers: number, need: number, specials: boolean, melds: Hand['declared'], declared: number[], unseenMap: Map<string, number>): TileCount[] {
  let best: TileCount[] = []
  let bestTotal = -1
  const consider = (nextJokers: number) => {
    const distance = shanten(handFromCounts(counts, nextJokers, melds), { meldsNeeded: need })
    if (distance > 0) return
    const held = counts.slice()
    for (let k = 0; k < KIND_COUNT; k++) held[k] += declared[k]
    const waits = waitCounts(counts, nextJokers, need, specials, held, unseenMap)
    const total = waits.reduce((s, w) => s + w.remaining, 0)
    if (total > bestTotal) {
      best = waits
      bestTotal = total
    }
  }
  for (let i = 0; i < KIND_COUNT; i++) {
    if (!counts[i]) continue
    counts[i] -= 1
    consider(jokers)
    counts[i] += 1
  }
  if (jokers > 0) consider(jokers - 1)
  return best
}

function handFromCounts(counts: number[], jokers: number, melds: Hand['declared']): Hand {
  const concealed: Tile[] = []
  for (let i = 0; i < KIND_COUNT; i++) for (let n = 0; n < counts[i]; n++) concealed.push(tileOf(indexKind(i)))
  for (let n = 0; n < jokers; n++) concealed.push({ suit: 'j', rank: 0 })
  return { concealed, declared: melds, flowers: [] }
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
