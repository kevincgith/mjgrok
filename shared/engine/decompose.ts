import { KIND_COUNT, type Kind, indexKind } from './tiles.ts'

export interface PartMeld {
  type: 'chow' | 'pung'
  indexes: number[]
  jokerAt: number[]
}

export interface PartDecomp {
  melds: PartMeld[]
  pairIndex: number
  pairJokers: number
  /** Concrete kind index for each joker, in the order they were assigned. */
  jokerStandIns: number[]
}

export interface DecomposeLimits {
  steps?: number
  max?: number
}

export interface DecomposeOutput {
  decomps: PartDecomp[]
  limited: boolean
  steps: number
}

const DEFAULT_STEPS = 50_000
const DEFAULT_MAX = 500

function suitBase(i: number): number | null {
  if (i < 9) return 0
  if (i < 18) return 9
  if (i < 27) return 18
  return null
}

function chowSlots(anchor: number, counts: number[]): number[][] {
  const base = suitBase(anchor)
  if (base == null) return []
  const rank = anchor - base + 1
  const out: number[][] = []
  for (const start of [rank, rank - 1, rank - 2]) {
    if (start < 1 || start > 7) continue
    const slots = [base + start - 1, base + start, base + start + 1]
    if (!slots.includes(anchor)) continue
    if (slots.some((s) => s < anchor && counts[s] > 0)) continue
    out.push(slots)
  }
  return out
}

/**
 * Every standard meld+pair reading of a concealed multiset.
 * Jokers are a budget: each assignment records the concrete stand-in.
 * Search stops after 50,000 steps or 500 decompositions.
 */
export function decomposeStandard(
  countsIn: number[],
  jokersIn: number,
  meldsNeeded: number,
  limits?: DecomposeLimits,
): DecomposeOutput {
  const counts = countsIn.slice()
  let jokers = jokersIn
  const maxSteps = limits?.steps ?? DEFAULT_STEPS
  const maxRes = limits?.max ?? DEFAULT_MAX
  const results: PartDecomp[] = []
  const seen = new Set<string>()
  let steps = 0
  let limited = false
  const melds: PartMeld[] = []
  const standIns: number[] = []
  let pairIndex = -1
  let pairJokers = 0

  const tiles = counts.reduce((a, b) => a + b, 0) + jokers
  if (tiles !== meldsNeeded * 3 + 2) return { decomps: [], limited: false, steps: 0 }

  function push(extraMelds: PartMeld[], extraStand: number[], pIdx: number, pJ: number) {
    const all = melds.concat(extraMelds)
    const sig =
      all
        .map((m) => `${m.type}:${m.indexes.join(',')}:${m.jokerAt.join('.')}`)
        .sort()
        .join('|') + `#${pIdx}:${pJ}`
    if (seen.has(sig)) return
    seen.add(sig)
    results.push({
      melds: all.map((m) => ({ type: m.type, indexes: m.indexes.slice(), jokerAt: m.jokerAt.slice() })),
      pairIndex: pIdx,
      pairJokers: pJ,
      jokerStandIns: standIns.concat(extraStand),
    })
  }

  function finish(needMelds: number, havePair: boolean) {
    if (needMelds === 0 && havePair && jokers === 0) {
      push([], [], pairIndex, pairJokers)
      return
    }
    const needTiles = needMelds * 3 + (havePair ? 0 : 2)
    if (jokers !== needTiles || jokers < 0) return
    const extra: PartMeld[] = []
    const extraStand: number[] = []
    let pIdx = pairIndex
    let pJ = pairJokers
    let left = jokers
    if (!havePair) {
      pIdx = 0
      pJ = 2
      extraStand.push(0, 0)
      left -= 2
    }
    let n = 0
    while (left >= 3) {
      const idx = n % 9
      extra.push({ type: 'pung', indexes: [idx, idx, idx], jokerAt: [0, 1, 2] })
      extraStand.push(idx, idx, idx)
      left -= 3
      n += 1
    }
    if (left === 0) push(extra, extraStand, pIdx, pJ)
  }

  function rec(needMelds: number, havePair: boolean) {
    if (results.length >= maxRes || steps >= maxSteps) {
      limited = true
      return
    }
    steps += 1
    let i = 0
    while (i < KIND_COUNT && counts[i] === 0) i += 1
    if (i === KIND_COUNT) {
      finish(needMelds, havePair)
      return
    }

    if (needMelds > 0 && counts[i] >= 1) {
      const use = Math.min(3, counts[i])
      const needJ = 3 - use
      if (needJ <= jokers) {
        counts[i] -= use
        jokers -= needJ
        const jokerAt: number[] = []
        for (let k = use; k < 3; k++) {
          jokerAt.push(k)
          standIns.push(i)
        }
        melds.push({ type: 'pung', indexes: [i, i, i], jokerAt })
        rec(needMelds - 1, havePair)
        melds.pop()
        if (needJ) standIns.splice(standIns.length - needJ, needJ)
        counts[i] += use
        jokers += needJ
      }
    }

    if (!havePair && counts[i] >= 1) {
      const use = Math.min(2, counts[i])
      const needJ = 2 - use
      if (needJ <= jokers) {
        counts[i] -= use
        jokers -= needJ
        for (let k = 0; k < needJ; k++) standIns.push(i)
        const prevP = pairIndex
        const prevJ = pairJokers
        pairIndex = i
        pairJokers = needJ
        rec(needMelds, true)
        pairIndex = prevP
        pairJokers = prevJ
        if (needJ) standIns.splice(standIns.length - needJ, needJ)
        counts[i] += use
        jokers += needJ
      }
    }

    if (needMelds > 0) {
      for (const slots of chowSlots(i, counts)) {
        const jokerAt: number[] = []
        const reals: number[] = []
        for (let s = 0; s < 3; s++) {
          if (counts[slots[s]] > 0) reals.push(slots[s])
          else jokerAt.push(s)
        }
        if (jokerAt.length > jokers || !reals.includes(i)) continue
        for (const s of reals) counts[s] -= 1
        jokers -= jokerAt.length
        for (const at of jokerAt) standIns.push(slots[at])
        melds.push({ type: 'chow', indexes: slots.slice(), jokerAt: jokerAt.slice() })
        rec(needMelds - 1, havePair)
        melds.pop()
        if (jokerAt.length) standIns.splice(standIns.length - jokerAt.length, jokerAt.length)
        jokers += jokerAt.length
        for (const s of reals) counts[s] += 1
      }
    }
  }

  rec(meldsNeeded, false)
  return { decomps: results, limited, steps }
}

export function hasStandardWin(counts: number[], jokers: number, meldsNeeded: number): boolean {
  const found = decomposeStandard(counts, jokers, meldsNeeded, { max: 1, steps: DEFAULT_STEPS })
  return found.decomps.length > 0
}

export function decompSignature(d: PartDecomp): string {
  return d.melds
    .map((m) => `${m.type}:${m.indexes.map(indexKind).join('')}`)
    .join('+') + `+${indexKind(d.pairIndex)}`
}

export function standInKinds(d: PartDecomp): Kind[] {
  return d.jokerStandIns.map(indexKind)
}
