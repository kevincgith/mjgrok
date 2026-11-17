import { decomposeStandard } from './decompose.ts'
import { findWaits } from './waits.ts'
import {
  type Hand,
  type Kind,
  type ResolvedDecomposition,
  countsOf,
  inferTarget,
  kindOf,
} from './tiles.ts'

/**
 * Jokers are a wildcard budget. Search assigns each joker a concrete stand-in
 * while building melds; it does not try every substitution of 34 kinds independently.
 * `byJoker[i]` is every stand-in that joker takes across the winning readings.
 */
export interface JokerReport {
  jokers: number
  decompositions: ResolvedDecomposition[]
  /** Unlocked stand-ins, one set per joker in concealed order. */
  byJoker: Kind[][]
  universal: boolean
}

export function jokerCount(hand: Hand): number {
  return hand.concealed.filter((t) => kindOf(t) === 'j').length +
    hand.declared.reduce((n, m) => n + m.tiles.filter((t) => kindOf(t) === 'j').length, 0)
}

export function resolveJokers(hand: Hand, meldsNeeded?: number): JokerReport {
  const target = inferTarget(hand.concealed.length, hand.declared.length, meldsNeeded)
  const { counts, jokers } = countsOf(hand.concealed)
  const decompositions: ResolvedDecomposition[] = []
  if (hand.concealed.length === target.winning) {
    const found = decomposeStandard(counts, jokers, target.need)
    const waits = findWaits(
      { ...hand, concealed: hand.concealed.slice(0, Math.max(0, hand.concealed.length - 1)) },
      { meldsNeeded: target.need },
    )
    for (const wait of waits.waits) decompositions.push(...wait.decompositions)
    if (!decompositions.length) {
      for (const decomp of found.decomps) {
        decompositions.push({
          melds: decomp.melds.map((m) => ({
            type: m.type,
            tiles: m.indexes.map((i) => `${(i % 9) + 1}${i < 9 ? 'm' : i < 18 ? 't' : i < 27 ? 'b' : 'z'}`),
            concealed: true,
            open: false,
            declared: false,
            jokerSlots: m.jokerAt.slice(),
          })),
          pair: [],
          pairJokers: decomp.pairJokers,
          shape: 'normal',
          jokerStandIns: decomp.jokerStandIns.map((i) => `${(i % 9) + 1}${i < 9 ? 'm' : i < 18 ? 't' : i < 27 ? 'b' : 'z'}`),
        })
      }
    }
  } else {
    const waits = findWaits(hand, { meldsNeeded: target.need })
    for (const wait of waits.waits) decompositions.push(...wait.decompositions)
  }
  const byJoker: Kind[][] = Array.from({ length: jokers }, () => [])
  for (const decomp of decompositions) {
    decomp.jokerStandIns.forEach((kind, i) => {
      if (!byJoker[i]) byJoker[i] = []
      if (!byJoker[i].includes(kind)) byJoker[i].push(kind)
    })
  }
  const waits = findWaits(hand, { meldsNeeded: target.need })
  return { jokers, decompositions, byJoker, universal: waits.universal }
}
