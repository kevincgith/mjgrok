import { describe, expect, it } from 'vitest'
import { analyzeDiscards, analyzeNextDraws, type TwoStep } from './discards.ts'
import { clearShantenCache, shanten } from './shanten.ts'
import { parseHand } from './notation.ts'
import { KIND_COUNT, countsOf, declaredCounts, indexKind, type Hand } from './tiles.ts'

/** Standard meld+pair completer. No jokers and no specials, so it is independent of the engine search. */
function complete(counts: number[], need: number): boolean {
  const tiles = counts.reduce((sum, n) => sum + n, 0)
  if (tiles !== need * 3 + 2) return false
  return fill(counts, need, false)
}

function fill(counts: number[], melds: number, paired: boolean): boolean {
  let i = 0
  while (i < KIND_COUNT && counts[i] === 0) i += 1
  if (i === KIND_COUNT) return melds === 0 && paired
  if (!paired && counts[i] >= 2) {
    counts[i] -= 2
    if (fill(counts, melds, true)) {
      counts[i] += 2
      return true
    }
    counts[i] += 2
  }
  if (melds > 0 && counts[i] >= 3) {
    counts[i] -= 3
    if (fill(counts, melds - 1, paired)) {
      counts[i] += 3
      return true
    }
    counts[i] += 3
  }
  if (melds > 0 && i < 27 && i % 9 <= 6 && counts[i + 1] > 0 && counts[i + 2] > 0) {
    counts[i] -= 1
    counts[i + 1] -= 1
    counts[i + 2] -= 1
    if (fill(counts, melds - 1, paired)) {
      counts[i] += 1
      counts[i + 1] += 1
      counts[i + 2] += 1
      return true
    }
    counts[i] += 1
    counts[i + 1] += 1
    counts[i + 2] += 1
  }
  return false
}

function waitsOf(counts: number[], need: number, held: number[]): string[] {
  const names: string[] = []
  for (let i = 0; i < KIND_COUNT; i++) {
    if (counts[i] >= 4 || held[i] >= 4) continue
    counts[i] += 1
    const win = complete(counts, need)
    counts[i] -= 1
    if (!win) continue
    const left = 4 - held[i]
    if (left > 0) names.push(`${indexKind(i)}×${left}`)
  }
  return names.sort()
}

function engineWaits(step: TwoStep): string[] {
  return step.waits.map((w) => `${w.kind}×${w.remaining}`).sort()
}

function referenceNext(counts: number[], need: number, held: number[]): Map<string, { discard: string; waits: string[] }> {
  const found = new Map<string, { discard: string; waits: string[] }>()
  for (let draw = 0; draw < KIND_COUNT; draw++) {
    if (held[draw] >= 4 || counts[draw] >= 4) continue
    counts[draw] += 1
    let best: { discard: string; waits: string[]; total: number } | null = null
    for (let tile = 0; tile < KIND_COUNT; tile++) {
      if (!counts[tile]) continue
      counts[tile] -= 1
      const finalHeld = held.slice()
      finalHeld[draw] += 1
      const waits = waitsOf(counts, need, finalHeld)
      counts[tile] += 1
      if (!waits.length) continue
      const total = waits.reduce((sum, name) => sum + Number(name.split('×')[1]), 0)
      const discard = indexKind(tile)
      if (!best || total > best.total || (total === best.total && discard.localeCompare(best.discard) < 0)) {
        best = { discard, waits, total }
      }
    }
    counts[draw] -= 1
    if (best) found.set(indexKind(draw), { discard: best.discard, waits: best.waits })
  }
  return found
}

function heldOf(hand: Hand, extra: Record<string, number> = {}): number[] {
  const { counts } = countsOf(hand.concealed)
  const declared = declaredCounts(hand)
  const held = counts.slice()
  for (let i = 0; i < KIND_COUNT; i++) held[i] += declared[i] + (extra[indexKind(i)] ?? 0)
  return held
}

function expectNextMatchesReference(notation: string, discarded: Record<string, number> = {}) {
  const hand = parseHand(notation)
  const need = hand.declared.length ? 5 - hand.declared.length : (hand.concealed.length - 1) / 3
  const { counts } = countsOf(hand.concealed)
  const held = heldOf(hand, discarded)
  const distance = shanten(hand, { meldsNeeded: need })
  const tenpai = waitsOf(counts, need, held).length > 0
  const draws = analyzeNextDraws(hand, { discarded })
  if (tenpai) {
    expect(distance, notation).toBe(0)
    expect(draws, notation).toBeNull()
    return
  }
  expect(distance, notation).toBe(1)
  const reference = referenceNext(counts, need, held)
  expect(draws, notation).not.toBeNull()
  const got = new Map((draws ?? []).filter((step) => step.shanten <= 0).map((step) => [step.draw, step]))
  expect([...got.keys()].sort(), notation).toEqual([...reference.keys()].sort())
  for (const [kind, step] of got) {
    const want = reference.get(kind)
    expect(step.discard, `${notation} draw ${kind}`).toBe(want?.discard)
    expect(engineWaits(step), `${notation} draw ${kind}`).toEqual(want?.waits)
    expect(step.waits.every((w) => w.remaining <= 4)).toBe(true)
  }
  const rows = analyzeDiscards(hand, { discarded })
  for (const row of rows) {
    expect(row.waits, `${notation} discard ${row.discard}`).toEqual([])
    expect(row.shanten).toBeGreaterThan(0)
    for (const step of row.twoStep) {
      expect(step.discard, 'a repair draw has no second discard').toBeUndefined()
      if (step.shanten > 0) expect(step.waits).toEqual([])
      else for (const wait of step.waits) expect(wait.remaining).toBeGreaterThan(0)
    }
    expect(row.twoStep.map((step) => step.draw).sort()).toEqual(row.accepting.map((tile) => tile.kind).sort())
  }
}

describe('checkpoint lookahead', () => {
  it('treats a 1-tile checkpoint as a pair wait and the extra tile as a real discard', () => {
    const hand = parseHand('1m')
    expect(shanten(hand)).toBe(0)
    expect(analyzeNextDraws(hand)).toBeNull()
    const rows = analyzeDiscards(parseHand('1m9t'))
    const keep = rows.find((row) => row.discard === '9t')
    const other = rows.find((row) => row.discard === '1m')
    expect(keep?.shanten).toBe(0)
    expect(keep?.waits.map((w) => `${w.kind}×${w.remaining}`)).toEqual(['1m×3'])
    expect(keep?.twoStep).toEqual([])
    expect(other?.waits.map((w) => `${w.kind}×${w.remaining}`)).toEqual(['9t×3'])
  })

  it('matches an independent completer at every checkpoint size', () => {
    const hands = [
      '12m9t5b',
      '123m45t9b1z',
      '123m456m78t9b1z',
      '123m456m789m12t9b1z',
      '123m456m789m123t449t7b',
    ]
    for (const notation of hands) expectNextMatchesReference(notation)
  })

  it('matches the same completer with two declared melds and with a kong', () => {
    expectNextMatchesReference('(111z)(222z)123m456m78t9b1z')
    expectNextMatchesReference('(1111z)123m456m789m34t2b9t')
  })

  it('keeps a just-drawn extra tile consistent with the checkpoint plan', () => {
    const base = '123m456m789m123t449t7b'
    const plan = analyzeNextDraws(parseHand(base)) ?? []
    const rows = analyzeDiscards(parseHand(`${base}3z`))
    const extra = rows.find((row) => row.discard === '3z')
    expect(extra?.twoStep.map((step) => `${step.draw}:${step.discard}:${engineWaits(step).join(',')}`)).toEqual(
      plan.map((step) => `${step.draw}:${step.discard}:${engineWaits(step).join(',')}`),
    )
    expect(rows.filter((row) => row.shanten > 0).every((row) => row.twoStep.length === row.accepting.length && row.twoStep.length > 0)).toBe(true)
  })

  it('does not offer an exhausted kind or a fifth copy', () => {
    const notation = '123m456m789m123t449t7b'
    const open = analyzeNextDraws(parseHand(notation)) ?? []
    expect(open.some((step) => step.draw === '9t')).toBe(true)
    const closed = analyzeNextDraws(parseHand(notation), { discarded: { '9t': 3 } }) ?? []
    expect(closed.some((step) => step.draw === '9t')).toBe(false)
    const kong = analyzeDiscards(parseHand('(1111z)123m456m789m123t99t'))
    for (const row of kong) {
      expect(row.accepting.some((tile) => tile.kind === '1z')).toBe(false)
      expect(row.twoStep.some((step) => step.draw === '1z' || step.waits.some((w) => w.kind === '1z'))).toBe(false)
    }
  })

  it('counts a joker already in hand without inventing a joker draw', () => {
    const hand = parseHand('123m456m789m123t19b2zj')
    const draws = analyzeNextDraws(hand)
    expect(draws).not.toBeNull()
    expect(draws?.some((step) => step.draw === 'j')).toBe(false)
    const rows = analyzeDiscards(hand)
    expect(rows.some((row) => row.discard === 'j')).toBe(true)
    for (const row of rows) {
      for (const step of row.twoStep) expect(step.draw).not.toBe('j')
      for (const tile of row.accepting) expect(tile.remaining).toBeLessThanOrEqual(4)
    }
  })

  it('does not call a 15-tile remainder tenpai', () => {
    const rows = analyzeDiscards(parseHand('123m456m789m123t456t'))
    expect(rows.length).toBeGreaterThan(0)
    for (const row of rows) {
      expect(row.waits).toEqual([])
      expect(row.twoStep).toEqual([])
      expect(row.shanten).toBeGreaterThan(0)
    }
  })

  it('stops a stale request while building the checkpoint plan', () => {
    const hand = parseHand('123m456m789m123t449t7b')
    expect(analyzeDiscards(hand, { aborted: () => true })).toEqual([])
    expect(analyzeNextDraws(hand, { aborted: () => true })).toBeNull()
  })

  it('lists every useful later draw of a 17-tile discard, not a silent first eight', () => {
    const rows = analyzeDiscards(parseHand('123m456m789m123t456t9t1b'))
    const one = rows.find((row) => row.discard === '1m')
    expect(one?.accepting.map((tile) => tile.kind).sort()).toEqual(['1b', '1m', '4m', '7m', '9t'])
    expect(one?.twoStep.map((step) => step.draw).sort()).toEqual(one?.accepting.map((tile) => tile.kind).sort())
    expect(one?.twoStep.every((step) => step.discard && step.shanten <= 0 && step.waits.length > 0)).toBe(true)
    const sample = one?.twoStep.find((step) => step.draw === '9t')
    expect(sample?.discard).toBeTruthy()
    expect(engineWaits(sample as TwoStep).length).toBeGreaterThan(0)
  })
})

describe('lookahead cost', () => {
  it('keeps the mixed 17-tile cold median under the previous loose bound', () => {
    const hand = parseHand('123m456m789m123t456t9t1b')
    const samples: number[] = []
    for (let i = 0; i < 5; i++) {
      clearShantenCache()
      const started = performance.now()
      analyzeDiscards(hand)
      samples.push(performance.now() - started)
    }
    samples.sort((a, b) => a - b)
    const p50 = samples[2]
    expect(p50, `p50 ${p50.toFixed(1)} ms [${samples.map((n) => n.toFixed(1)).join(', ')}]`).toBeLessThan(450)
  })
})
