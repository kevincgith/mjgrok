import { describe, expect, it } from 'vitest'
import { assignCeremony, CEREMONY_STEPS, countedSeat, windsFromEnd } from './ceremony.ts'
import { replayLedger, ledgerZeroSum, type LedgerEvent } from './ledger.ts'

describe('seating ceremony', () => {
  it('has eight steps and counts counterclockwise', () => {
    expect(CEREMONY_STEPS).toHaveLength(8)
    expect(countedSeat(0, 9)).toBe(0)
    expect(countedSeat(0, 1)).toBe(0)
    expect(countedSeat(1, 3)).toBe(3)
    expect(countedSeat(0, 12)).toBe(3)
  })

  it('reads winds from the 二筒 end on an even total and the 一筒 end on an odd total', () => {
    const order = [4, 0, 1, 5, 2, 3]
    const even = windsFromEnd(order, 8)
    const odd = windsFromEnd(order, 7)
    expect(even.every((label) => !label.includes('筒'))).toBe(true)
    expect(odd.every((label) => !label.includes('筒'))).toBe(true)
    expect(even).toHaveLength(4)
    expect(odd[0]).not.toBe(even[0])
  })

  it('keeps the bottom player at the bottom and makes the East player the dealer', () => {
    const ids = ['a', 'b', 'c', 'd']
    const labels = windsFromEnd([0, 1, 2, 3, 4, 5], 7)
    const placed = assignCeremony(ids, 2, labels, 'a')
    expect(placed.order[0]).toBe('a')
    expect(placed.winds[placed.eastId]).toBe(1)
    expect(new Set(placed.order)).toEqual(new Set(ids))
    const events: LedgerEvent[] = [
      { type: 'setup', players: ids.map((id) => ({ id, name: id.toUpperCase() })), dealerId: 'a' },
      { type: 'seats', order: placed.order, winds: placed.winds },
      { type: 'dealer', dealerId: placed.eastId, streak: 0 },
    ]
    const state = replayLedger(events)
    expect(state.seatOrder[0]).toBe('a')
    expect(state.dealerId).toBe(placed.eastId)
    expect(state.winds.a).toBe(placed.winds.a)
    expect(ledgerZeroSum(state)).toBe(0)
  })
})
