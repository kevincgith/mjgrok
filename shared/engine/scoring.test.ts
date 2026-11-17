import { describe, expect, it } from 'vitest'
import { parseHand } from './notation.ts'
import { CATALOG } from './taiCatalog.ts'
import { scoreHand } from './scoring.ts'
import { defaultSituation, type Situation } from './tiles.ts'

function matches(notation: string, sit: Partial<Situation> = {}) {
  const result = scoreHand(parseHand(notation), { ...defaultSituation(), ...sit })
  const all = [...(result[0]?.matches ?? []), ...(result[0]?.second?.matches ?? [])]
  return { result: result[0], ids: new Set(all.map((m) => m.id)), all, total: result[0]?.total ?? 0 }
}

function expectHas(notation: string, id: string, sit: Partial<Situation> = {}) {
  const found = matches(notation, sit)
  expect(found.ids.has(id), `${id} missing on ${notation}; got ${[...found.ids].join(',')}`).toBe(true)
  const row = found.all.find((m) => m.id === id)
  expect(row && row.tai).toBeGreaterThan(0)
}

function expectLacks(notation: string, id: string, sit: Partial<Situation> = {}) {
  const found = matches(notation, sit)
  expect(found.ids.has(id), `${id} should be excluded on ${notation}`).toBe(false)
}

describe('scoring patterns', () => {
  it('scores the base, concealed hand, and pure all-runs exclusion chain', () => {
    const found = matches('123m456m789m123t456t99t')
    expectHas('123m456m789m123t456t99t', 'base')
    expectHas('123m456m789m123t456t99t', 'concealed-hand')
    expectHas('123m456m789m123t456t99t', 'pure-all-runs')
    expectHas('123m456m789m123t456t99t', 'two-suits')
    expectLacks('123m456m789m123t456t99t', 'all-runs')
    expectLacks('123m456m789m123t456t99t', 'no-honor')
    expectLacks('123m456m789m123t456t99t', 'no-flowers')
    expect(found.total).toBeGreaterThan(20)
  })

  it('lets an exposed kong keep 門前清 and scores 槓', () => {
    const n = '(1111b)123m456m789m123t99t'
    expectHas(n, 'kong')
    expectHas(n, 'concealed-hand')
    expectHas(n, 'no-honor-flower')
  })

  it('scores thirteen orphans, both quad sides, and mixed terminals', () => {
    expectHas('19m19t19b1234567z777z1m', 'orphans')
    expectHas('19m19t19b1234567z777z1m', 'four-return-hidden')
    expectHas('19m19t19b1234567z777z1m', 'mixed-old')
    expectLacks('19m19t19b1234567z777z1m', 'concealed-hand')
    expectLacks('19m19t19b1234567z777z1m', 'mixed-terminal')
    expectHas('19m19t19b1234567z777*z1m', 'four-return-open')
    expectLacks('19m19t19b1234567z777*z1m', 'four-return-hidden')
  })

  it('scores sixteen unrelated, the flying upgrade, and both bonuses', () => {
    expectHas('147m147t147b11234567z', 'sixteen')
    expectHas('147m147t147b11234567z', 'sixteen-same')
    expectLacks('147m147t147b11234567z', 'sixteen-fly')
    expectHas('147m147t147b11*234567z', 'sixteen-fly')
    expectLacks('147m147t147b11*234567z', 'sixteen')
    expectHas('147m258t369b11234567z', 'sixteen-dragon')
    expectLacks('147m258t369b11234567z', 'sixteen-same')
  })

  it('scores eight pairs, the multi-wait upgrade, dragons and winds', () => {
    expectHas('1122m3344t5566b77711z', 'eight')
    expectHas('1122m3344t5566b77711z', 'eye')
    expectHas('1*1122334455667788m', 'eight-fly')
    expectHas('11223344555m556677z', 'three-dragon-pairs')
    expectHas('11223344z5556677m88t', 'four-wind-pairs')
    expectLacks('11223344z5556677m88t', 'three-wind-pairs')
  })

  it('scores winds and dragons with the right exclusions', () => {
    expectHas('(222z)123m456m789m123t99t', 'wrong-seat', { seatWind: 1 })
    expectHas('(222z)123m456m789m123t99t', 'right-seat', { seatWind: 2 })
    expectHas('(111z)(222z)123m456m789m33z', 'small-three-winds')
    expectHas('(111z)(222z)(333z)456m789m99t', 'big-three-winds')
    expectLacks('(111z)(222z)(333z)456m789m99t', 'small-three-winds')
    expectHas('(111z)(222z)(333z)456m789m44z', 'small-four-winds')
    expectLacks('(111z)(222z)(333z)456m789m44z', 'big-three-winds')
    expectHas('(111z)(222z)(333z)(444z)555t99m', 'big-four-winds')
    expectHas('(555z)(666z)123m456m789m77z', 'small-dragons')
    expectLacks('(555z)(666z)123m456m789m77z', 'dragon')
    expectHas('(555z)(666z)(777z)123m456m99t', 'big-dragons')
    expectLacks('(555z)(666z)(777z)123m456m99t', 'dragon')
  })

  it('scores pung hands, concealed chains, and five kongs', () => {
    expectHas('111222333m444t555b11z', 'five-concealed-draw', { selfDraw: true })
    expectLacks('111222333m444t555b11z', 'all-pungs', { selfDraw: true })
    expectLacks('111222333m444t555b11z', 'five-concealed', { selfDraw: true })
    expectHas('(111m)222333t456t789b11z', 'two-concealed')
    expectLacks('(111m)222333t456t789b11z', 'three-concealed')
    expectHas('(1111m)(2222t)(3333b)(4444z)[5555z]99m', 'five-kongs')
    expectHas('(1111m)(2222t)(3333b)(4444z)[5555z]99m', 'all-pungs')
    expectLacks('(1111m)(2222t)(3333b)(4444z)[5555z]99m', 'kong')
    expectLacks('(1111m)(2222t)(3333b)(4444z)[5555z]99m', 'five-concealed')
  })

  it('scores finish shapes and declared situation flags', () => {
    expectHas('123m456m789m123t456t99t*', 'single-wait')
    expectLacks('123m456m789m123t456t99t*', 'fake-single')
    expectHas('112233m44*4t456t789b11z', 'dual-pung')
    expectHas('123m456m789m123t456t99t', 'concealed-self', { selfDraw: true })
    expectLacks('123m456m789m123t456t99t', 'self-draw', { selfDraw: true })
    expectHas('123m456m789m123t456t99t', 'concealed-riichi', { riichi: 'riichi' })
    expectLacks('123m456m789m123t456t99t', 'riichi', { riichi: 'riichi' })
    expectHas('123m456m789m123t456t99t', 'heavenly-riichi', { riichi: 'heavenly-riichi' })
    expectHas('123m456m789m123t456t99t', 'ippatsu', { riichi: 'riichi', instantWin: true })
    expectHas('123m456m789m123t456t99t', 'eat-riichi', { eatRiichi: true })
    expectHas('123m456m789m123t456t99t', 'early-four', { earlyWin: 'four' })
    expectHas('123m456m789m123t456t99t', 'heaven', { heavenlyWin: 'heaven' })
    expectLacks('123m456m789m123t456t99t', 'early-four', { heavenlyWin: 'heaven', earlyWin: 'four' })
    expectHas('123m456m789m123t456t99t', 'double-win', { multiWin: 'double' })
    expectHas('123m456m789m123t456t99t', 'triple-win', { multiWin: 'triple' })
    expectHas('123m456m789m123t456t11*t', 'sea-one', { lastTileWin: 'sea-bottom', selfDraw: true })
    const sea = matches('123m456m789m123t456t11*t', { lastTileWin: 'sea-bottom', selfDraw: true })
    expect(sea.ids.has('sea-one')).toBe(true)
    expect(sea.ids.has('sea')).toBe(false)
    expectHas('123m456m789m123t456t99t', 'flower-draw', { flowerDraw: 2 })
    expect(matches('123m456m789m123t456t99t', { flowerDraw: 2 }).all.find((m) => m.id === 'flower-draw')?.tai).toBe(4)
    expect(matches('123m456m789m123t456t99t', { kongDraw: 2 }).all.find((m) => m.id === 'kong-draw')?.tai).toBe(25)
    expect(matches('123m456m789m123t456t99t', { robKong: 3 }).all.find((m) => m.id === 'rob-kong')?.tai).toBe(125)
    expect(matches('123m456m789m123t456t99t', { dealerStreak: 2 }).all.find((m) => m.id === 'dealer')?.tai).toBe(3)
    expectHas('(123m)(456m)(789m)(123t)(456t)99t', 'all-claimed')
    expectHas('(123m)(456m)(789m)(123t)(456t)99t', 'all-self', { selfDraw: true })
  })

  it('scores flowers against the seat wind', () => {
    const n = '123m456m789m123t456t99t12f3s'
    expectHas(n, 'right-flower', { seatWind: 1 })
    expectHas(n, 'wrong-flower', { seatWind: 1 })
    expectLacks(n, 'no-flowers')
    const row = matches(n, { seatWind: 1 }).all.find((m) => m.id === 'right-flower')
    expect(row?.tai).toBe(2)
  })

  it('scores returns, identical runs, straights, and common ranks', () => {
    expectHas('222234m456m789m123t99b', 'return1-hidden')
    expectHas('123123m456m789m123t99t', 'identical-hidden')
    expectHas('123456789m123t456t99t', 'straight-hidden')
    expectLacks('123456789m123t456t99t', 'old-young-run')
    expectHas('123m456t789b123456m99t', 'mixed-straight-hidden')
    expectHas('123234345m333b123t11z', 'common-x')
    expectHas('(111m)(999m)123t456t789b99b', 'old-young-pung')
    expectHas('123m789m123t789t111b99b', 'all-terminal')
    expectLacks('123m789m123t789t111b99b', 'no-five')
    expectHas('111999m111222z555z99b', 'mixed-old')
    expectHas('111999m111999t111b99b', 'pure-old')
    expectLacks('111999m111999t111b99b', 'mixed-old')
    expectHas('111999m111999t111b99b', 'all-pungs')
  })

  it('scores flush, range, eye, treasures, stairs, and meetings', () => {
    expectHas('123456789m123456m99m', 'pure-flush')
    expectLacks('123456789m123456m99m', 'mixed-flush')
    expectHas('123456789m456m111z99m', 'mixed-flush')
    expectHas('234m456m678m234t456t88t', 'simples')
    expectHas('234m456m678m234t456t88t', 'eye')
    expectHas('666m777m888m666t777t99t', 'above-five')
    expectLacks('666m777m888m666t777t99t', 'no-five')
    expectHas('111222333m111222t44t', 'below-five')
    expectHas('234678m234678m234m88m', 'three-treasures')
    expectHas('234678m234678m234m88m', 'no-five')
    expectHas('234678m234678m234m88m', 'simples')
    expectHas('234678m234678m234m88m', 'pure-flush')
    expectHas('123m234m345m456m567t99b', 'stairs')
    expectLacks('123m234m345m456m567t99b', 'five-step')
    expectHas('123234345456567m99m', 'five-step')
    expectLacks('123234345456567m99m', 'stairs')
    expectHas('123m123t456m456t789m99b', 'meet')
    expectHas('123m123t456m456t789m99b', 'two-sisters')
    expectHas('123123m123t456t456b99m', 'all-sisters')
    expectLacks('123123m123t456t456b99m', 'two-sisters')
  })

  it('scores brothers, color chains, coverage, and steps', () => {
    expectHas('(555m)(555t)123b456b789m11z', 'bros2')
    expectHas('(555m)(555t)(555b)123m456m11z', 'bros3')
    expectHas('(555m)(555t)123b456b789m55b', 'bros3s')
    expectHas('(333t)(444m)(555b)123m456t11z', 'color-chain')
    expectHas('123234345m456m789t99b', 'step-hidden')
    expectHas('(555z)123m456t789b678m22z', 'five-small')
    expectLacks('(555z)123m456t789b678m22z', 'five-big')
    expectHas('(111z)(555z)123m456t789b99t', 'five-big')
    expectHas('(555z)123m456t789b678m22z1f1s', 'seven-small')
    expectLacks('(555z)123m456t789b678m22z1f1s', 'five-small')
  })

  it('scores a chicken hand and a self-drawn duck', () => {
    const n = '(222m)4*56t789b345m678t11z'
    expectHas(n, 'chicken')
    expectLacks(n, 'duck')
    expectHas(n, 'duck', { selfDraw: true })
    expectLacks(n, 'chicken', { selfDraw: true })
  })

  it('keeps zero-value patterns out of the total', () => {
    const found = matches('(222z)123m456m789m123t99t', { roundWind: 2 })
    expect(found.all.some((m) => m.id === 'right-round')).toBe(false)
    expect(CATALOG.find((p) => p.id === 'chain5')?.value).toBe(0)
  })

  it('scores the remaining meld patterns and situation flags', () => {
    expectHas('(111z)(222z)(333z)(444z)555z66z', 'all-honors')
    expectHas('(123t)111222333444m55t', 'four-concealed')
    expectHas('(333m)3*45m456m789t123b11z', 'visible-triple')
    expectHas('(333m)(6666m)3*45m789t123b99t', 'visible-exhausted')
    expectLacks('(333m)(6666m)3*45m789t123b99t', 'visible-triple')
    expectHas('123m456m789m123t456t99t', 'earthly-riichi', { riichi: 'earthly-riichi' })
    expectHas('123m456m789m123t456t99t', 'earth', { heavenlyWin: 'earth' })
    expectHas('123m456m789m123t456t99t', 'man', { heavenlyWin: 'man' })
    expectHas('123m456m789m123t456t99t', 'river', { lastTileWin: 'river-bottom', selfDraw: true })
    expectHas('123m456m789m123t456t99t', 'sea', { lastTileWin: 'sea-bottom', selfDraw: true })
    expectHas('123m456m789m123t456t99t', 'early-seven', { earlyWin: 'seven' })
    expectHas('123m456m789m123t456t99t', 'early-ten', { earlyWin: 'ten' })
    expectHas('(222m)234m456m789m123t99b', 'return1-open')
    expectHas('(234m)234m456m789m123t22m', 'return2-open')
    expectHas('234234m22m456m789t123b', 'return2-hidden')
    expectHas('123123123123m456t99t', 'return4-hidden')
    expectHas('123123123123m456t99t', 'four-same-hidden')
    expectHas('(123m)123m456m789m123t99t', 'identical-open')
    expectHas('22334455m456t789t123b', 'small-twin-hidden')
    expectHas('123123m456456t789m99b', 'true-twin-hidden')
    expectLacks('123123m456456t789m99b', 'identical-hidden')
    expectHas('123123123m456m789t99b', 'three-same-hidden')
    expectHas('123345567m456t789t99b', 'step2-hidden')
    expectHas('(111m)(222m)456t789t123b11z', 'chain2')
    expectHas('(111m)(222m)(333m)456t789b99t', 'chain3')
    expectLacks('(111m)(222m)(333m)456t789b99t', 'chain2')
    expectHas('(333m)(444m)22m567t789b123t', 'chain3s')
    expectHas('123m123t123b456m789m99t', 'meet3-hidden')
    expectHas('123123m123t123b456m99t', 'meet4-hidden')
    expectLacks('123123m123t123b456m99t', 'meet3-hidden')
    expectHas('(333t)(444b)22m567m789t123b', 'color-chain-s')
    expectHas('123m234t345b456m789t99b', 'color-step-hidden')
    expectHas('(123m)456m789m123t456t99t', 'straight-open')
    expectHas('123234m123t123b11122z', 'common-xy')
    expectHas('123m123t123b123m123t33z', 'common-xyz')
    expectHas('123234m222234t123b22b', 'all-common-x')
    expectHas('(111z)(555z)123m456t789b99t1f1s', 'seven-big')
    expectHas('112233z4455666m7788t', 'three-wind-pairs')
    expectHas('23*3445m678m234t567t99b', 'fake-single')
    expectLacks('23*3445m678m234t567t99b', 'single-wait')
    expectHas('(123m)123123123m456t99t', 'four-same-open')
    expectHas('(123m)123123123m456t99t', 'return4-open')
    expectHas('(123m)123m456456t789m99b', 'true-twin-open')
    expectHas('(123m)123123m456m789t99b', 'three-same-open')
    expectHas('(345m)345m456t789t123b22m', 'small-twin-open')
    expectHas('(123m)234m345m456t789t99b', 'step-open')
    expectHas('(123m)345m567m456t789t99b', 'step2-open')
    expectHas('(123m)123t123b456m789m99t', 'meet3-open')
    expectHas('(123m)123m123t123b456m99t', 'meet4-open')
    expectHas('123123m123123t123b99m', 'meet5-hidden')
    expectHas('(123m)123m123123t123b99m', 'meet5-open')
    expectHas('(123m)234t345b456m789t99b', 'color-step-open')
    expectHas('(123m)456t789b456m123t99t', 'mixed-straight-open')
    expect(matches('(111m)(222m)(333m)(444m)555t99t').ids.has('chain4')).toBe(false)
    expect(CATALOG.filter((p) => p.value === 0).map((p) => p.id)).toEqual(
      expect.arrayContaining(['right-round', 'chain4', 'chain4s', 'chain5', 'chain5s', 'chain6s', 'chain-double']),
    )
  })

  it('reports both readings when eight pairs is also an ordinary hand', () => {
    const found = matches('11122334455667788m')
    expect(found.result?.second).toBeTruthy()
    expect(found.total).toBeGreaterThan((found.result?.second?.total ?? 0))
  })
})
