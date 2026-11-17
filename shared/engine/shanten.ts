import { decomposeStandard } from './decompose.ts'
import {
  eightPairUnits,
  isEightPairsComplete,
  isSixteenUnrelatedComplete,
  isThirteenOrphansComplete,
  sumCounts,
} from './specials.ts'
import {
  ORPHAN_INDEXES,
  type Hand,
  countsKey,
  countsOf,
  inferTarget,
} from './tiles.ts'

/**
 * Shanten is the number of discard+draw exchanges needed to reach tenpai.
 * -1 means the hand is already a winning hand (complete).
 * 0 means tenpai: at least one legal tile completes it.
 *
 * Checkpoint size is 3*meldsNeeded+1 (16, 13, 10, 7, 4, or 1 once declared
 * melds are counted). A hand one past the checkpoint is treated as "just drew":
 * its shanten is -1 when those tiles already win, otherwise the best shanten
 * among its single-tile discards.
 *
 * Special hands (十三么, 嚦咕嚦咕, 十六不搭) are included only for a fully
 * concealed 5-meld hand. The numeric distance for those shapes is exact at the
 * -1/0 boundary (by completion search) and structural above that.
 */

interface Profile {
  m: number
  rt: number
  pt: number
  h: number
  used: number
}

const ZERO: Profile = { m: 0, rt: 0, pt: 0, h: 0, used: 0 }
const cache = new Map<string, number>()

export function clearShantenCache(): void {
  cache.clear()
  suitMemo.clear()
}

function dominates(a: Profile, b: Profile): boolean {
  return (
    a.m >= b.m &&
    a.rt >= b.rt &&
    a.pt >= b.pt &&
    a.h >= b.h &&
    (a.m > b.m || a.rt > b.rt || a.pt > b.pt || a.h > b.h)
  )
}

function prune(list: Profile[], need = 5): Profile[] {
  const best = new Map<string, Profile>()
  for (const raw of list) {
    const p: Profile = {
      m: Math.min(need, raw.m),
      rt: Math.min(need, raw.rt),
      pt: Math.min(need, raw.pt),
      h: raw.h ? 1 : 0,
      used: raw.used,
    }
    const key = `${p.m},${p.rt},${p.pt},${p.h}`
    const prev = best.get(key)
    if (!prev || p.used < prev.used) best.set(key, p)
  }
  const items = [...best.values()]
  const out: Profile[] = []
  for (const p of items) {
    let dominated = false
    for (const o of items) {
      if (o !== p && dominates(o, p)) {
        dominated = true
        break
      }
    }
    if (!dominated) out.push(p)
  }
  return out
}

function addProfiles(a: Profile, b: Profile): Profile {
  let h = (a.h ? 1 : 0) + (b.h ? 1 : 0)
  let pt = a.pt + b.pt
  if (h > 1) {
    pt += h - 1
    h = 1
  }
  return { m: a.m + b.m, rt: a.rt + b.rt, pt, h, used: a.used + b.used }
}

function suitProfiles(input: number[]): Profile[] {
  const counts = input.slice()
  const memo = new Map<string, Profile[]>()
  const rec = (i: number): Profile[] => {
    while (i < 9 && counts[i] === 0) i += 1
    const key = `${i}:${counts.join('')}`
    const hit = memo.get(key)
    if (hit) return hit
    if (i >= 9) return [ZERO]
    const c = counts[i]
    const merged: Profile[] = []
    const branch = (apply: () => void, undo: () => void, add: Profile) => {
      apply()
      for (const child of rec(i)) merged.push(addProfiles(child, add))
      undo()
    }
    branch(
      () => {
        counts[i] = c - 1
      },
      () => {
        counts[i] = c
      },
      ZERO,
    )
    if (c >= 2) {
      branch(
        () => {
          counts[i] = c - 2
        },
        () => {
          counts[i] = c
        },
        { m: 0, rt: 0, pt: 0, h: 1, used: 2 },
      )
      branch(
        () => {
          counts[i] = c - 2
        },
        () => {
          counts[i] = c
        },
        { m: 0, rt: 0, pt: 1, h: 0, used: 2 },
      )
    }
    if (c >= 3) {
      branch(
        () => {
          counts[i] = c - 3
        },
        () => {
          counts[i] = c
        },
        { m: 1, rt: 0, pt: 0, h: 0, used: 3 },
      )
    }
    if (c >= 4) {
      branch(
        () => {
          counts[i] = c - 4
        },
        () => {
          counts[i] = c
        },
        { m: 1, rt: 0, pt: 0, h: 0, used: 4 },
      )
    }
    if (i <= 7 && counts[i + 1] >= 1) {
      branch(
        () => {
          counts[i] -= 1
          counts[i + 1] -= 1
        },
        () => {
          counts[i] += 1
          counts[i + 1] += 1
        },
        { m: 0, rt: 1, pt: 0, h: 0, used: 2 },
      )
    }
    if (i <= 6 && counts[i + 1] >= 1 && counts[i + 2] >= 1) {
      branch(
        () => {
          counts[i] -= 1
          counts[i + 1] -= 1
          counts[i + 2] -= 1
        },
        () => {
          counts[i] += 1
          counts[i + 1] += 1
          counts[i + 2] += 1
        },
        { m: 1, rt: 0, pt: 0, h: 0, used: 3 },
      )
    }
    if (i <= 6 && counts[i + 2] >= 1) {
      branch(
        () => {
          counts[i] -= 1
          counts[i + 2] -= 1
        },
        () => {
          counts[i] += 1
          counts[i + 2] += 1
        },
        { m: 0, rt: 1, pt: 0, h: 0, used: 2 },
      )
    }
    const pruned = prune(merged)
    memo.set(key, pruned)
    return pruned
  }
  return rec(0)
}

function honorOptions(c: number): Profile[] {
  if (c <= 0) return [ZERO]
  if (c === 1) return [ZERO]
  const out: Profile[] = [
    { m: 0, rt: 0, pt: 0, h: 1, used: 2 },
    { m: 0, rt: 0, pt: 1, h: 0, used: 2 },
  ]
  if (c >= 3) out.push({ m: 1, rt: 0, pt: 0, h: 0, used: 3 })
  if (c >= 4) {
    out.push({ m: 1, rt: 0, pt: 0, h: 0, used: 4 })
    out.push({ m: 0, rt: 0, pt: 2, h: 0, used: 4 })
    out.push({ m: 0, rt: 0, pt: 1, h: 1, used: 4 })
  }
  return out
}

function honorProfiles(counts7: number[]): Profile[] {
  let acc: Profile[] = [{ ...ZERO }]
  for (const c of counts7) {
    const next: Profile[] = []
    for (const a of acc) for (const b of honorOptions(c)) next.push(addProfiles(a, b))
    acc = prune(next)
  }
  return acc
}

function formula(m: number, rt: number, pt: number, h: number, need: number): number {
  if (m >= need && (h === 1 || pt > 0)) return -1
  const slots = Math.max(0, need - m)
  const taatsu = rt + pt
  let best = need * 2 - 2 * Math.min(m, need) - Math.min(taatsu, slots) - (h ? 1 : 0)
  if (h === 0 && pt > 0) {
    const alt = need * 2 - 2 * Math.min(m, need) - Math.min(taatsu - 1, slots) - 1
    best = Math.min(best, alt)
  }
  return best
}

function withJokers(profile: Profile, jokers: number, realTiles: number, need: number): number {
  let best = 99
  const seen = new Set<string>()
  const queue: Array<[number, number, number, number, number, number]> = [
    [profile.m, profile.rt, profile.pt, profile.h, Math.max(0, realTiles - profile.used), jokers],
  ]
  while (queue.length) {
    const [m0, rt0, pt0, h0, iso, j] = queue.pop() as [number, number, number, number, number, number]
    const m = Math.min(need, m0)
    const rt = Math.min(need, rt0)
    const pt = Math.min(need, pt0)
    const key = `${m},${rt},${pt},${h0},${iso},${j}`
    if (seen.has(key)) continue
    seen.add(key)
    best = Math.min(best, formula(m, rt, pt, h0, need))
    const push = (mm: number, rr: number, pp: number, hh: number, ii: number, jj: number) => {
      queue.push([mm, rr, pp, hh, ii, jj])
    }
    if (h0 === 0 && pt > 0) push(m, rt, pt - 1, 1, iso, j)
    if (j >= 1 && rt > 0 && m < need) push(m + 1, rt - 1, pt, h0, iso, j - 1)
    if (j >= 1 && pt > 0 && m < need) push(m + 1, rt, pt - 1, h0, iso, j - 1)
    if (j >= 1 && iso > 0 && rt + pt < need) push(m, rt + 1, pt, h0, iso - 1, j - 1)
    if (j >= 1 && iso > 0 && h0 === 0) push(m, rt, pt, 1, iso - 1, j - 1)
    if (j >= 2 && h0 === 0) push(m, rt, pt, 1, iso, j - 2)
    if (j >= 2 && rt + pt < need) push(m, rt + 1, pt, h0, iso, j - 2)
    if (j >= 3 && m < need) push(m + 1, rt, pt, h0, iso, j - 3)
    if (j >= 2 && iso > 0 && m < need) push(m + 1, rt, pt, h0, iso - 1, j - 2)
  }
  return best
}

const suitMemo = new Map<string, Profile[]>()

function structural(counts: number[], jokers: number, need: number): number {
  const groups: Profile[][] = []
  for (const slice of [counts.slice(0, 9), counts.slice(9, 18), counts.slice(18, 27)]) {
    const key = slice.join('')
    let profiles = suitMemo.get(key)
    if (!profiles) {
      profiles = suitProfiles(slice)
      suitMemo.set(key, profiles)
    }
    groups.push(profiles)
  }
  groups.push(honorProfiles(counts.slice(27)))
  let acc: Profile[] = [{ ...ZERO }]
  for (const group of groups) {
    const next: Profile[] = []
    for (const a of acc) {
      for (const b of group) {
        const combined = addProfiles(a, b)
        if (combined.m > need || combined.rt + combined.pt > need + 1) continue
        next.push(combined)
      }
    }
    acc = prune(next, need)
  }
  const real = counts.reduce((s, c) => s + c, 0)
  let best = 99
  for (const profile of acc) best = Math.min(best, withJokers(profile, jokers, real, need))
  return best
}

export function isCompleteCounts(counts: number[], jokers: number, need: number, specials: boolean): boolean {
  const tiles = sumCounts(counts, jokers)
  if (specials && tiles === 17 && need === 5 && jokers < 6) {
    let honors = 0
    let orphans = 0
    for (let i = 0; i < 34; i++) {
      if (!counts[i]) continue
      if (i >= 27) honors += 1
      if (i === 0 || i === 8 || i === 9 || i === 17 || i === 18 || i === 26 || i >= 27) orphans += 1
    }
    if (isEightPairsComplete(counts, jokers)) return true
    if (orphans + jokers >= 12 && isThirteenOrphansComplete(counts, jokers)) return true
    if (honors + jokers >= 7 && isSixteenUnrelatedComplete(counts, jokers)) return true
  }
  if (tiles !== need * 3 + 2) return false
  if (need === 0) return pairOnly(counts, jokers)
  return decomposeStandard(counts, jokers, need, { max: 1 }).decomps.length > 0
}

function pairOnly(counts: number[], jokers: number): boolean {
  const tiles = sumCounts(counts, jokers)
  if (tiles !== 2) return false
  if (jokers === 2) return true
  let seen = 0
  for (const c of counts) {
    if (c === 0) continue
    seen += 1
    if (c + jokers === 2 && seen === 1 && c <= 2) return jokers === 2 - c
  }
  return false
}

function hasWait(counts: number[], jokers: number, need: number, specials: boolean): boolean {
  for (let i = 0; i < 34; i++) {
    if (counts[i] >= 4) continue
    counts[i] += 1
    const win = isCompleteCounts(counts, jokers, need, specials)
    counts[i] -= 1
    if (win) return true
  }
  return isCompleteCounts(counts, jokers + 1, need, specials)
}

function specialDistance(counts: number[], jokers: number): number {
  if (jokers > 0) return 8
  const units = eightPairUnits(counts)
  let eight = 8 - units.units
  if (units.tiles === 16 && units.units >= 8 && units.singles === 0 && units.triples === 0) eight = 0
  else if (eight < 1) eight = 2
  let present = 0
  for (const o of ORPHAN_INDEXES) if (counts[o] > 0) present += 1
  const orphans = Math.max(1, 13 - present)
  return Math.min(eight, orphans)
}

function shantenCounts(counts: number[], jokers: number, need: number, checkpoint: number, specials: boolean): number {
  const tiles = sumCounts(counts, jokers)
  const key = `${countsKey(counts, jokers)}|${need}|${checkpoint}|${specials ? 1 : 0}`
  const hit = cache.get(key)
  if (hit != null) return hit
  if (cache.size > 20000) cache.clear()
  let result: number
  if (tiles === checkpoint + 1 && isCompleteCounts(counts, jokers, need, specials)) {
    result = -1
  } else if (tiles === checkpoint + 1) {
    result = 8
    for (let i = 0; i < 34; i++) {
      if (!counts[i]) continue
      counts[i] -= 1
      result = Math.min(result, shantenCounts(counts, jokers, need, checkpoint, specials))
      counts[i] += 1
    }
    if (jokers > 0) result = Math.min(result, shantenCounts(counts, jokers - 1, need, checkpoint, specials))
  } else if (tiles === checkpoint) {
    const shaped = structural(counts, jokers, need)
    const special = specials ? specialDistance(counts, jokers) : 99
    const blended = Math.min(shaped, special)
    if (blended <= 0 || (specials && special <= 1)) {
      result = hasWait(counts, jokers, need, specials) ? 0 : Math.max(1, blended)
    } else result = blended
  } else if (tiles < checkpoint) {
    result = Math.max(checkpoint - tiles, structural(counts, jokers, need))
  } else {
    result = Math.max(0, structural(counts, jokers, need))
  }
  cache.set(key, result)
  return result
}

export interface ShantenOptions {
  /** Override how many concealed melds are still required. Drills use this. */
  meldsNeeded?: number
}

export function shanten(hand: Hand, opts?: ShantenOptions): number {
  const target = inferTarget(hand.concealed.length, hand.declared.length, opts?.meldsNeeded)
  const { counts, jokers } = countsOf(hand.concealed)
  const specials = hand.declared.length === 0 && target.need === 5
  return shantenCounts(counts, jokers, target.need, target.checkpoint, specials)
}

export function shantenOfCounts(counts: number[], jokers: number, meldsNeeded: number): number {
  const checkpoint = meldsNeeded * 3 + 1
  return shantenCounts(counts, jokers, meldsNeeded, checkpoint, meldsNeeded === 5)
}
