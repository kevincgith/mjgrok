import { describe, expect, it } from 'vitest'
import { parseHand } from './notation.ts'
import { scoreHand } from './scoring.ts'
import { shanten, shantenOfCounts } from './shanten.ts'
import { findWaits } from './waits.ts'
import { resolveEightFill, resolveOrphanFill, resolveSixteenFill } from './specials.ts'
import { countsOf, kindIndex } from './tiles.ts'

function mulberry(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function counts(text: string) {
  const { counts: c, jokers } = countsOf(parseHand(text).concealed)
  return { c, jokers }
}

describe('jokers on special hands', () => {
  it('completes eight pairs when a joker stands in for the triple', () => {
    const { c, jokers } = counts('1122m3344t5566b77z11zj')
    expect(jokers).toBe(1)
    const fill = resolveEightFill(c, jokers)
    expect(fill).toBeTruthy()
    expect(fill!.standIns).toEqual([kindIndex('7z')])
    const scored = scoreHand(parseHand('1122m3344t5566b77z11zj'))
    expect(scored[0]?.matches.some((m) => m.id === 'eight')).toBe(true)
    expect(scored[0]?.decomposition.jokerStandIns).toContain('7z')
  })

  it('is tenpai for eight pairs when the joker is the tile still needed', () => {
    const hand = parseHand('1122m3344t5566b77z11z')
    expect(shanten(hand)).toBe(0)
    const waits = findWaits(hand)
    expect(waits.waits.some((w) => w.kind === '7z' || w.kind === 'j')).toBe(true)
  })

  it('scores thirteen orphans with a joker standing in for a missing orphan', () => {
    const { c, jokers } = counts('1m19t19b1234567z777z1mj')
    const fill = resolveOrphanFill(c, jokers)
    expect(fill?.standIns).toContain(kindIndex('9m'))
    const scored = scoreHand(parseHand('1m19t19b1234567z777z1mj'))
    expect(scored[0]?.matches.some((m) => m.id === 'orphans')).toBe(true)
    expect(scored[0]?.total).toBeGreaterThanOrEqual(160)
  })

  it('scores sixteen unrelated with a joker filling one missing kind', () => {
    const { c, jokers } = counts('147m147t147b1234567zj')
    expect(resolveSixteenFill(c, jokers)?.standIns.length).toBeGreaterThan(0)
    const scored = scoreHand(parseHand('147m147t147b1234567zj'))
    expect(scored[0]?.matches.some((m) => m.id === 'sixteen' || m.id === 'sixteen-fly')).toBe(true)
  })

  it('matches a concrete stand-in on seeded joker tenpai hands', () => {
    const rand = mulberry(20261117)
    for (let n = 0; n < 20; n++) {
      const counts = new Array<number>(34).fill(0)
      const kinds: number[] = []
      while (kinds.length < 13) {
        const idx = Math.floor(rand() * 9)
        if (counts[idx] >= 4) continue
        counts[idx] += 1
        kinds.push(idx)
      }
      const hand = parseHand(kinds.map((i) => `${(i % 9) + 1}m`).join('') + 'j')
      const value = shanten(hand, { meldsNeeded: 4 })
      const filled = counts.slice()
      // The joker can stand in for any kind still under the copy cap, so the
      // joker hand is never farther from tenpai than the best single fill.
      let best = 8
      for (let i = 0; i < 9; i++) {
        if (filled[i] >= 4) continue
        filled[i] += 1
        best = Math.min(best, shantenOfCounts(filled, 0, 4))
        filled[i] -= 1
      }
      expect(value).toBeLessThanOrEqual(best)
      expect(value).toBeGreaterThanOrEqual(best - 1)
    }
  })

  it('rejects a fifth copy even when a joker could pretend to be that kind', () => {
    expect(() => parseHand('1111mj')).not.toThrow()
    expect(() => parseHand('11111m')).toThrow(/4 copies/)
  })
})
