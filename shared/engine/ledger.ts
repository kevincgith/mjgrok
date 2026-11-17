export interface LedgerPlayer {
  id: string
  name: string
}

export interface LedgerSettings {
  base: number
  dealerTai: number
  streakTai: number
  counterSnowDouble: number
  counterSnowTriple: number
  /** Stored and shown. Payments are never capped by it. */
  limitInput: number
  dealerStaysOnDraw: boolean
  jackpotEnabled: boolean
  jackpotPerDraw: number
  integerMode: boolean
  laRoundUp: boolean
  highScore: number
  surrenderHint: number
  falseWinPenalty: number
  dollarPerFarn: number
  bonuses: Record<string, number>
}

export interface PatternUse {
  id: string
  nameZh: string
  tai: number
  count: number
}

export type BonusMode = 'reward' | 'penalty' | 'transfer'

export type LedgerEvent =
  | { type: 'setup'; players: LedgerPlayer[]; dealerId: string; settings?: Partial<LedgerSettings> }
  | { type: 'settings'; settings: Partial<LedgerSettings> }
  | { type: 'win'; winnerId: string; selfDraw: boolean; discarderId?: string; farn: number; multi?: 'none' | 'double' | 'triple'; takeJackpot?: boolean; patterns?: PatternUse[] }
  | { type: 'multi'; discarderId: string; winners: { id: string; farn: number; patterns?: PatternUse[] }[]; takeJackpot?: boolean }
  | { type: 'draw' }
  | { type: 'bonus'; label: string; amount: number; playerId?: string; fromId?: string; toId?: string; mode: BonusMode }
  | { type: 'surrender'; playerId: string }
  | { type: 'seats'; order: string[]; winds?: Record<string, 1 | 2 | 3 | 4> }
  | { type: 'swap'; a: string; b: string }
  | { type: 'substitute'; outId: string; player: LedgerPlayer }
  | { type: 'dealer'; dealerId?: string; streak?: number; roundWind?: 1 | 2 | 3 | 4; roundIndex?: number }
  | { type: 'jackpot'; toId: string; amount?: number }

export interface Claim {
  holderId: string
  targetId: string
  value: number
}

export interface PendingSnow {
  playerId: string
  fromIds: string[]
  amountEach: number
}

export interface LedgerState {
  players: LedgerPlayer[]
  seatOrder: string[]
  dealerId: string
  streak: number
  roundWind: 1 | 2 | 3 | 4
  roundIndex: number
  handNumber: number
  nets: Record<string, number>
  pot: number
  claims: Claim[]
  pendingSnow: PendingSnow | null
  settings: LedgerSettings
  lastDeltas: Record<string, number>
  seatPrompt: boolean
  surrenderCounts: Record<string, number>
  label: string
  /** Every identity that has sat, including players who left. Totals stay on the id. */
  roster: LedgerPlayer[]
  winds: Record<string, 1 | 2 | 3 | 4>
  patternCounts: Record<string, Record<string, number>>
  wins: Record<string, number>
  /** Cumulative amount `from` has paid `to` across wins, snow, and bonuses. */
  paid: Record<string, Record<string, number>>
  hands: { type: string; deltas: Record<string, number> }[]
}

export const defaultLedgerSettings = (): LedgerSettings => ({
  base: 0,
  dealerTai: 1,
  streakTai: 2,
  counterSnowDouble: 5,
  counterSnowTriple: 10,
  limitInput: 999,
  dealerStaysOnDraw: true,
  jackpotEnabled: true,
  jackpotPerDraw: 5,
  integerMode: true,
  laRoundUp: true,
  highScore: 50,
  surrenderHint: 3,
  falseWinPenalty: 40,
  dollarPerFarn: 1,
  bonuses: {
    flower: 5,
    grass: 3,
    both: 8,
    concealedKong: 5,
    chase5: 5,
    chase10: 10,
    snake: 5,
    box: 5,
    sevenRobOne: 30,
    oneRobSeven: 30,
    eightImmortals: 100,
    falseCall: 5,
  },
})

const WIND = ['東', '南', '西', '北']

export function roundLabel(wind: number, index: number): string {
  return `${WIND[(wind - 1) % 4]}風${WIND[index % 4]}局`
}

function blank(players: LedgerPlayer[], dealerId: string, settings: LedgerSettings): LedgerState {
  const nets: Record<string, number> = {}
  const surrenderCounts: Record<string, number> = {}
  for (const player of players) {
    nets[player.id] = 0
    surrenderCounts[player.id] = 0
  }
  return {
    players,
    seatOrder: players.map((p) => p.id),
    dealerId,
    streak: 0,
    roundWind: 1,
    roundIndex: 0,
    handNumber: 0,
    nets,
    pot: 0,
    claims: [],
    pendingSnow: null,
    settings,
    lastDeltas: {},
    seatPrompt: false,
    surrenderCounts,
    label: roundLabel(1, 0),
    roster: players.map((p) => ({ ...p })),
    winds: {},
    patternCounts: {},
    wins: {},
    paid: {},
    hands: [],
  }
}

function owe(state: LedgerState, from: string, to: string, amount: number): void {
  if (amount === 0 || from === to) return
  const row = state.paid[from] ?? {}
  row[to] = (row[to] ?? 0) + amount
  state.paid[from] = row
}

function notePatterns(state: LedgerState, playerId: string, patterns: PatternUse[] | undefined): void {
  if (!patterns) return
  const row = state.patternCounts[playerId] ?? {}
  for (const pattern of patterns) row[pattern.id] = (row[pattern.id] ?? 0) + pattern.count
  state.patternCounts[playerId] = row
}

function money(n: number, settings: LedgerSettings): number {
  if (!settings.integerMode) return n
  return Math.round(n)
}

function half(value: number, settings: LedgerSettings): number {
  const raw = value / 2
  if (!settings.laRoundUp && !settings.integerMode) return raw
  return Math.round(raw)
}

function touch(deltas: Record<string, number>, id: string, amount: number): void {
  deltas[id] = (deltas[id] ?? 0) + amount
}

function contributeJackpot(state: LedgerState, deltas: Record<string, number>): void {
  if (!state.settings.jackpotEnabled || state.settings.jackpotPerDraw <= 0) return
  for (const player of state.players) {
    touch(deltas, player.id, -state.settings.jackpotPerDraw)
    state.pot += state.settings.jackpotPerDraw
  }
}

function takePot(state: LedgerState, playerId: string, deltas: Record<string, number>, amount?: number): void {
  const pay = amount == null ? state.pot : Math.min(state.pot, amount)
  if (pay <= 0) return
  state.pot -= pay
  touch(deltas, playerId, pay)
}

function dealerBonus(state: LedgerState, winnerId: string, payerId: string): number {
  if (winnerId !== state.dealerId && payerId !== state.dealerId) return 0
  return state.settings.dealerTai + state.settings.streakTai * state.streak
}

function multiTai(multi: 'none' | 'double' | 'triple' | undefined): number {
  if (multi === 'double') return 5
  if (multi === 'triple') return 10
  return 0
}

function plainAmount(state: LedgerState, winnerId: string, payerId: string, farn: number, multi?: 'none' | 'double' | 'triple'): number {
  return money(state.settings.base + farn + dealerBonus(state, winnerId, payerId) + multiTai(multi), state.settings)
}

/** Repeat 拉, first claim, or 踢. Mutates claims. Returns the amount the payer owes. */
export function laPayment(claims: Claim[], winnerId: string, payerId: string, plain: number, settings: LedgerSettings): { worth: number; claims: Claim[] } {
  const next = claims.map((c) => ({ ...c }))
  const claim = next.find((c) => c.holderId === winnerId && c.targetId === payerId)
  const reverse = next.find((c) => c.holderId === payerId && c.targetId === winnerId)
  if (claim) {
    const worth = money(plain + half(claim.value, settings), settings)
    claim.value = money(claim.value + worth, settings)
    return { worth, claims: next }
  }
  if (reverse) {
    const worth = money(plain + half(reverse.value, settings), settings)
    const kept = next.filter((c) => c !== reverse)
    kept.push({ holderId: winnerId, targetId: payerId, value: plain })
    return { worth, claims: kept }
  }
  next.push({ holderId: winnerId, targetId: payerId, value: plain })
  return { worth: plain, claims: next }
}

function applyWinPair(state: LedgerState, winnerId: string, payerId: string, farn: number, multi: 'none' | 'double' | 'triple' | undefined, deltas: Record<string, number>): void {
  const plain = plainAmount(state, winnerId, payerId, farn, multi)
  const paid = laPayment(state.claims, winnerId, payerId, plain, state.settings)
  state.claims = paid.claims
  touch(deltas, payerId, -paid.worth)
  touch(deltas, winnerId, paid.worth)
  owe(state, payerId, winnerId, paid.worth)
}

function foldSnow(state: LedgerState, winnerId: string, deltas: Record<string, number>): void {
  const snow = state.pendingSnow
  if (!snow || snow.playerId !== winnerId) return
  for (const fromId of snow.fromIds) {
    const amount = snow.amountEach
    touch(deltas, fromId, -amount)
    touch(deltas, winnerId, amount)
    owe(state, fromId, winnerId, amount)
    const claim = state.claims.find((c) => c.holderId === winnerId && c.targetId === fromId)
    if (claim) claim.value = money(claim.value + amount, state.settings)
    else state.claims.push({ holderId: winnerId, targetId: fromId, value: amount })
  }
  state.pendingSnow = null
}

function endOtherClaims(state: LedgerState, winners: string[]): void {
  const won = new Set(winners)
  state.claims = state.claims.filter((c) => won.has(c.holderId))
}

function passDealer(state: LedgerState): void {
  const order = state.seatOrder
  const index = order.indexOf(state.dealerId)
  state.dealerId = order[(index + 1) % order.length]
  state.streak = 0
  const leavingNorth = state.roundWind === 4 && state.roundIndex === 3
  state.roundIndex += 1
  if (state.roundIndex >= 4) {
    state.roundIndex = 0
    state.roundWind = ((state.roundWind % 4) + 1) as 1 | 2 | 3 | 4
  }
  if (leavingNorth) state.seatPrompt = true
  state.label = roundLabel(state.roundWind, state.roundIndex)
}

function commit(state: LedgerState, deltas: Record<string, number>): void {
  for (const [id, amount] of Object.entries(deltas)) state.nets[id] = money((state.nets[id] ?? 0) + amount, state.settings)
  state.lastDeltas = deltas
  state.hands.push({ type: 'hand', deltas: { ...deltas } })
  state.handNumber += 1
  state.label = roundLabel(state.roundWind, state.roundIndex)
}

function apply(state: LedgerState, event: LedgerEvent): void {
  if (event.type === 'setup') {
    const settings = { ...defaultLedgerSettings(), ...(event.settings ?? {}) }
    const next = blank(event.players, event.dealerId, settings)
    Object.assign(state, next)
    return
  }
  if (event.type === 'settings') {
    state.settings = {
      ...state.settings,
      ...event.settings,
      bonuses: { ...state.settings.bonuses, ...(event.settings.bonuses ?? {}) },
    }
    state.lastDeltas = {}
    return
  }
  const deltas: Record<string, number> = {}
  if (event.type === 'win') {
    contributeJackpot(state, deltas)
    const payers = event.selfDraw ? state.players.map((p) => p.id).filter((id) => id !== event.winnerId) : [event.discarderId ?? event.winnerId]
    for (const payer of payers) {
      if (payer === event.winnerId) continue
      applyWinPair(state, event.winnerId, payer, event.farn, event.multi, deltas)
    }
    foldSnow(state, event.winnerId, deltas)
    endOtherClaims(state, [event.winnerId])
    if (event.multi === 'double' || event.multi === 'triple') {
      const discarder = event.discarderId
      if (discarder) {
        state.pendingSnow = {
          playerId: discarder,
          fromIds: [event.winnerId],
          amountEach: event.multi === 'triple' ? state.settings.counterSnowTriple : state.settings.counterSnowDouble,
        }
      }
    }
    if (event.takeJackpot) takePot(state, event.winnerId, deltas)
    if (event.winnerId === state.dealerId) state.streak += 1
    else passDealer(state)
    state.wins[event.winnerId] = (state.wins[event.winnerId] ?? 0) + 1
    notePatterns(state, event.winnerId, event.patterns)
    commit(state, deltas)
    return
  }
  if (event.type === 'multi') {
    contributeJackpot(state, deltas)
    const kind = event.winners.length >= 3 ? 'triple' : 'double'
    for (const winner of event.winners) {
      applyWinPair(state, winner.id, event.discarderId, winner.farn, kind, deltas)
    }
    for (const winner of event.winners) foldSnow(state, winner.id, deltas)
    endOtherClaims(state, event.winners.map((w) => w.id))
    state.pendingSnow = {
      playerId: event.discarderId,
      fromIds: event.winners.map((w) => w.id),
      amountEach: kind === 'triple' ? state.settings.counterSnowTriple : state.settings.counterSnowDouble,
    }
    if (event.takeJackpot && event.winners[0]) takePot(state, event.winners[0].id, deltas)
    if (event.winners.some((w) => w.id === state.dealerId)) state.streak += 1
    else passDealer(state)
    for (const winner of event.winners) {
      state.wins[winner.id] = (state.wins[winner.id] ?? 0) + 1
      notePatterns(state, winner.id, winner.patterns)
    }
    commit(state, deltas)
    return
  }
  if (event.type === 'draw') {
    contributeJackpot(state, deltas)
    if (!state.settings.dealerStaysOnDraw) passDealer(state)
    commit(state, deltas)
    return
  }
  if (event.type === 'bonus') {
    const others = state.players.map((p) => p.id).filter((id) => id !== event.playerId)
    if (event.mode === 'transfer' && event.fromId && event.toId) {
      touch(deltas, event.fromId, -event.amount)
      touch(deltas, event.toId, event.amount)
      owe(state, event.fromId, event.toId, event.amount)
    } else if (event.mode === 'penalty' && event.playerId) {
      for (const id of others) {
        touch(deltas, event.playerId, -event.amount)
        touch(deltas, id, event.amount)
        owe(state, event.playerId, id, event.amount)
      }
    } else if (event.playerId) {
      for (const id of others) {
        touch(deltas, id, -event.amount)
        touch(deltas, event.playerId, event.amount)
        owe(state, id, event.playerId, event.amount)
      }
    }
    commit(state, deltas)
    return
  }
  if (event.type === 'surrender') {
    state.surrenderCounts[event.playerId] = (state.surrenderCounts[event.playerId] ?? 0) + 1
    state.lastDeltas = {}
    state.handNumber += 1
    return
  }
  if (event.type === 'seats') {
    state.seatOrder = event.order.slice()
    if (event.winds) state.winds = { ...event.winds }
    state.lastDeltas = {}
    return
  }
  if (event.type === 'swap') {
    const order = state.seatOrder.slice()
    const i = order.indexOf(event.a)
    const j = order.indexOf(event.b)
    if (i >= 0 && j >= 0) {
      order[i] = event.b
      order[j] = event.a
      state.seatOrder = order
    }
    state.lastDeltas = {}
    return
  }
  if (event.type === 'substitute') {
    const seat = state.seatOrder.indexOf(event.outId)
    if (seat >= 0) state.seatOrder[seat] = event.player.id
    if (!state.roster.some((p) => p.id === event.player.id)) state.roster.push({ ...event.player })
    if (state.nets[event.player.id] == null) state.nets[event.player.id] = 0
    if (state.dealerId === event.outId) state.dealerId = event.player.id
    state.players = state.seatOrder.map((id) => state.roster.find((p) => p.id === id) ?? { id, name: id })
    state.lastDeltas = {}
    return
  }
  if (event.type === 'dealer') {
    if (event.dealerId) state.dealerId = event.dealerId
    if (event.streak != null) state.streak = event.streak
    if (event.roundWind) state.roundWind = event.roundWind
    if (event.roundIndex != null) state.roundIndex = event.roundIndex
    state.label = roundLabel(state.roundWind, state.roundIndex)
    state.lastDeltas = {}
    return
  }
  if (event.type === 'jackpot') {
    takePot(state, event.toId, deltas, event.amount)
    commit(state, deltas)
  }
}

export function replayLedger(events: LedgerEvent[]): LedgerState {
  const first = events.find((e) => e.type === 'setup')
  const state = first && first.type === 'setup'
    ? blank(first.players, first.dealerId, { ...defaultLedgerSettings(), ...(first.settings ?? {}) })
    : blank(
        [
          { id: 'a', name: 'A' },
          { id: 'b', name: 'B' },
          { id: 'c', name: 'C' },
          { id: 'd', name: 'D' },
        ],
        'a',
        defaultLedgerSettings(),
      )
  for (const event of events) apply(state, event)
  return state
}

export function fewestPayments(nets: Record<string, number>): { from: string; to: string; amount: number }[] {
  const debtors = Object.entries(nets)
    .filter(([, n]) => n < -0.001)
    .map(([id, n]) => ({ id, n: -n }))
    .sort((a, b) => b.n - a.n)
  const creditors = Object.entries(nets)
    .filter(([, n]) => n > 0.001)
    .map(([id, n]) => ({ id, n }))
    .sort((a, b) => b.n - a.n)
  const payments: { from: string; to: string; amount: number }[] = []
  let i = 0
  let j = 0
  while (i < debtors.length && j < creditors.length) {
    const amount = Math.min(debtors[i].n, creditors[j].n)
    if (amount > 0) payments.push({ from: debtors[i].id, to: creditors[j].id, amount: Math.round(amount * 100) / 100 })
    debtors[i].n -= amount
    creditors[j].n -= amount
    if (debtors[i].n <= 0.001) i += 1
    if (creditors[j].n <= 0.001) j += 1
  }
  return payments
}

export function ledgerZeroSum(state: LedgerState): number {
  return Object.values(state.nets).reduce((s, n) => s + n, 0) + state.pot
}
