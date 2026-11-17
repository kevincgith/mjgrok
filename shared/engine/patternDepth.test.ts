import { describe, expect, it } from 'vitest'
import { parseHand } from './notation.ts'
import { scoreHand } from './scoring.ts'
import { defaultSituation, type Situation } from './tiles.ts'
import type { RuleDiff } from './rules.ts'

function score(notation: string, sit: Partial<Situation> = {}, rules?: RuleDiff) {
  const result = scoreHand(parseHand(notation), { ...defaultSituation(), ...sit }, rules)[0]
  const matches = [...(result?.matches ?? []), ...(result?.second?.matches ?? [])]
  const byId = new Map(matches.map((m) => [m.id, m]))
  return { result, byId, total: result?.total ?? 0 }
}

describe('pattern values, exclusions, and repeats', () => {
  it('pays pure all-runs 20 and drops 平胡, 無字, and 無花', () => {
    const s = score('123m456m789m123t456t99t')
    expect(s.byId.get('pure-all-runs')?.tai).toBe(20)
    expect(s.byId.get('base')?.tai).toBe(5)
    expect(s.byId.get('concealed-hand')?.tai).toBe(5)
    expect(s.byId.has('all-runs')).toBe(false)
    expect(s.byId.has('no-honor')).toBe(false)
    expect(s.byId.has('no-flowers')).toBe(false)
  })

  it('counts two concealed pure straights when 789 is duplicated', () => {
    const s = score('123456789789m123t11t')
    const straight = s.byId.get('straight-hidden')
    expect(straight?.count).toBe(2)
    expect(straight?.tai).toBe(40)
    expect(straight?.instances.length).toBe(2)
    expect(s.byId.has('straight-open')).toBe(false)
  })

  it('picks the pung reading of 111222333 when it outscores the chow reading', () => {
    const s = score('111222333444555m99t')
    expect(s.byId.get('all-pungs')?.tai).toBe(40)
    expect(s.byId.has('all-runs')).toBe(false)
    expect(s.result?.decomposition.melds.every((m) => m.type === 'pung' || m.type === 'kong')).toBe(true)
  })

  it('scores an open identical-run pair at 5 and not the concealed 8', () => {
    const open = score('(123m)123m456m789m123t99t')
    expect(open.byId.get('identical-open')?.tai).toBe(5)
    expect(open.byId.has('identical-hidden')).toBe(false)
    const hidden = score('123123m456m789m123t99t')
    expect(hidden.byId.get('identical-hidden')?.tai).toBe(8)
    expect(hidden.byId.has('identical-open')).toBe(false)
  })

  it('does not award 清一色 to a hand that still has an honor', () => {
    const s = score('123456789m456m111z99m')
    expect(s.byId.get('mixed-flush')?.tai).toBe(40)
    expect(s.byId.has('pure-flush')).toBe(false)
  })

  it('lets 三元牌 score again when 大三元 is switched off', () => {
    const hand = '(555z)(666z)(777z)123m456m99t'
    const house = score(hand)
    expect(house.byId.get('big-dragons')?.tai).toBe(80)
    expect(house.byId.has('dragon')).toBe(false)
    const off = score(hand, {}, { name: 'No big dragons', values: { 'big-dragons': 0 } })
    expect(off.byId.has('big-dragons')).toBe(false)
    expect(off.byId.get('dragon')?.count).toBe(3)
    expect(off.byId.get('dragon')?.tai).toBe(6)
  })

  it('does not let a zeroed 無字花 keep suppressing 無花', () => {
    const hand = '123m456m789m123t456t99t'
    const house = score(hand)
    expect(house.byId.has('no-flowers')).toBe(false)
    const off = score(hand, {}, { name: 'No pure flower', values: { 'no-honor-flower': 0, 'pure-all-runs': 0 } })
    expect(off.byId.has('no-honor-flower')).toBe(false)
    expect(off.byId.get('no-flowers')?.tai).toBe(2)
    expect(off.byId.get('no-honor')?.tai).toBe(2)
  })

  it('sums eight-pairs and the ordinary reading instead of keeping only the larger', () => {
    const s = score('11122334455667788m')
    expect(s.result?.second).toBeTruthy()
    const eight = s.byId.get('eight')?.tai ?? 0
    expect(eight).toBeGreaterThanOrEqual(50)
    expect(s.total).toBeGreaterThan(eight)
    expect(s.total).toBe((s.result?.matches.reduce((n, m) => n + m.tai, 0) ?? 0) + (s.result?.second?.total ?? 0))
  })

  it('scores 海底撈月(一筒) at 20 and drops plain 海底撈月', () => {
    const s = score('123m456m789m123t456t11*t', { lastTileWin: 'sea-bottom', selfDraw: true })
    expect(s.byId.get('sea-one')?.tai).toBe(20)
    expect(s.byId.has('sea')).toBe(false)
  })

  it('refuses 坎坎胡 without a self-draw and refuses it when a kong replaces a pung', () => {
    expect(score('111222333m444t555b11z').byId.has('five-concealed-draw')).toBe(false)
    expect(score('111222333m444t555b11z', { selfDraw: true }).byId.get('five-concealed-draw')?.tai).toBe(160)
    expect(score('(1111m)222333444555m11z', { selfDraw: true }).byId.has('five-concealed-draw')).toBe(false)
  })
})
