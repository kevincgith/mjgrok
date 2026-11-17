import { describe, expect, it } from 'vitest'
import { analyzeDiscards } from './discards.ts'
import { parseHand } from './notation.ts'
import { findWaits } from './waits.ts'

describe('waits', () => {
  it('lists the pair wait and the copies still outside the hand', () => {
    const result = findWaits(parseHand('123m456m789m123t456t9t'))
    expect(result.shanten).toBe(0)
    expect(result.atCheckpoint).toBe(true)
    const nine = result.waits.find((w) => w.kind === '9t')
    expect(nine?.remaining).toBe(3)
    expect(result.total).toBeGreaterThan(0)
    expect(nine?.decompositions.length).toBeGreaterThan(0)
  })

  it('returns every decomposition of an ambiguous wait', () => {
    const result = findWaits(parseHand('111222333m9t'), { meldsNeeded: 3 })
    const nine = result.waits.find((w) => w.kind === '9t')
    const shapes = (nine?.decompositions ?? []).map((d) => d.melds.map((m) => m.type).sort().join(','))
    expect(shapes.some((s) => s.includes('pung,pung,pung'))).toBe(true)
    expect(shapes.some((s) => s.includes('chow,chow,chow'))).toBe(true)
  })

  it('ranks a just-drawn discard without calling the estimate exact', () => {
    const rows = analyzeDiscards(parseHand('123m456m789m123t456t9t1b'))
    expect(rows[0].estimate).toBe(true)
    expect(rows[0].discard).toBe('1b')
    expect(rows[0].tenpaiPercent).toBe(100)
    for (const row of rows) {
      expect(row.winPercent).toBeGreaterThanOrEqual(0)
      expect(row.winPercent).toBeLessThanOrEqual(100)
    }
  })

  it('does not offer an exhausted kind as a draw', () => {
    const rows = analyzeDiscards(parseHand('123m456m789m123t147b2z'), { discarded: { '3b': 4, '6b': 4, '9b': 4 } })
    const row = rows.find((r) => r.discard === '2z')
    expect(row?.accepting.some((t) => t.kind === '3b' || t.kind === '6b' || t.kind === '9b')).toBe(false)
  })
})
