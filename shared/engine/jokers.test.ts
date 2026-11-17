import { describe, expect, it } from 'vitest'
import { parseHand } from './notation.ts'
import { scoreHand } from './scoring.ts'
import { shanten } from './shanten.ts'
import { findWaits } from './waits.ts'
import { resolveEightFill, resolveOrphanFill, resolveSixteenFill } from './specials.ts'
import { countsOf, kindIndex } from './tiles.ts'

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

  it('rejects a fifth copy even when a joker could pretend to be that kind', () => {
    expect(() => parseHand('1111mj')).not.toThrow()
    expect(() => parseHand('11111m')).toThrow(/4 copies/)
  })
})
