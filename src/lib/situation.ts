import { defaultSituation, type Situation } from '@mjwaits/shared'

export type SitKey =
  | 'selfDraw'
  | 'riichi'
  | 'instant'
  | 'eat'
  | 'early'
  | 'multi'
  | 'heaven'
  | 'last'
  | 'flower'
  | 'kongDraw'
  | 'rob'
  | 'dealer'
  | 'visible'

const RIICHI = ['none', 'riichi', 'heavenly-riichi', 'earthly-riichi'] as const
const EARLY = ['none', 'four', 'seven', 'ten'] as const
const MULTI = ['none', 'double', 'triple'] as const
const HEAVEN = ['none', 'heaven', 'earth', 'man'] as const
const LAST = ['none', 'river-bottom', 'sea-bottom'] as const

function clearSelfDrawSources(sit: Situation): Situation {
  return { ...sit, selfDraw: false, flowerDraw: 0, kongDraw: 0, lastTileWin: 'none', heavenlyWin: sit.heavenlyWin === 'heaven' ? 'none' : sit.heavenlyWin }
}

export function cycleSituation(sit: Situation, key: SitKey, caps: { flowers: number; kongs: number }): Situation {
  const next = { ...sit }
  if (key === 'selfDraw') {
    if (next.selfDraw) return { ...clearSelfDrawSources(next), eatRiichi: next.eatRiichi, robKong: 0, multiWin: 'none', heavenlyWin: next.heavenlyWin === 'earth' ? 'none' : next.heavenlyWin }
    return { ...next, selfDraw: true, robKong: 0, multiWin: 'none', eatRiichi: false, heavenlyWin: next.heavenlyWin === 'earth' ? 'none' : next.heavenlyWin }
  }
  if (key === 'riichi') {
    const i = RIICHI.indexOf(next.riichi)
    next.riichi = RIICHI[(i + 1) % RIICHI.length]
    if (next.riichi === 'none') next.instantWin = false
    if (next.riichi === 'heavenly-riichi' || next.riichi === 'earthly-riichi') {
      next.earlyWin = 'none'
      next.lastTileWin = 'none'
    }
    return next
  }
  if (key === 'instant') return next.riichi === 'none' ? next : { ...next, instantWin: !next.instantWin }
  if (key === 'eat') {
    next.eatRiichi = !next.eatRiichi
    if (next.eatRiichi) return { ...clearSelfDrawSources(next), eatRiichi: true, robKong: 0, multiWin: 'none' }
    return next
  }
  if (key === 'early') {
    const i = EARLY.indexOf(next.earlyWin)
    next.earlyWin = EARLY[(i + 1) % EARLY.length]
    if (next.earlyWin !== 'none') next.lastTileWin = 'none'
    return next
  }
  if (key === 'multi') {
    const i = MULTI.indexOf(next.multiWin)
    next.multiWin = MULTI[(i + 1) % MULTI.length]
    if (next.multiWin !== 'none') return { ...clearSelfDrawSources(next), multiWin: next.multiWin, eatRiichi: false, robKong: 0 }
    return next
  }
  if (key === 'heaven') {
    const i = HEAVEN.indexOf(next.heavenlyWin)
    next.heavenlyWin = HEAVEN[(i + 1) % HEAVEN.length]
    if (next.heavenlyWin !== 'none') {
      next.earlyWin = 'none'
      next.lastTileWin = 'none'
      next.riichi = 'none'
      next.instantWin = false
    }
    if (next.heavenlyWin === 'heaven') return { ...next, selfDraw: true, robKong: 0, multiWin: 'none', eatRiichi: false }
    if (next.heavenlyWin === 'earth') return { ...clearSelfDrawSources(next), heavenlyWin: 'earth', eatRiichi: false, robKong: 0, multiWin: 'none' }
    return next
  }
  if (key === 'last') {
    const i = LAST.indexOf(next.lastTileWin)
    next.lastTileWin = LAST[(i + 1) % LAST.length]
    if (next.lastTileWin !== 'none') {
      next.earlyWin = 'none'
      next.heavenlyWin = 'none'
      next.selfDraw = true
      next.robKong = 0
      next.multiWin = 'none'
      next.eatRiichi = false
    }
    return next
  }
  if (key === 'flower') {
    if (caps.flowers <= 0) return { ...next, flowerDraw: 0 }
    next.flowerDraw = (next.flowerDraw + 1) % (caps.flowers + 1)
    if (next.flowerDraw > 0) return { ...next, selfDraw: true, robKong: 0, multiWin: 'none', eatRiichi: false, heavenlyWin: next.heavenlyWin === 'earth' ? 'none' : next.heavenlyWin }
    return next
  }
  if (key === 'kongDraw') {
    if (caps.kongs <= 0) return { ...next, kongDraw: 0 }
    next.kongDraw = (next.kongDraw + 1) % (caps.kongs + 1)
    if (next.kongDraw > 0) return { ...next, selfDraw: true, robKong: 0, multiWin: 'none', eatRiichi: false, heavenlyWin: next.heavenlyWin === 'earth' ? 'none' : next.heavenlyWin }
    return next
  }
  if (key === 'rob') {
    next.robKong = next.robKong > 0 ? 0 : 1
    if (next.robKong > 0) return { ...clearSelfDrawSources(next), robKong: 1, multiWin: 'none', eatRiichi: false }
    return next
  }
  if (key === 'dealer') {
    if (next.dealerStreak <= 0) return { ...next, dealerStreak: 1 }
    return { ...next, dealerStreak: 0 }
  }
  if (key === 'visible') {
    if (!next.manualVisibleTriple && !next.manualVisibleExhausted) return { ...next, manualVisibleTriple: true }
    if (next.manualVisibleTriple && !next.manualVisibleExhausted) return { ...next, manualVisibleTriple: false, manualVisibleExhausted: true }
    return { ...next, manualVisibleTriple: false, manualVisibleExhausted: false }
  }
  return next
}

export function bumpDealer(sit: Situation, delta: number): Situation {
  if (sit.dealerStreak <= 0) return sit
  return { ...sit, dealerStreak: Math.max(1, sit.dealerStreak + delta) }
}

export function clampSituation(sit: Situation, caps: { flowers: number; kongs: number }): Situation {
  return {
    ...sit,
    flowerDraw: Math.min(sit.flowerDraw, caps.flowers),
    kongDraw: Math.min(sit.kongDraw, caps.kongs),
  }
}

export function situationQuery(sit: Situation): string {
  const base = defaultSituation()
  const parts: string[] = []
  if (sit.roundWind !== base.roundWind) parts.push(`rw${sit.roundWind}`)
  if (sit.seatWind !== base.seatWind) parts.push(`sw${sit.seatWind}`)
  if (sit.dealerStreak) parts.push(`d${sit.dealerStreak}`)
  if (sit.selfDraw) parts.push('z')
  if (sit.riichi !== 'none') parts.push(`r${RIICHI.indexOf(sit.riichi)}`)
  if (sit.instantWin) parts.push('i')
  if (sit.eatRiichi) parts.push('e')
  if (sit.earlyWin !== 'none') parts.push(`y${EARLY.indexOf(sit.earlyWin)}`)
  if (sit.multiWin !== 'none') parts.push(`m${MULTI.indexOf(sit.multiWin)}`)
  if (sit.heavenlyWin !== 'none') parts.push(`h${HEAVEN.indexOf(sit.heavenlyWin)}`)
  if (sit.lastTileWin !== 'none') parts.push(`l${LAST.indexOf(sit.lastTileWin)}`)
  if (sit.flowerDraw) parts.push(`f${sit.flowerDraw}`)
  if (sit.kongDraw) parts.push(`k${sit.kongDraw}`)
  if (sit.robKong) parts.push(`q${sit.robKong}`)
  if (sit.manualVisibleTriple) parts.push('vt')
  if (sit.manualVisibleExhausted) parts.push('ve')
  return parts.join('.')
}

export function parseSituationQuery(text: string): Partial<Situation> {
  const sit: Partial<Situation> = {}
  if (!text) return sit
  for (const part of text.split('.')) {
    if (part.startsWith('rw')) sit.roundWind = Number(part.slice(2)) as Situation['roundWind']
    else if (part.startsWith('sw')) sit.seatWind = Number(part.slice(2)) as Situation['seatWind']
    else if (part.startsWith('d')) sit.dealerStreak = Number(part.slice(1))
    else if (part === 'z') sit.selfDraw = true
    else if (part.startsWith('r')) sit.riichi = RIICHI[Number(part.slice(1))] ?? 'none'
    else if (part === 'i') sit.instantWin = true
    else if (part === 'e') sit.eatRiichi = true
    else if (part.startsWith('y')) sit.earlyWin = EARLY[Number(part.slice(1))] ?? 'none'
    else if (part.startsWith('m')) sit.multiWin = MULTI[Number(part.slice(1))] ?? 'none'
    else if (part.startsWith('h')) sit.heavenlyWin = HEAVEN[Number(part.slice(1))] ?? 'none'
    else if (part.startsWith('l')) sit.lastTileWin = LAST[Number(part.slice(1))] ?? 'none'
    else if (part.startsWith('f')) sit.flowerDraw = Number(part.slice(1))
    else if (part.startsWith('k')) sit.kongDraw = Number(part.slice(1))
    else if (part.startsWith('q')) sit.robKong = Number(part.slice(1))
    else if (part === 'vt') sit.manualVisibleTriple = true
    else if (part === 've') sit.manualVisibleExhausted = true
  }
  return sit
}
