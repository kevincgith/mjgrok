export const CEREMONY_STEPS = [
  'Provisional East throws 3 dice',
  'Total count picks the real East seat',
  'Real East throws',
  'Flip all 6 tiles',
  'Earlier 筒 moves left, the other end moves right',
  'Second total from real East picks the first player',
  'Read winds from the 二筒 end if the total is even, otherwise the 一筒 end',
  'Move to the assigned seats, East at the bottom',
] as const

export const CEREMONY_TILES = ['東', '南', '西', '北', '一筒', '二筒'] as const

/** Count n seats counterclockwise from start: (start + n - 1) mod 4. */
export function countedSeat(start: number, total: number): number {
  return (start + total - 1) % 4
}

/** Even second total reads from 二筒. Odd reads from 一筒. Tubes themselves are not winds. */
export function windsFromEnd(order: number[], secondTotal: number): string[] {
  const fromTwo = secondTotal % 2 === 0
  const start = fromTwo ? order.indexOf(5) : order.indexOf(4)
  const winds: string[] = []
  for (let n = 1; n <= 6 && winds.length < 4; n++) {
    const label = CEREMONY_TILES[order[(start + n) % 6]]
    if (!label || label === '一筒' || label === '二筒') continue
    winds.push(label)
  }
  return winds
}

export interface SeatAssignment {
  order: string[]
  winds: Record<string, 1 | 2 | 3 | 4>
  eastId: string
}

/**
 * Give the four winds to the four seated ids, starting at `reader` and walking
 * the wind labels. Then rotate so `bottomId` stays at index 0. Neighbors follow
 * the wind ring. East is the dealer.
 */
export function assignCeremony(ids: string[], reader: number, windLabels: string[], bottomId: string): SeatAssignment {
  const valueOf: Record<string, 1 | 2 | 3 | 4> = { '東': 1, '南': 2, '西': 3, '北': 4 }
  const winds: Record<string, 1 | 2 | 3 | 4> = {}
  windLabels.forEach((label, n) => {
    const id = ids[(reader + n) % ids.length]
    const value = valueOf[label]
    if (id && value) winds[id] = value
  })
  const ring = [1, 2, 3, 4]
    .map((value) => Object.entries(winds).find(([, wind]) => wind === value)?.[0])
    .filter((id): id is string => !!id)
  const at = ring.indexOf(bottomId)
  const order = ring.length === ids.length && at >= 0 ? [...ring.slice(at), ...ring.slice(0, at)] : ids.slice()
  const eastId = Object.entries(winds).find(([, wind]) => wind === 1)?.[0] ?? ids[0]
  return { order, winds, eastId }
}
