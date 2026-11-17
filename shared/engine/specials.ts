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

export interface JokerFill {
  /** Concrete counts after each joker has been given a stand-in. */
  counts: number[]
  standIns: number[]
}

/** One concrete assignment of jokers that completes eight pairs. */
export function resolveEightFill(counts: number[], jokers: number): JokerFill | null {
  if (!isEightPairsComplete(counts, jokers)) return null
  const adds = new Array<number>(KIND_COUNT).fill(0)
  const rec = (i: number, j: number, units: number, triples: number, singles: number): boolean => {
    if (units > 8 || triples > 1) return false
    if (i === KIND_COUNT) {
      if (singles > 0) return false
      return placeFreeJokers(j, units, triples, adds)
    }
    const c = counts[i]
    const maxAdd = Math.min(j, Math.max(0, 4 - c))
    for (let add = 0; add <= maxAdd; add++) {
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
      else if (n > 4) continue
      adds[i] = add
      if (rec(i + 1, j - add, u, t, s)) return true
    }
    adds[i] = 0
    return false
  }
  if (!rec(0, jokers, 0, 0, 0)) return null
  const filled = counts.map((c, i) => c + adds[i])
  const standIns: number[] = []
  for (let i = 0; i < KIND_COUNT; i++) for (let k = 0; k < adds[i]; k++) standIns.push(i)
  return { counts: filled, standIns }
}

function placeFreeJokers(jokers: number, units: number, triples: number, adds: number[]): boolean {
  if (jokers === 0) return units === 8 && triples === 1
  for (let i = 0; i < KIND_COUNT && jokers > 0; i++) {
    const room = 4 - (adds[i])
    if (room <= 0) continue
    const take = Math.min(room, jokers >= 3 && triples === 0 ? 3 : jokers >= 2 ? 2 : 0)
    if (take < 2 && !(take === 3)) continue
    if (take === 0) continue
    adds[i] += take
    const nextUnits = units + (take === 4 ? 2 : 1)
    const nextTriples = triples + (take === 3 ? 1 : 0)
    if (placeFreeJokers(jokers - take, nextUnits, nextTriples, adds)) return true
    adds[i] -= take
  }
  return false
}

export interface OrphanFill {
  counts: number[]
  standIns: number[]
  meld: number[]
  pair: number
}

export function resolveOrphanFill(counts: number[], jokers: number): OrphanFill | null {
  if (!isThirteenOrphansComplete(counts, jokers)) return null
  for (const meld of ORDINARY_MELDS) {
    const next = counts.slice()
    const standIns: number[] = []
    let need = 0
    for (const idx of meld) {
      if (next[idx] > 0) next[idx] -= 1
      else {
        need += 1
        standIns.push(idx)
      }
    }
    if (need > jokers) continue
    const core = assignOrphanCore(next, jokers - need)
    if (!core) continue
    const filled = counts.slice()
    for (const idx of standIns) filled[idx] += 1
    for (const idx of core.standIns) filled[idx] += 1
    return { counts: filled, standIns: standIns.concat(core.standIns), meld, pair: core.pair }
  }
  return null
}

function assignOrphanCore(counts: number[], jokers: number): { standIns: number[]; pair: number } | null {
  const missing: number[] = []
  let pair = -1
  for (const o of ORPHAN_INDEXES) {
    const c = counts[o]
    if (c === 0) missing.push(o)
    else if (c === 1) {
      /* covered */
    } else if (c === 2) {
      if (pair >= 0) return null
      pair = o
    } else return null
  }
  for (let i = 0; i < KIND_COUNT; i++) if (!ORPHAN_SET.has(i) && counts[i] > 0) return null
  if (missing.length > jokers) return null
  const left = jokers - missing.length
  const standIns = missing.slice()
  if (pair >= 0) return left === 0 ? { standIns, pair } : null
  if (left !== 1) return null
  const extra = ORPHAN_INDEXES.find((o) => counts[o] + (missing.includes(o) ? 1 : 0) === 1) ?? ORPHAN_INDEXES[0]
  standIns.push(extra)
  return { standIns, pair: extra }
}

export function resolveSixteenFill(counts: number[], jokers: number): { counts: number[]; standIns: number[]; pair: number; ranks: [number[], number[], number[]] } | null {
  if (!isSixteenUnrelatedComplete(counts, jokers)) return null
  for (const shape of sixteenShapes()) {
    if (!fitsSixteen(counts, jokers, shape.kinds)) continue
    const missing: number[] = []
    let pair = -1
    for (const k of shape.kinds) {
      const c = counts[k]
      if (c === 0) missing.push(k)
      else if (c === 2) pair = k
    }
    const standIns = missing.slice()
    if (pair < 0) {
      pair = missing[0] ?? shape.kinds[0]
      standIns.push(pair)
    }
    const filled = counts.slice()
    for (const idx of standIns) filled[idx] += 1
    return { counts: filled, standIns, pair, ranks: shape.ranks }
  }
  return null
}
