import { describe, expect, it } from 'vitest'
import { parseHand } from './notation.ts'
import { scoreHand, ledgerFarn } from './scoring.ts'
import { clampFarnInput, defaultLedgerSettings, replayLedger, ledgerZeroSum } from './ledger.ts'
import { defaultSituation } from './tiles.ts'
import { shanten, shantenOfCounts } from './shanten.ts'
import { resolveEightFill } from './specials.ts'
import { countsOf } from './tiles.ts'

const RUN = '123m456m789m123t456t99t'

describe('acceptance handoff and caps', () => {
  it('caps the typed farn at the editable 封頂 and does not cap the payment', () => {
    expect(clampFarnInput('5000', 999)).toBe('999')
    expect(clampFarnInput('40', 999)).toBe('40')
    expect(clampFarnInput('12abc', 20)).toBe('12')
    const state = replayLedger([
      { type: 'setup', players: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }, { id: 'c', name: 'C' }, { id: 'd', name: 'D' }], dealerId: 'b', settings: { ...defaultLedgerSettings(), limitInput: 999, jackpotEnabled: false, base: 0, dealerTai: 0, streakTai: 0 } },
      { type: 'win', winnerId: 'a', selfDraw: false, discarderId: 'b', farn: 5000 },
    ])
    expect(state.nets.a).toBe(5000)
    expect(state.nets.b).toBe(-5000)
    expect(state.settings.limitInput).toBe(999)
  })

  it('sends the scored total minus dealer and minus 雙響, because the ledger adds both back', () => {
    const result = scoreHand(parseHand(RUN), { ...defaultSituation(), dealerStreak: 2, multiWin: 'double' })[0]
    expect(result).toBeTruthy()
    const dealer = result!.matches.find((m) => m.id === 'dealer')
    const multi = result!.matches.find((m) => m.id === 'double-win')
    expect(dealer?.tai).toBe(3)
    expect(multi?.tai).toBe(5)
    const sent = ledgerFarn(result!)
    expect(sent.multi).toBe('double')
    expect(sent.farn).toBe(result!.total - 3 - 5)
    const state = replayLedger([
      { type: 'setup', players: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }, { id: 'c', name: 'C' }, { id: 'd', name: 'D' }], dealerId: 'a', settings: { ...defaultLedgerSettings(), jackpotEnabled: false, base: 0, dealerTai: 1, streakTai: 2 } },
      { type: 'dealer', streak: 1 },
      { type: 'win', winnerId: 'a', selfDraw: false, discarderId: 'b', farn: sent.farn, multi: sent.multi, patterns: result!.matches.map((m) => ({ id: m.id, nameZh: m.nameZh, tai: m.tai, count: m.count })) },
    ])
    expect(state.nets.b).toBe(-(sent.farn + 3 + 5))
    expect(state.patternCounts.a['double-win']).toBe(1)
    expect(ledgerZeroSum(state)).toBe(0)
  })

  it('detects 正圈風 and 大四連刻 again when their zero values are turned on', () => {
    const round = scoreHand(parseHand('(111z)123m456m789m123t99m'), { ...defaultSituation(), roundWind: 1 }, { name: 'Round on', values: { 'right-round': 2 } })[0]
    expect(round?.matches.find((m) => m.id === 'right-round')?.tai).toBe(2)
    const off = scoreHand(parseHand('(111z)123m456m789m123t99m'), { ...defaultSituation(), roundWind: 1 })[0]
    expect(off?.matches.some((m) => m.id === 'right-round')).toBe(false)
    const chain = scoreHand(parseHand('(111m)(222m)(333m)(444m)555t99t'), defaultSituation(), { name: 'Chain on', values: { chain4: 25 } })[0]
    const row = chain?.matches.find((m) => m.id === 'chain4')
    expect(row?.tai).toBeGreaterThan(0)
    expect(row?.count).toBeGreaterThan(0)
    const straight = scoreHand(parseHand('123456789789m123t11t'))[0]
    const hidden = straight?.matches.find((m) => m.id === 'straight-hidden')
    expect(hidden?.count).toBe(2)
    expect(hidden?.instances).toHaveLength(2)
    expect(hidden?.instances[0]?.flat().some((tile) => tile.endsWith('m'))).toBe(true)
  })

  it('rejects a fifth copy split between a kong and a loose tile', () => {
    expect(() => parseHand('(1111m)1m')).toThrow(/4 copies/)
    expect(() => parseHand('[1111z]11z')).toThrow(/4 copies/)
  })

  it('resolves two jokers in an eight-pair hand and keeps shanten at the concrete fill', () => {
    const text = '1122m3344t5566b77z1zjj'
    const hand = parseHand(text)
    const { counts, jokers } = countsOf(hand.concealed)
    const fill = resolveEightFill(counts, jokers)
    expect(fill?.standIns).toHaveLength(2)
    expect(scoreHand(hand)[0]?.matches.some((m) => m.id === 'eight' || m.id === 'eight-fly')).toBe(true)
    expect(shanten(hand)).toBe(-1)
    const filled = counts.slice()
    for (const idx of fill!.standIns) filled[idx] += 1
    expect(shantenOfCounts(filled, 0, 5)).toBe(-1)
  })
})
