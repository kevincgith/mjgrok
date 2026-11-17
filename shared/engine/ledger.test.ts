import { describe, expect, it } from 'vitest'
import { fewestPayments, ledgerZeroSum, replayLedger, type LedgerEvent } from './ledger.ts'

const players = [
  { id: 'a', name: 'A' },
  { id: 'b', name: 'B' },
  { id: 'c', name: 'C' },
  { id: 'd', name: 'D' },
]

const quiet = { dealerTai: 0, streakTai: 0, jackpotEnabled: false, base: 0 }

function play(events: LedgerEvent[]) {
  return replayLedger([{ type: 'setup', players, dealerId: 'a', settings: quiet }, ...events])
}

describe('ledger', () => {
  it('builds a repeat 拉 claim 11 then 20 → worth 26, claim 37', () => {
    const state = play([
      { type: 'win', winnerId: 'a', selfDraw: false, discarderId: 'b', farn: 11 },
      { type: 'win', winnerId: 'a', selfDraw: false, discarderId: 'b', farn: 20 },
    ])
    expect(state.claims).toEqual([{ holderId: 'a', targetId: 'b', value: 37 }])
    expect(state.nets.a).toBe(11 + 26)
    expect(state.nets.b).toBe(-(11 + 26))
    expect(ledgerZeroSum(state)).toBe(0)
  })

  it('kicks back: claim 29 then plain 20 is worth 35 and the new claim starts at plain', () => {
    const state = play([
      { type: 'win', winnerId: 'a', selfDraw: false, discarderId: 'b', farn: 29 },
      { type: 'win', winnerId: 'b', selfDraw: false, discarderId: 'a', farn: 20 },
    ])
    expect(state.claims).toEqual([{ holderId: 'b', targetId: 'a', value: 20 }])
    expect(state.nets.b).toBe(-29 + 35)
    expect(state.nets.a).toBe(29 - 35)
  })

  it('pays a self-draw pairwise and keeps claims through a draw', () => {
    const state = play([
      { type: 'win', winnerId: 'a', selfDraw: true, farn: 10 },
      { type: 'draw' },
    ])
    expect(state.claims).toHaveLength(3)
    expect(state.nets.a).toBe(30)
    expect(state.nets.b).toBe(-10)
    expect(state.nets.c).toBe(-10)
    expect(state.nets.d).toBe(-10)
  })

  it('ends a holder claim when someone else wins, and a surrender pays nothing', () => {
    const afterOther = play([
      { type: 'win', winnerId: 'a', selfDraw: false, discarderId: 'b', farn: 8 },
      { type: 'win', winnerId: 'c', selfDraw: false, discarderId: 'd', farn: 4 },
    ])
    expect(afterOther.claims.find((c) => c.holderId === 'a')).toBeUndefined()
    expect(afterOther.claims).toEqual([{ holderId: 'c', targetId: 'd', value: 4 }])
    const surrendered = play([
      { type: 'win', winnerId: 'a', selfDraw: false, discarderId: 'b', farn: 8 },
      { type: 'surrender', playerId: 'c' },
    ])
    expect(surrendered.claims).toEqual([{ holderId: 'a', targetId: 'b', value: 8 }])
    expect(surrendered.nets.a).toBe(8)
    expect(surrendered.surrenderCounts.c).toBe(1)
  })

  it('keeps the jackpot and the table zero-sum, including a taken pot', () => {
    const state = replayLedger([
      { type: 'setup', players, dealerId: 'a', settings: { ...quiet, jackpotEnabled: true, jackpotPerDraw: 5 } },
      { type: 'win', winnerId: 'b', selfDraw: false, discarderId: 'c', farn: 2, takeJackpot: true },
    ])
    expect(state.pot).toBe(0)
    expect(ledgerZeroSum(state)).toBe(0)
    expect(state.nets.b).toBe(-5 + 2 + 20)
    expect(state.nets.a + state.nets.b + state.nets.c + state.nets.d).toBe(0)
  })

  it('passes the dealer and names the round, then prompts after the north round', () => {
    const state = play([{ type: 'win', winnerId: 'b', selfDraw: false, discarderId: 'c', farn: 1 }])
    expect(state.dealerId).toBe('b')
    expect(state.label).toBe('東風南局')
    const events: LedgerEvent[] = [{ type: 'setup', players, dealerId: 'a', settings: quiet }]
    for (let i = 0; i < 16; i++) {
      const dealer = ['a', 'b', 'c', 'd'][i % 4]
      const winner = ['a', 'b', 'c', 'd'][(i + 1) % 4]
      events.push({ type: 'win', winnerId: winner, selfDraw: false, discarderId: dealer, farn: 1 })
    }
    const done = replayLedger(events)
    expect(done.seatPrompt).toBe(true)
  })

  it('undoes by replaying without the last event', () => {
    const events: LedgerEvent[] = [
      { type: 'setup', players, dealerId: 'a', settings: quiet },
      { type: 'win', winnerId: 'a', selfDraw: false, discarderId: 'b', farn: 11 },
      { type: 'win', winnerId: 'a', selfDraw: false, discarderId: 'b', farn: 20 },
    ]
    const full = replayLedger(events)
    const undone = replayLedger(events.slice(0, -1))
    expect(undone.claims[0].value).toBe(11)
    expect(full.claims[0].value).toBe(37)
    expect(replayLedger([...events.slice(0, -1), events[2]]).claims[0].value).toBe(37)
  })

  it('pays 反雪 from each prior winner on the discarder\'s next win and does not cap the payment at 封頂', () => {
    const state = replayLedger([
      { type: 'setup', players, dealerId: 'a', settings: { ...quiet, limitInput: 999, counterSnowDouble: 5 } },
      { type: 'multi', discarderId: 'a', winners: [{ id: 'b', farn: 4 }, { id: 'c', farn: 6 }] },
      { type: 'draw' },
      { type: 'win', winnerId: 'a', selfDraw: true, farn: 5000 },
    ])
    expect(state.pendingSnow).toBeNull()
    expect(state.nets.a).toBeGreaterThan(5000)
    expect(state.nets.b).toBeLessThan(0)
    expect(state.nets.c).toBeLessThan(0)
    expect(state.settings.limitInput).toBe(999)
    expect(ledgerZeroSum(state)).toBe(0)
  })

  it('keeps a substituted player\'s total on their identity and does not move it on a seat swap', () => {
    const state = replayLedger([
      { type: 'setup', players, dealerId: 'a', settings: quiet },
      { type: 'win', winnerId: 'a', selfDraw: true, farn: 10, patterns: [{ id: 'all-pungs', nameZh: '對對胡', tai: 40, count: 1 }] },
      { type: 'substitute', outId: 'a', player: { id: 'e', name: 'E' } },
      { type: 'swap', a: 'e', b: 'b' },
    ])
    expect(state.nets.a).toBe(30)
    expect(state.nets.e).toBe(0)
    expect(state.seatOrder[state.seatOrder.indexOf('b')]).toBe('b')
    expect(state.seatOrder).toContain('e')
    expect(state.seatOrder).not.toContain('a')
    expect(state.roster.map((p) => p.id)).toContain('a')
    expect(state.wins.a).toBe(1)
    expect(state.patternCounts.a['all-pungs']).toBe(1)
    expect(state.paid.b.a).toBe(10)
    expect(ledgerZeroSum(state)).toBe(0)
    const swapped = state.seatOrder
    const again = replayLedger([
      { type: 'setup', players, dealerId: 'a', settings: quiet },
      { type: 'win', winnerId: 'a', selfDraw: true, farn: 10 },
      { type: 'substitute', outId: 'a', player: { id: 'e', name: 'E' } },
      { type: 'swap', a: 'e', b: 'b' },
    ])
    expect(again.seatOrder).toEqual(swapped)
    expect(again.nets).toEqual(state.nets)
  })

  it('settles with the fewest payments', () => {
    const payments = fewestPayments({ a: 30, b: -10, c: -20, d: 0 })
    expect(payments).toHaveLength(2)
    expect(payments.reduce((s, p) => s + p.amount, 0)).toBe(30)
  })
})
