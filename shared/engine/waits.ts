import { decomposeStandard, type PartDecomp } from './decompose.ts'
import {
  ORDINARY_MELDS,
  eightGroups,
  isEightPairsComplete,
  isSixteenUnrelatedComplete,
  isThirteenOrphansComplete,
  resolveEightFill,
  resolveOrphanFill,
  resolveSixteenFill,
  sixteenShapes,
} from './specials.ts'
import { shanten } from './shanten.ts'
import {
  KIND_COUNT,
  ORPHAN_INDEXES,
  type Hand,
  type Kind,
  type ResolvedDecomposition,
  type ResolvedMeld,
  type WaitResult,
  type WaitTile,
  countsOf,
  declaredCounts,
  indexKind,
  inferTarget,
  kindOf,
} from './tiles.ts'

export interface WaitOptions {
  meldsNeeded?: number
}

/**
 * Waits are listed only on a checkpoint-sized hand (1/4/7/10/13/16, declared-adjusted).
 * Every kind that completes the hand is returned, with every meld/pair reading.
 * `total` sums remaining copies (4 minus tiles already in the hand). `universal` means all 34 kinds complete it.
 */
export function findWaits(hand: Hand, opts?: WaitOptions): WaitResult {
  const target = inferTarget(hand.concealed.length, hand.declared.length, opts?.meldsNeeded)
  const base = shanten(hand, opts)
  const { counts, jokers } = countsOf(hand.concealed)
  const held = counts.slice()
  const declared = declaredCounts(hand)
  for (let i = 0; i < KIND_COUNT; i++) held[i] += declared[i]
  const atCheckpoint = hand.concealed.length === target.checkpoint
  const specials = hand.declared.length === 0 && target.need === 5
  const waits: WaitTile[] = []
  if (atCheckpoint) {
    for (let i = 0; i < KIND_COUNT; i++) {
      if (counts[i] >= 4) continue
      counts[i] += 1
      const decomps = completions(hand, counts, jokers, target.need, specials, indexKind(i))
      counts[i] -= 1
      if (!decomps.length) continue
      const remaining = Math.max(0, 4 - held[i])
      waits.push({ kind: indexKind(i), remaining, decompositions: decomps })
    }
    countsOf(hand.concealed)
    const jokerDecomps = completions(hand, counts, jokers + 1, target.need, specials, 'j')
    if (jokerDecomps.length) {
      waits.push({ kind: 'j', remaining: Number.POSITIVE_INFINITY, decompositions: jokerDecomps })
    }
  }
  const normal = waits.filter((w) => w.kind !== 'j')
  const total = normal.reduce((s, w) => s + w.remaining, 0)
  return {
    shanten: base,
    waits,
    total,
    universal: normal.length === KIND_COUNT,
    jokerWait: waits.some((w) => w.kind === 'j'),
    checkpoint: target.checkpoint,
    atCheckpoint,
  }
}

function completions(
  hand: Hand,
  counts: number[],
  jokers: number,
  need: number,
  specials: boolean,
  winning: Kind,
): ResolvedDecomposition[] {
  const out: ResolvedDecomposition[] = []
  const tiles = counts.reduce((s, c) => s + c, 0) + jokers
  if (tiles === need * 3 + 2) {
    const found = decomposeStandard(counts, jokers, need)
    for (const decomp of found.decomps) out.push(fromStandard(hand, decomp, winning, false))
  }
  if (specials && tiles === 17) {
    if (isThirteenOrphansComplete(counts, jokers)) {
      const fill = resolveOrphanFill(counts, jokers)
      out.push(...orphanReadings(fill?.counts ?? counts, winning, fill?.standIns ?? []))
    }
    if (isSixteenUnrelatedComplete(counts, jokers)) {
      const fill = resolveSixteenFill(counts, jokers)
      out.push(...sixteenReadings(fill?.counts ?? counts, fill?.standIns ?? []))
    }
    if (isEightPairsComplete(counts, jokers)) {
      const fill = resolveEightFill(counts, jokers)
      out.push(eightReading(fill?.counts ?? counts, winning, fill?.standIns ?? []))
    }
  }
  return out
}

function declaredMelds(hand: Hand): ResolvedMeld[] {
  return hand.declared.map((meld) => {
    const kong = meld.type === 'open-kong' || meld.type === 'concealed-kong'
    return {
      type: kong ? 'kong' : meld.type === 'chow' ? 'chow' : 'pung',
      tiles: meld.tiles.map(kindOf),
      concealed: meld.concealed,
      open: !meld.concealed,
      declared: true,
      jokerSlots: meld.tiles.map((t, i) => (kindOf(t) === 'j' ? i : -1)).filter((i) => i >= 0),
    }
  })
}

function fromStandard(hand: Hand, decomp: PartDecomp, winning: Kind, selfDraw: boolean): ResolvedDecomposition {
  const melds: ResolvedMeld[] = declaredMelds(hand)
  for (const meld of decomp.melds) {
    melds.push({
      type: meld.type,
      tiles: meld.indexes.map(indexKind),
      concealed: true,
      open: false,
      declared: false,
      jokerSlots: meld.jokerAt.slice(),
    })
  }
  const pair = [indexKind(decomp.pairIndex), indexKind(decomp.pairIndex)]
  markWinning(melds, pair, winning, selfDraw)
  return {
    melds,
    pair,
    pairJokers: decomp.pairJokers,
    shape: 'normal',
    jokerStandIns: decomp.jokerStandIns.map(indexKind),
  }
}

export function markWinning(melds: ResolvedMeld[], pair: Kind[], winning: Kind | null, selfDraw: boolean): void {
  if (!winning || winning === 'j' || selfDraw) return
  if (pair[0] === winning) return
  const pung = melds.find((m) => !m.declared && (m.type === 'pung' || m.type === 'kong') && m.tiles.includes(winning))
  if (pung) {
    pung.open = true
    return
  }
  const chow = melds.find((m) => !m.declared && m.type === 'chow' && m.tiles.includes(winning))
  if (chow) chow.open = true
}

function orphanReadings(counts: number[], winning: Kind, standIns: number[] = []): ResolvedDecomposition[] {
  const readings: ResolvedDecomposition[] = []
  for (const meld of ORDINARY_MELDS) {
    const next = counts.slice()
    if (meld.some((idx) => next[idx] <= 0)) continue
    for (const idx of meld) next[idx] -= 1
    let extra = -1
    let ok = true
    for (const o of ORPHAN_INDEXES) {
      if (next[o] === 2) {
        if (extra >= 0) ok = false
        extra = o
      } else if (next[o] !== 1) ok = false
    }
    for (let i = 0; i < KIND_COUNT && ok; i++) {
      if (!ORPHAN_INDEXES.includes(i) && next[i] > 0) ok = false
    }
    if (!ok || extra < 0) continue
    const meldTiles = meld.map(indexKind)
    const isPung = meld[0] === meld[1]
    const melds: ResolvedMeld[] = [
      {
        type: isPung ? 'pung' : 'chow',
        tiles: meldTiles,
        concealed: true,
        open: false,
        declared: false,
        jokerSlots: [],
      },
    ]
    for (const o of ORPHAN_INDEXES) {
      if (o === extra) continue
      melds.push({
        type: 'single',
        tiles: [indexKind(o)],
        concealed: true,
        open: false,
        declared: false,
        jokerSlots: [],
      })
    }
    const pair = [indexKind(extra), indexKind(extra)]
    markWinning(melds, pair, winning, false)
    readings.push({ melds, pair, pairJokers: 0, shape: 'orphans', jokerStandIns: standIns.map(indexKind) })
    if (readings.length >= 8) break
  }
  return readings
}

function sixteenReadings(counts: number[], standIns: number[] = []): ResolvedDecomposition[] {
  const out: ResolvedDecomposition[] = []
  for (const shape of sixteenShapes()) {
    let pairs = 0
    let pair = -1
    let ok = true
    for (let i = 0; i < KIND_COUNT; i++) {
      const c = counts[i]
      const need = shape.kinds.includes(i)
      if (!need) {
        if (c) ok = false
        continue
      }
      if (c === 2) {
        pairs += 1
        pair = i
      } else if (c !== 1) ok = false
    }
    if (!ok || pairs !== 1 || pair < 0) continue
    const melds: ResolvedMeld[] = shape.kinds
      .filter((k) => k !== pair)
      .map((k) => ({
        type: 'single' as const,
        tiles: [indexKind(k)],
        concealed: true,
        open: false,
        declared: false,
        jokerSlots: [],
      }))
    const pairTiles = [indexKind(pair), indexKind(pair)]
    out.push({ melds, pair: pairTiles, pairJokers: 0, shape: 'unrelated', jokerStandIns: standIns.map(indexKind) })
    if (out.length >= 4) break
  }
  return out
}

function eightReading(counts: number[], winning: Kind, standIns: number[] = []): ResolvedDecomposition {
  const groups = eightGroups(counts)
  const melds: ResolvedMeld[] = []
  const push = (kind: Kind, n: number) => {
    melds.push({
      type: 'pung',
      tiles: Array.from({ length: n }, () => kind),
      concealed: true,
      open: false,
      declared: false,
      jokerSlots: [],
    })
  }
  for (const kind of groups.pairKinds) {
    if (groups.quadKinds.includes(kind)) continue
    push(kind, 2)
  }
  for (const kind of groups.quadKinds) push(kind, 4)
  if (groups.triple) push(groups.triple, 3)
  const pairKind = groups.triple ?? groups.pairKinds[0] ?? '1z'
  markWinning(melds, [pairKind, pairKind], winning, false)
  return { melds, pair: [pairKind, pairKind], pairJokers: 0, shape: 'eight', jokerStandIns: standIns.map(indexKind) }
}
