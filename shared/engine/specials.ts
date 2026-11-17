import { KIND_COUNT, ORPHAN_INDEXES, type Kind, indexKind, rankOf, suitOf } from './tiles.ts'

/** Three ranks, pairwise at least 3 apart, so no two can share a chow. */
export const UNRELATED_TRIPLES: number[][] = (() => {
  const out: number[][] = []
  for (let a = 1; a <= 9; a++) {
    for (let b = a + 3; b <= 9; b++) {
      for (let c = b + 3; c <= 9; c++) out.push([a, b, c])
    }
  }
  return out
})()

const ORPHAN_SET = new Set(ORPHAN_INDEXES)

export const ORDINARY_MELDS: number[][] = (() => {
  const melds: number[][] = []
  for (let i = 0; i < KIND_COUNT; i++) melds.push([i, i, i])
  for (const base of [0, 9, 18]) {
    for (let s = 0; s <= 6; s++) melds.push([base + s, base + s + 1, base + s + 2])
  }
  return melds
})()

export function sumCounts(counts: number[], jokers = 0): number {
  let n = jokers
  for (const c of counts) n += c
  return n
}

export function isEightPairsComplete(counts: number[], jokers = 0): boolean {
  if (sumCounts(counts, jokers) !== 17) return false
  const memo = new Map<string, boolean>()
  const rec = (i: number, j: number, units: number, triples: number, singles: number): boolean => {
    if (units > 8 || triples > 1 || singles > 8) return false
    if (i === KIND_COUNT) {
      if (singles > 0) return false
      return freeJokers(j, units, triples)
    }
    const key = `${i},${j},${units},${triples},${singles}`
    const hit = memo.get(key)
    if (hit != null) return hit
    const c = counts[i]
    const maxAdd = Math.min(j, Math.max(0, 4 - c))
    let ok = false
    for (let add = 0; add <= maxAdd && !ok; add++) {
      const n = c + add
      let u = units
      let t = triples
      let s = singles
      if (n === 1) s += 1
      else if (n === 2) u += 1
      else if (n === 3) {
        u += 1
        t += 1
      } else if (n === 4) u += 2
      else if (n > 4) {
        ok = false
        break
      }
      ok = rec(i + 1, j - add, u, t, s)
    }
    memo.set(key, ok)
    return ok
  }
  return rec(0, jokers, 0, 0, 0)
}

function freeJokers(jokers: number, units: number, triples: number): boolean {
  const memo = new Map<string, boolean>()
  const rec = (j: number, u: number, t: number): boolean => {
    if (j === 0) return u === 8 && t === 1
    if (u > 8 || t > 1) return false
    const key = `${j},${u},${t}`
    const hit = memo.get(key)
    if (hit != null) return hit
    let ok = false
    if (j >= 2) ok = rec(j - 2, u + 1, t)
    if (!ok && j >= 3 && t === 0) ok = rec(j - 3, u + 1, 1)
    if (!ok && j >= 4) ok = rec(j - 4, u + 2, t)
    memo.set(key, ok)
    return ok
  }
  return rec(jokers, units, triples)
}

/** Pair-units, treating a quad as two pairs and a triple as one pair plus the required triple marker. */
export function eightPairUnits(counts: number[]): { units: number; triples: number; singles: number; tiles: number } {
  let units = 0
  let triples = 0
  let singles = 0
  let tiles = 0
  for (const c of counts) {
    tiles += c
    if (c === 1) singles += 1
    else if (c === 2) units += 1
    else if (c === 3) {
      units += 1
      triples += 1
    } else if (c >= 4) units += 2
  }
  return { units, triples, singles, tiles }
}

export function isThirteenOrphansComplete(counts: number[], jokers = 0): boolean {
  if (sumCounts(counts, jokers) !== 17) return false
  for (const meld of ORDINARY_MELDS) {
    const next = counts.slice()
    let need = 0
    for (const idx of meld) {
      if (next[idx] > 0) next[idx] -= 1
      else need += 1
    }
    if (need > jokers) continue
    if (orphanCore(next, jokers - need)) return true
  }
  return false
}

function orphanCore(counts: number[], jokers: number): boolean {
  let missing = 0
  let extras = 0
  for (const o of ORPHAN_INDEXES) {
    const c = counts[o]
    if (c === 0) missing += 1
    else if (c === 1) {
      /* covered */
    } else if (c === 2) extras += 1
    else return false
  }
  for (let i = 0; i < KIND_COUNT; i++) {
    if (!ORPHAN_SET.has(i) && counts[i] > 0) return false
  }
  if (missing > jokers || extras > 1) return false
  const left = jokers - missing
  if (extras === 1) return left === 0
  return left === 1
}

export interface SixteenShape {
  kinds: number[]
  ranks: [number[], number[], number[]]
}

let shapeCache: SixteenShape[] | null = null

export function sixteenShapes(): SixteenShape[] {
  if (shapeCache) return shapeCache
  const shapes: SixteenShape[] = []
  for (const a of UNRELATED_TRIPLES) {
    for (const b of UNRELATED_TRIPLES) {
      for (const c of UNRELATED_TRIPLES) {
        const kinds: number[] = []
        for (let z = 0; z < 7; z++) kinds.push(27 + z)
        for (const r of a) kinds.push(r - 1)
        for (const r of b) kinds.push(9 + r - 1)
        for (const r of c) kinds.push(18 + r - 1)
        shapes.push({ kinds, ranks: [a.slice(), b.slice(), c.slice()] })
      }
    }
  }
  shapeCache = shapes
  return shapes
}

export function isSixteenUnrelatedComplete(counts: number[], jokers = 0): boolean {
  if (sumCounts(counts, jokers) !== 17) return false
  for (const shape of sixteenShapes()) {
    if (fitsSixteen(counts, jokers, shape.kinds)) return true
  }
  return false
}

function fitsSixteen(counts: number[], jokers: number, kinds: number[]): boolean {
  const set = new Set(kinds)
  let missing = 0
  let pairs = 0
  for (let i = 0; i < KIND_COUNT; i++) {
    const c = counts[i]
    if (!set.has(i)) {
      if (c > 0) return false
      continue
    }
    if (c === 0) missing += 1
    else if (c === 1) {
      /* single */
    } else if (c === 2) pairs += 1
    else return false
  }
  if (pairs > 1 || missing > jokers) return false
  const left = jokers - missing
  if (pairs === 1) return left === 0
  return left === 1
}

export function sixteenPairAndRanks(counts: number[]): { pair: Kind; ranks: [number[], number[], number[]] } | null {
  if (!isSixteenUnrelatedComplete(counts, 0)) return null
  for (const shape of sixteenShapes()) {
    if (!fitsSixteen(counts, 0, shape.kinds)) continue
    let pair = shape.kinds[0]
    for (const k of shape.kinds) if (counts[k] === 2) pair = k
    return { pair: indexKind(pair), ranks: shape.ranks }
  }
  return null
}

export function ranksAreSame(ranks: [number[], number[], number[]]): boolean {
  const [a, b, c] = ranks
  return a.every((r, i) => r === b[i] && r === c[i])
}

export function ranksCoverOneToNine(ranks: [number[], number[], number[]]): boolean {
  const set = new Set<number>([...ranks[0], ...ranks[1], ...ranks[2]])
  return set.size === 9
}

/** Kinds in an eight-pairs hand: each count 2 or 4 is pairs; the single count-3 is the triple. */
export function eightGroups(counts: number[]): { pairKinds: Kind[]; triple: Kind | null; quadKinds: Kind[] } {
  const pairKinds: Kind[] = []
  const quadKinds: Kind[] = []
  let triple: Kind | null = null
  for (let i = 0; i < KIND_COUNT; i++) {
    const c = counts[i]
    const kind = indexKind(i)
    if (c === 2) pairKinds.push(kind)
    else if (c === 3) triple = kind
    else if (c === 4) {
      quadKinds.push(kind)
      pairKinds.push(kind, kind)
    }
  }
  return { pairKinds, triple, quadKinds }
}

export function preEightWaitCount(countsWithoutWin: number[]): number {
  // counts are the 16-tile pre-completion hand.
  let allEven = true
  let any = false
  for (const c of countsWithoutWin) {
    if (c === 0) continue
    any = true
    if (c % 2 !== 0) allEven = false
  }
  if (any && allEven) return 8
  let waits = 0
  for (let i = 0; i < KIND_COUNT; i++) {
    if (countsWithoutWin[i] >= 4) continue
    countsWithoutWin[i] += 1
    if (isEightPairsComplete(countsWithoutWin, 0)) waits += 1
    countsWithoutWin[i] -= 1
  }
  return waits
}

export function kindLabel(kind: Kind): string {
  return `${rankOf(kind)}${suitOf(kind)}`
}
