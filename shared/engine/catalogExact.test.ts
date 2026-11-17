import { describe, expect, it } from 'vitest'
import { parseHand } from './notation.ts'
import { scoreHand } from './scoring.ts'
import { CATALOG } from './taiCatalog.ts'
import { defaultSituation, type Situation } from './tiles.ts'

interface Case {
  id: string
  hand: string
  sit?: Partial<Situation>
  tai: number
  count: number
  lacks?: string[]
  /** A complete hand on which this id must not pay. */
  negative: string
  negativeSit?: Partial<Situation>
}

function scored(hand: string, sit: Partial<Situation> = {}) {
  const result = scoreHand(parseHand(hand), { ...defaultSituation(), ...sit })[0]
  const all = [...(result?.matches ?? []), ...(result?.second?.matches ?? [])]
  return new Map(all.map((m) => [m.id, m]))
}

const RUN = '123m456m789m123t456t99t'
const HONOR = '(111z)(222z)(333z)(444z)555z66z'

const cases: Case[] = [
  { id: 'base', hand: RUN, tai: 5, count: 1, negative: '123m' },
  { id: 'concealed-hand', hand: RUN, tai: 5, count: 1, negative: '(123m)456m789m123t456t99t' },
  { id: 'kong', hand: '(1111b)123m456m789m123t99t', tai: 2, count: 1, negative: RUN },
  { id: 'orphans', hand: '19m19t19b1234567z777z1m', tai: 160, count: 1, lacks: ['concealed-hand'], negative: RUN },
  { id: 'four-return-hidden', hand: '19m19t19b1234567z777z1m', tai: 15, count: 1, lacks: ['four-return-open'], negative: RUN },
  { id: 'four-return-open', hand: '19m19t19b1234567z777*z1m', tai: 5, count: 1, lacks: ['four-return-hidden'], negative: '19m19t19b1234567z777z1m' },
  { id: 'sixteen', hand: '147m147t147b11234567z', tai: 50, count: 1, negative: RUN },
  { id: 'sixteen-fly', hand: '147m147t147b11*234567z', tai: 60, count: 1, lacks: ['sixteen'], negative: '147m147t147b11234567z' },
  { id: 'sixteen-same', hand: '147m147t147b11234567z', tai: 20, count: 1, negative: '147m258t369b11234567z' },
  { id: 'sixteen-dragon', hand: '147m258t369b11234567z', tai: 20, count: 1, negative: '147m147t147b11234567z' },
  { id: 'eight', hand: '1122m3344t5566b77711z', tai: 50, count: 1, negative: RUN },
  { id: 'eight-fly', hand: '1*1122334455667788m', tai: 60, count: 1, lacks: ['eight'], negative: '1122m3344t5566b77711z' },
  { id: 'three-dragon-pairs', hand: '11223344555m556677z', tai: 20, count: 1, negative: '1122m3344t5566b77711z' },
  { id: 'three-wind-pairs', hand: '112233z4455666m7788t', tai: 15, count: 1, negative: '11223344z5556677m88t' },
  { id: 'four-wind-pairs', hand: '11223344z5556677m88t', tai: 60, count: 1, lacks: ['three-wind-pairs'], negative: '112233z4455666m7788t' },
  { id: 'no-flowers', hand: '19m19t19b1234567z777z1m', tai: 2, count: 1, negative: RUN + '1f' },
  { id: 'right-flower', hand: RUN + '1f', sit: { seatWind: 1 }, tai: 2, count: 1, negative: RUN },
  { id: 'wrong-flower', hand: RUN + '12f3s', sit: { seatWind: 1 }, tai: 4, count: 2, negative: RUN },
  { id: 'no-honor-flower', hand: '(1111b)123m456m789m123t99t', tai: 10, count: 1, lacks: ['no-honor', 'no-flowers'], negative: HONOR },
  { id: 'no-honor', hand: RUN + '1f', tai: 2, count: 1, negative: HONOR },
  { id: 'all-honors', hand: HONOR, tai: 160, count: 1, negative: RUN },
  { id: 'wrong-seat', hand: '(222z)123m456m789m123t99t', sit: { seatWind: 1 }, tai: 2, count: 1, negative: RUN },
  { id: 'right-seat', hand: '(222z)123m456m789m123t99t', sit: { seatWind: 2 }, tai: 2, count: 1, negative: RUN },
  { id: 'right-round', hand: '(111z)123m456m789m123t99m', sit: { roundWind: 1 }, tai: 0, count: 0, negative: RUN },
  { id: 'small-three-winds', hand: '(111z)(222z)123m456m789m33z', tai: 30, count: 1, lacks: ['wrong-seat', 'right-seat'], negative: '(111z)(222z)(333z)456m789m99t' },
  { id: 'big-three-winds', hand: '(111z)(222z)(333z)456m789m99t', tai: 60, count: 1, lacks: ['small-three-winds'], negative: RUN },
  { id: 'small-four-winds', hand: '(111z)(222z)(333z)456m789m44z', tai: 120, count: 1, lacks: ['big-three-winds', 'small-three-winds'], negative: RUN },
  { id: 'big-four-winds', hand: '(111z)(222z)(333z)(444z)555t99m', tai: 160, count: 1, lacks: ['small-four-winds'], negative: RUN },
  { id: 'dragon', hand: '(555z)123m456m789m123t99t', tai: 2, count: 1, negative: RUN },
  { id: 'small-dragons', hand: '(555z)(666z)123m456m789m77z', tai: 40, count: 1, lacks: ['dragon'], negative: '(555z)123m456m789m123t99t' },
  { id: 'big-dragons', hand: '(555z)(666z)(777z)123m456m99t', tai: 80, count: 1, lacks: ['dragon', 'small-dragons'], negative: '(555z)123m456m789m123t99t' },
  { id: 'all-runs', hand: RUN + '1f', tai: 5, count: 1, negative: '111222333444555m99t' },
  { id: 'pure-all-runs', hand: RUN, tai: 20, count: 1, lacks: ['all-runs', 'no-honor', 'no-flowers'], negative: '111222333444555m99t' },
  { id: 'all-pungs', hand: '111222333444555m99t', tai: 40, count: 1, lacks: ['all-runs'], negative: RUN },
  { id: 'five-concealed-draw', hand: '111222333m444t555b11z', sit: { selfDraw: true }, tai: 160, count: 1, lacks: ['all-pungs', 'five-concealed'], negative: '111222333m444t555b11z' },
  { id: 'two-concealed', hand: '(111m)222333t456t789b11z', tai: 5, count: 1, negative: RUN },
  { id: 'three-concealed', hand: '(111z)(222z)333444z555m99t', tai: 15, count: 1, lacks: ['two-concealed'], negative: RUN },
  { id: 'four-concealed', hand: '(123t)111222333444m55t', tai: 30, count: 1, lacks: ['three-concealed', 'two-concealed'], negative: RUN },
  { id: 'five-concealed', hand: '111222333444555m99t', tai: 80, count: 1, lacks: ['four-concealed'], negative: '(123t)111222333444m55t' },
  { id: 'five-kongs', hand: '(1111m)(2222t)(3333b)(4444z)[5555z]99m', tai: 240, count: 1, lacks: ['kong', 'five-concealed'], negative: RUN },
  { id: 'dual-pung', hand: '112233m44*4t456t789b11z', tai: 2, count: 1, negative: RUN },
  { id: 'single-wait', hand: '123m456m789m123t456t99t*', tai: 2, count: 1, lacks: ['fake-single'], negative: '23*3445m678m234t567t99b' },
  { id: 'fake-single', hand: '23*3445m678m234t567t99b', tai: 2, count: 1, negative: '123m456m789m123t456t99t*' },
  { id: 'visible-triple', hand: '(333m)3*45m456m789t123b11z', tai: 5, count: 1, negative: RUN },
  { id: 'visible-exhausted', hand: '(333m)(6666m)3*45m789t123b99t', tai: 10, count: 1, lacks: ['visible-triple'], negative: '(333m)3*45m456m789t123b11z' },
  { id: 'self-draw', hand: '(123m)(456m)(789m)(123t)(456t)99t', sit: { selfDraw: true }, tai: 1, count: 1, negative: RUN },
  { id: 'concealed-self', hand: RUN, sit: { selfDraw: true }, tai: 3, count: 1, lacks: ['self-draw'], negative: '(123m)(456m)(789m)(123t)(456t)99t' },
  { id: 'riichi', hand: '(123m)456m789m123t456t99t', sit: { riichi: 'riichi' }, tai: 5, count: 1, negative: RUN },
  { id: 'concealed-riichi', hand: RUN, sit: { riichi: 'riichi' }, tai: 10, count: 1, lacks: ['riichi'], negative: '(123m)456m789m123t456t99t' },
  { id: 'heavenly-riichi', hand: RUN, sit: { riichi: 'heavenly-riichi' }, tai: 60, count: 1, lacks: ['riichi', 'concealed-riichi'], negative: RUN },
  { id: 'earthly-riichi', hand: RUN, sit: { riichi: 'earthly-riichi' }, tai: 50, count: 1, lacks: ['riichi', 'concealed-riichi'], negative: RUN },
  { id: 'ippatsu', hand: RUN, sit: { riichi: 'riichi', instantWin: true }, tai: 5, count: 1, negative: RUN },
  { id: 'eat-riichi', hand: RUN, sit: { eatRiichi: true }, tai: 5, count: 1, negative: RUN },
  { id: 'early-four', hand: RUN, sit: { earlyWin: 'four' }, tai: 60, count: 1, negative: RUN },
  { id: 'early-seven', hand: RUN, sit: { earlyWin: 'seven' }, tai: 30, count: 1, negative: RUN },
  { id: 'early-ten', hand: RUN, sit: { earlyWin: 'ten' }, tai: 15, count: 1, negative: RUN },
  { id: 'double-win', hand: RUN, sit: { multiWin: 'double' }, tai: 5, count: 1, negative: RUN },
  { id: 'triple-win', hand: RUN, sit: { multiWin: 'triple' }, tai: 10, count: 1, negative: RUN },
  { id: 'heaven', hand: RUN, sit: { heavenlyWin: 'heaven', selfDraw: true }, tai: 160, count: 1, lacks: ['early-four'], negative: RUN },
  { id: 'earth', hand: RUN, sit: { heavenlyWin: 'earth' }, tai: 120, count: 1, lacks: ['early-four'], negative: RUN },
  { id: 'man', hand: RUN, sit: { heavenlyWin: 'man' }, tai: 80, count: 1, lacks: ['early-four'], negative: RUN },
  { id: 'river', hand: RUN, sit: { lastTileWin: 'river-bottom', selfDraw: true }, tai: 5, count: 1, negative: RUN },
  { id: 'sea', hand: RUN, sit: { lastTileWin: 'sea-bottom', selfDraw: true }, tai: 10, count: 1, negative: '123m456m789m123t456t11*t' },
  { id: 'sea-one', hand: '123m456m789m123t456t11*t', sit: { lastTileWin: 'sea-bottom', selfDraw: true }, tai: 20, count: 1, lacks: ['sea'], negative: RUN },
  { id: 'flower-draw', hand: RUN, sit: { flowerDraw: 2 }, tai: 4, count: 2, negative: RUN },
  { id: 'kong-draw', hand: RUN, sit: { kongDraw: 2 }, tai: 25, count: 2, negative: RUN },
  { id: 'rob-kong', hand: RUN, sit: { robKong: 3 }, tai: 125, count: 3, negative: RUN },
  { id: 'dealer', hand: RUN, sit: { dealerStreak: 2 }, tai: 3, count: 2, negative: RUN },
  { id: 'all-claimed', hand: '(123m)(456m)(789m)(123t)(456t)99t', tai: 30, count: 1, negative: RUN },
  { id: 'all-self', hand: '(123m)(456m)(789m)(123t)(456t)99t', sit: { selfDraw: true }, tai: 15, count: 1, negative: '(123m)(456m)(789m)(123t)(456t)99t' },
  { id: 'chicken', hand: '(222m)4*56t789b345m678t11z', tai: 30, count: 1, negative: RUN },
  { id: 'duck', hand: '(222m)4*56t789b345m678t11z', sit: { selfDraw: true }, tai: 15, count: 1, lacks: ['chicken'], negative: '(222m)4*56t789b345m678t11z' },
  { id: 'return1-open', hand: '(222m)234m456m789m123t99b', tai: 5, count: 1, lacks: ['return1-hidden'], negative: RUN },
  { id: 'return1-hidden', hand: '222234m456m789m123t99b', tai: 15, count: 1, lacks: ['return1-open'], negative: '(222m)234m456m789m123t99b' },
  { id: 'return2-open', hand: '(234m)234m456m789m123t22m', tai: 15, count: 1, lacks: ['return2-hidden'], negative: RUN },
  { id: 'return2-hidden', hand: '234678m234678m234m88m', tai: 30, count: 1, negative: RUN },
  { id: 'return4-open', hand: '(123m)123123123m456t99t', tai: 90, count: 3, negative: RUN },
  { id: 'return4-hidden', hand: '123123123123m456t99t', tai: 180, count: 3, negative: RUN },
  { id: 'identical-open', hand: '(123m)123m456m789m123t99t', tai: 5, count: 1, lacks: ['identical-hidden'], negative: '123123m456m789m123t99t' },
  { id: 'identical-hidden', hand: '123123m456m789m123t99t', tai: 8, count: 1, lacks: ['identical-open'], negative: '(123m)123m456m789m123t99t' },
  { id: 'small-twin-open', hand: '(345m)345m456t789t123b22m', tai: 10, count: 1, lacks: ['identical-open'], negative: RUN },
  { id: 'small-twin-hidden', hand: '22334455m456t789t123b', tai: 15, count: 1, lacks: ['identical-hidden'], negative: RUN },
  { id: 'true-twin-open', hand: '(123m)123m456456t789m99b', tai: 20, count: 1, lacks: ['identical-open'], negative: RUN },
  { id: 'true-twin-hidden', hand: '123123m456456t789m99b', tai: 40, count: 1, lacks: ['identical-hidden'], negative: RUN },
  { id: 'three-same-open', hand: '(123m)123123m456m789t99b', tai: 30, count: 1, lacks: ['identical-open'], negative: RUN },
  { id: 'three-same-hidden', hand: '234678m234678m234m88m', tai: 60, count: 1, lacks: ['identical-hidden'], negative: '123123m456m789m123t99t' },
  { id: 'four-same-open', hand: '(123m)123123123m456t99t', tai: 80, count: 1, lacks: ['three-same-open', 'identical-open'], negative: RUN },
  { id: 'four-same-hidden', hand: '123123123123m456t99t', tai: 160, count: 1, lacks: ['three-same-hidden', 'identical-hidden'], negative: '(123m)123123123m456t99t' },
  { id: 'step-open', hand: '(123m)234m345m456t789t99b', tai: 15, count: 1, lacks: ['step-hidden'], negative: RUN },
  { id: 'step-hidden', hand: '123234345m456m789t99b', tai: 60, count: 2, negative: '(123m)234m345m456t789t99b' },
  { id: 'step2-open', hand: '(123m)345m567m456t789t99b', tai: 8, count: 1, negative: RUN },
  { id: 'step2-hidden', hand: '234m456m678m234t456t88t', tai: 15, count: 1, negative: RUN },
  { id: 'chain2', hand: '(111m)(222m)456t789t123b11z', tai: 5, count: 1, negative: RUN },
  { id: 'chain3s', hand: '(333m)(444m)22m567t789b123t', tai: 15, count: 1, negative: RUN },
  { id: 'chain3', hand: '(111m)(222m)(333m)456t789b99t', tai: 30, count: 1, lacks: ['chain2'], negative: '(111m)(222m)456t789t123b11z' },
  { id: 'chain4s', hand: '(111m)(222m)(333m)(444m)555t99t', tai: 0, count: 0, negative: RUN },
  { id: 'chain4', hand: '(111m)(222m)(333m)(444m)555t99t', tai: 0, count: 0, negative: RUN },
  { id: 'chain5s', hand: '111222333444555m99t', tai: 0, count: 0, negative: RUN },
  { id: 'chain5', hand: '111222333444555m99t', tai: 0, count: 0, negative: RUN },
  { id: 'chain6s', hand: '111222333444555m99t', tai: 0, count: 0, negative: RUN },
  { id: 'chain-double', hand: '(111m)(222m)(444t)(555t)33z99b', tai: 0, count: 0, negative: RUN },
  { id: 'meet', hand: RUN, tai: 6, count: 2, negative: '123456789m123456m99m' },
  { id: 'two-sisters', hand: RUN, tai: 5, count: 1, negative: '123123m123t456t456b99m' },
  { id: 'all-sisters', hand: '123123m123t456t456b99m', tai: 20, count: 1, lacks: ['two-sisters'], negative: RUN },
  { id: 'stairs', hand: '123m234m345m456m567t99b', tai: 20, count: 1, negative: '123234345456567m99m' },
  { id: 'five-step', hand: '123234345456567m99m', tai: 40, count: 1, lacks: ['stairs'], negative: '123m234m345m456m567t99b' },
  { id: 'meet3-open', hand: '(123m)123t123b456m789m99t', tai: 10, count: 1, lacks: ['meet3-hidden'], negative: RUN },
  { id: 'meet3-hidden', hand: '123m123t123b456m789m99t', tai: 20, count: 1, lacks: ['meet3-open'], negative: '(123m)123t123b456m789m99t' },
  { id: 'meet4-open', hand: '(123m)123m123t123b456m99t', tai: 40, count: 1, lacks: ['meet3-open', 'meet3-hidden'], negative: '123m123t123b456m789m99t' },
  { id: 'meet4-hidden', hand: '123123m123t123b456m99t', tai: 80, count: 1, lacks: ['meet3-hidden'], negative: '123m123t123b456m789m99t' },
  { id: 'meet5-open', hand: '(123m)123m123123t123b99m', tai: 80, count: 1, lacks: ['meet4-open'], negative: RUN },
  { id: 'meet5-hidden', hand: '123123m123123t123b99m', tai: 160, count: 1, lacks: ['meet4-hidden'], negative: '(123m)123m123123t123b99m' },
  { id: 'bros2', hand: '(555m)(555t)123b456b789m11z', tai: 5, count: 1, negative: RUN },
  { id: 'bros3s', hand: '(555m)(555t)123b456b789m55b', tai: 20, count: 1, negative: '(555m)(555t)(555b)123m456m11z' },
  { id: 'bros3', hand: '(555m)(555t)(555b)123m456m11z', tai: 40, count: 1, negative: '(555m)(555t)123b456b789m11z' },
  { id: 'color-chain-s', hand: '(333t)(444b)22m567m789t123b', tai: 10, count: 1, negative: RUN },
  { id: 'color-chain', hand: '(333t)(444m)(555b)123m456t11z', tai: 20, count: 1, negative: RUN },
  { id: 'color-step-open', hand: '(123m)234t345b456m789t99b', tai: 5, count: 1, negative: '123m234t345b456m789t99b' },
  { id: 'color-step-hidden', hand: '123m234t345b456m789t99b', tai: 20, count: 2, negative: RUN },
  { id: 'mixed-flush', hand: '123456789m456m111z99m', tai: 40, count: 1, lacks: ['pure-flush'], negative: '123456789m123456m99m' },
  { id: 'pure-flush', hand: '123456789m123456m99m', tai: 120, count: 1, lacks: ['mixed-flush'], negative: '123456789m456m111z99m' },
  { id: 'straight-open', hand: '(123m)456m789m123t456t99t', tai: 10, count: 1, lacks: ['straight-hidden'], negative: '111222333444555m99t' },
  { id: 'straight-hidden', hand: '123456789789m123t11t', tai: 40, count: 2, lacks: ['straight-open'], negative: '(123m)456m789m123t456t99t' },
  { id: 'mixed-straight-open', hand: '(123m)456t789b456m123t99t', tai: 8, count: 1, negative: RUN },
  { id: 'mixed-straight-hidden', hand: '123m456t789b123456m99t', tai: 30, count: 2, lacks: ['mixed-straight-open'], negative: RUN },
  { id: 'old-young-run', hand: '123m789m123t789t111b99b', tai: 6, count: 2, negative: RUN },
  { id: 'old-young-pung', hand: '(111m)(999m)123t456t789b99b', tai: 5, count: 1, negative: RUN },
  { id: 'common-x', hand: '123234345m333b123t11z', tai: 30, count: 1, negative: RUN },
  { id: 'common-xy', hand: '123234m123t123b11122z', tai: 50, count: 1, lacks: ['common-x'], negative: '123234345m333b123t11z' },
  { id: 'common-xyz', hand: '123m123t123b123m123t33z', tai: 60, count: 1, lacks: ['common-xy'], negative: RUN },
  { id: 'all-common-x', hand: '123234m222234t123b22b', tai: 120, count: 1, lacks: ['common-x'], negative: '123234345m333b123t11z' },
  { id: 'mixed-terminal', hand: '111z123m789m123t789t99t', tai: 40, count: 1, negative: RUN },
  { id: 'all-terminal', hand: '123m789m123t789t111b99b', tai: 80, count: 1, lacks: ['no-five'], negative: RUN },
  { id: 'mixed-old', hand: '111999m111222z555z99b', tai: 100, count: 1, lacks: ['mixed-terminal'], negative: '111999m111999t111b99b' },
  { id: 'pure-old', hand: '111999m111999t111b99b', tai: 200, count: 1, lacks: ['mixed-old', 'all-terminal'], negative: '111999m111222z555z99b' },
  { id: 'two-suits', hand: RUN, tai: 10, count: 1, negative: '123m456m789m123t456t789b99t' },
  { id: 'five-small', hand: '(555z)123m456t789b678m22z', tai: 10, count: 1, lacks: ['five-big'], negative: '(111z)(555z)123m456t789b99t' },
  { id: 'five-big', hand: '(111z)(555z)123m456t789b99t', tai: 15, count: 1, negative: '(555z)123m456t789b678m22z' },
  { id: 'seven-small', hand: '(555z)123m456t789b678m22z1f1s', tai: 15, count: 1, lacks: ['five-small'], negative: RUN },
  { id: 'seven-big', hand: '(111z)(555z)123m456t789b99t1f1s', tai: 20, count: 1, lacks: ['five-big'], negative: RUN },
  { id: 'simples', hand: '234m456m678m234t456t88t', tai: 10, count: 1, negative: RUN },
  { id: 'no-five', hand: '234678m234678m234m88m', tai: 10, count: 1, negative: '666m777m888m666t777t99t' },
  { id: 'above-five', hand: '666m777m888m666t777t99t', tai: 40, count: 1, lacks: ['no-five'], negative: '111222333m111222t44t' },
  { id: 'below-five', hand: '111222333m111222t44t', tai: 40, count: 1, lacks: ['no-five'], negative: '666m777m888m666t777t99t' },
  { id: 'eye', hand: '1122m3344t5566b77711z', tai: 4, count: 2, negative: RUN },
  { id: 'three-treasures', hand: '234678m234678m234m88m', tai: 40, count: 1, negative: RUN },
]

describe('exact catalog tai', () => {
  it('drops every listed exclusion target on the hand that pays the source', () => {
    for (const pattern of CATALOG) {
      const item = cases.find((c) => c.id === pattern.id)
      if (!item || item.tai === 0) continue
      const rows = scored(item.hand, item.sit)
      if (!rows.has(pattern.id)) continue
      for (const target of pattern.excludes) {
        expect(rows.has(target), `${pattern.id} still paid ${target}`).toBe(false)
      }
    }
  })

  it('names every catalog id once', () => {
    const ids = cases.map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids.slice().sort()).toEqual(CATALOG.map((p) => p.id).slice().sort())
  })

  for (const item of cases) {
    it(`${item.id} pays ${item.tai} on ${item.hand}`, () => {
      const rows = scored(item.hand, item.sit)
      const row = rows.get(item.id)
      if (item.tai === 0) expect(row).toBeUndefined()
      else {
        expect(row?.tai, `${item.id} tai`).toBe(item.tai)
        expect(row?.count, `${item.id} count`).toBe(item.count)
      }
      for (const missing of item.lacks ?? []) expect(rows.has(missing), `${item.id} should drop ${missing}`).toBe(false)
    })

    it(`${item.id} is absent on ${item.negative}`, () => {
      if (item.tai === 0) return
      expect(scored(item.negative, item.negativeSit).has(item.id)).toBe(false)
    })
  }
})
