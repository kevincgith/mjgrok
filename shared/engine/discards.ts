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
  kindIndex,
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
  /** Shanten of the checkpoint hand this draw leads to. `-1` means the draw itself wins. */
  shanten: number
  /** Winning tiles of that checkpoint hand. Empty when it is not tenpai. */
  waits: TileCount[]
  /**
   * Tile thrown after the draw, when the draw goes one past the checkpoint.
   * Omitted when the draw itself lands on the checkpoint.
   */
  discard?: Kind
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
 *
 * One past a checkpoint, each row is a tile you can throw now. The hand you
 * keep is at the checkpoint. If it is tenpai, `waits` are its winning tiles.
 * If it is not, `twoStep` is every later draw that improves it: that draw goes
 * one past the checkpoint, `twoStep.discard` is the tile thrown after it, and
 * `twoStep.waits` are the winning tiles of the checkpoint hand you return to.
 *
 * At a checkpoint, each row throws a tile first and leaves a short hand. That
 * short hand is not tenpai, so `waits` stays empty. `twoStep` is every draw
 * that repairs it back to a better checkpoint hand, and those waits belong to
 * the repaired hand. There is no second discard on that step.
 *
 * Percentages are a bounded estimate over `drawsLeft` self-draws.
 */
export function analyzeDiscards(hand: Hand, options?: DiscardOptions): DiscardAnalysis[] {
  const target = inferTarget(hand.concealed.length, hand.declared.length, options?.meldsNeeded)
  const draws = options?.drawsLeft ?? DEFAULT_DRAWS
  const removed = options?.discarded ?? {}
  const specials = hand.declared.length === 0 && target.need === 5
  const before = shanten(hand, { meldsNeeded: target.need })
  const kinds = distinct(hand.concealed)
  const rows: DiscardAnalysis[] = []
  for (const kind of kinds) {
    if (options?.aborted?.()) return []
    const next = removeOne(hand, kind)
    if (!next) continue
    const row = assess(next, kind, target.need, target.checkpoint, draws, removed, specials, before, options?.aborted)
    if (!row) return []
    rows.push(row)
  }
  rows.sort((a, b) => b.winPercent - a.winPercent || b.tenpaiPercent - a.tenpaiPercent || b.accepting.length - a.accepting.length || a.discard.localeCompare(b.discard))
  return rows
}

/**
 * Useful draws for a hand sitting on a checkpoint and not yet tenpai.
 * Returns null when the hand is not that shape: a tenpai checkpoint hand is
 * described by its waits, and a just-drawn hand is described by `analyzeDiscards`.
 * Each step draws one tile, names the discard that follows, and lists the waits
 * of the checkpoint hand that discard leaves. Every useful draw is returned.
 */
export function analyzeNextDraws(hand: Hand, options?: DiscardOptions): TwoStep[] | null {
  const target = inferTarget(hand.concealed.length, hand.declared.length, options?.meldsNeeded)
  if (hand.concealed.length !== target.checkpoint) return null
  const baseline = shanten(hand, { meldsNeeded: target.need })
  if (baseline <= 0) return null
  if (options?.aborted?.()) return null
  const specials = hand.declared.length === 0 && target.need === 5
  const { counts, jokers } = countsOf(hand.concealed)
  const held = counts.slice()
  const declared = declaredCounts(hand)
  for (let i = 0; i < KIND_COUNT; i++) held[i] += declared[i]
  const found = drawsThenDiscard(counts, jokers, target.need, target.checkpoint, specials, block(held, options?.discarded ?? {}), hand.declared, baseline, options?.aborted)
  if (!found) return null
  return found.twoStep
}

function assess(
  hand: Hand,
  discard: Kind,
  need: number,
  checkpoint: number,
  draws: number,
  removed: Record<string, number>,
  specials: boolean,
  before: number,
  aborted?: () => boolean,
): DiscardAnalysis | null {
  const distance = shanten(hand, { meldsNeeded: need })
  const { counts, jokers } = countsOf(hand.concealed)
  const held = counts.slice()
  const declared = declaredCounts(hand)
  for (let i = 0; i < KIND_COUNT; i++) held[i] += declared[i]
  const blocked = block(held, removed, discard)
  const unseenTotal = blocked.reduce((sum, n) => sum + Math.max(0, 4 - n), 0)
  let waits: TileCount[] = []
  let accepting: TileCount[] = []
  let twoStep: TwoStep[] = []
  if (hand.concealed.length === checkpoint && distance <= 0) {
    waits = waitCounts(counts, jokers, need, specials, blocked)
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
    const found = drawsThenDiscard(counts, jokers, need, checkpoint, specials, blocked, hand.declared, distance, aborted)
    if (!found) return null
    accepting = found.accepting
    twoStep = found.twoStep
  } else if (hand.concealed.length === checkpoint - 1) {
    const found = drawsOntoCheckpoint(counts, jokers, need, specials, blocked, hand.declared, before, aborted)
    if (!found) return null
    accepting = found.accepting
    twoStep = found.twoStep
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

function improves(next: number, baseline: number): boolean {
  if (baseline <= 0) return next <= 0
  return next < baseline
}

/** Draw onto a checkpoint hand, then discard back down. */
function drawsThenDiscard(
  counts: number[],
  jokers: number,
  need: number,
  checkpoint: number,
  specials: boolean,
  blocked: number[],
  melds: Hand['declared'],
  baseline: number,
  aborted?: () => boolean,
): { accepting: TileCount[]; twoStep: TwoStep[] } | null {
  const accepting: TileCount[] = []
  const twoStep: TwoStep[] = []
  for (let i = 0; i < KIND_COUNT; i++) {
    if (aborted?.()) return null
    const kind = indexKind(i)
    const left = Math.max(0, 4 - blocked[i])
    if (left <= 0 || counts[i] >= 4) continue
    counts[i] += 1
    blocked[i] += 1
    const quick = shantenByBestDiscard(counts, jokers, need, checkpoint, specials, baseline <= 0 ? 0 : baseline - 1)
    if (!improves(quick, baseline)) {
      counts[i] -= 1
      blocked[i] -= 1
      continue
    }
    const follow = bestFollow(counts, jokers, need, specials, melds, blocked)
    counts[i] -= 1
    blocked[i] -= 1
    accepting.push({ kind, remaining: left })
    const step: TwoStep = { draw: kind, remaining: left, shanten: follow.shanten, waits: follow.waits }
    if (follow.discard) step.discard = follow.discard
    twoStep.push(step)
  }
  twoStep.sort(byLookahead)
  return { accepting, twoStep }
}

/** Draw onto a hand that is one tile under the checkpoint. The draw is kept; nothing is thrown after it. */
function drawsOntoCheckpoint(
  counts: number[],
  jokers: number,
  need: number,
  specials: boolean,
  blocked: number[],
  melds: Hand['declared'],
  baseline: number,
  aborted?: () => boolean,
): { accepting: TileCount[]; twoStep: TwoStep[] } | null {
  const accepting: TileCount[] = []
  const twoStep: TwoStep[] = []
  for (let i = 0; i < KIND_COUNT; i++) {
    if (aborted?.()) return null
    const kind = indexKind(i)
    const left = Math.max(0, 4 - blocked[i])
    if (left <= 0 || counts[i] >= 4) continue
    counts[i] += 1
    blocked[i] += 1
    const next = shanten(handFromCounts(counts, jokers, melds), { meldsNeeded: need })
    const nextWaits = improves(next, baseline) && next <= 0 ? waitCounts(counts, jokers, need, specials, blocked) : []
    counts[i] -= 1
    blocked[i] -= 1
    if (!improves(next, baseline)) continue
    accepting.push({ kind, remaining: left })
    twoStep.push({ draw: kind, remaining: left, shanten: next, waits: nextWaits })
  }
  twoStep.sort(byLookahead)
  return { accepting, twoStep }
}

function byLookahead(a: TwoStep, b: TwoStep): number {
  const aw = a.waits.reduce((s, w) => s + w.remaining, 0)
  const bw = b.waits.reduce((s, w) => s + w.remaining, 0)
  return a.shanten - b.shanten || bw - aw || b.remaining - a.remaining || a.draw.localeCompare(b.draw)
}

function waitCounts(counts: number[], jokers: number, need: number, specials: boolean, blocked: number[]): TileCount[] {
  const waits: TileCount[] = []
  for (let i = 0; i < KIND_COUNT; i++) {
    if (counts[i] >= 4 || blocked[i] >= 4) continue
    counts[i] += 1
    const wins = isCompleteCounts(counts, jokers, need, specials)
    counts[i] -= 1
    if (!wins) continue
    const remaining = 4 - blocked[i]
    if (remaining > 0) waits.push({ kind: indexKind(i), remaining })
  }
  return waits
}

function block(held: number[], removed: Record<string, number>, discard?: Kind): number[] {
  const blocked = held.slice()
  for (let i = 0; i < KIND_COUNT; i++) blocked[i] += removed[indexKind(i)] ?? 0
  if (discard && discard !== 'j') {
    const idx = kindIndex(discard)
    if (idx >= 0) blocked[idx] += 1
  }
  return blocked
}

/** Best discard from a just-drawn count. Waits are filled only when that discard is tenpai, and the tenpai discard with the most tiles out wins a tie. */
function bestFollow(
  counts: number[],
  jokers: number,
  need: number,
  specials: boolean,
  melds: Hand['declared'],
  blocked: number[],
): { shanten: number; discard: Kind | null; waits: TileCount[] } {
  if (isCompleteCounts(counts, jokers, need, specials)) return { shanten: -1, discard: null, waits: [] }
  let bestShanten = 8
  let bestTotal = -1
  let bestDiscard: Kind | null = null
  let bestWaits: TileCount[] = []
  const consider = (nextJokers: number, discard: Kind) => {
    const distance = shanten(handFromCounts(counts, nextJokers, melds), { meldsNeeded: need })
    let total = -1
    let waits: TileCount[] = []
    if (distance <= 0) {
      waits = waitCounts(counts, nextJokers, need, specials, blocked)
      total = waits.reduce((s, w) => s + w.remaining, 0)
    }
    const better = distance < bestShanten || (distance === bestShanten && (total > bestTotal || (total === bestTotal && (bestDiscard == null || discard.localeCompare(bestDiscard) < 0))))
    if (!better) return
    bestShanten = distance
    bestTotal = total
    bestDiscard = discard
    bestWaits = distance <= 0 ? waits : []
  }
  for (let i = 0; i < KIND_COUNT; i++) {
    if (!counts[i]) continue
    counts[i] -= 1
    consider(jokers, indexKind(i))
    counts[i] += 1
  }
  if (jokers > 0) consider(jokers - 1, 'j')
  return { shanten: bestShanten, discard: bestDiscard, waits: bestWaits }
}

function handFromCounts(counts: number[], jokers: number, melds: Hand['declared']): Hand {
  const concealed: Tile[] = []
  for (let i = 0; i < KIND_COUNT; i++) for (let n = 0; n < counts[i]; n++) concealed.push(tileOf(indexKind(i)))
  for (let n = 0; n < jokers; n++) concealed.push({ suit: 'j', rank: 0 })
  return { concealed, declared: melds, flowers: [] }
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
