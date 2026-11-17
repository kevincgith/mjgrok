import type { HandShape } from './tiles.ts'

export type ValueKind = 'flat' | 'per' | 'table' | 'streak'
export type LadderMode = 'highest' | 'stack'

export interface CatalogPattern {
  id: string
  zh: string
  en: string
  family: string
  kind: ValueKind
  /** Flat tai, per-instance tai, or unused for table/streak. 0 means off. */
  value: number
  table?: number[]
  streak?: [number, number]
  excludes: string[]
  ladder?: string
  tier?: number
  shapes: HandShape[]
  blocksChicken: boolean
  pair?: string
  aliases: string[]
  /** Windows ladder: longer zero-value tiers do not suppress shorter ones. */
  window?: { length: number; small: boolean }
}

const N: HandShape[] = ['normal']
const ALL: HandShape[] = ['normal', 'orphans', 'unrelated', 'eight']
const NE: HandShape[] = ['normal', 'eight']
const NO: HandShape[] = ['normal', 'orphans']
const SIT: HandShape[] = ALL

function pat(p: Omit<CatalogPattern, 'excludes' | 'shapes' | 'blocksChicken' | 'aliases'> & Partial<Pick<CatalogPattern, 'excludes' | 'shapes' | 'blocksChicken' | 'aliases'>>): CatalogPattern {
  return {
    excludes: [],
    shapes: N,
    blocksChicken: true,
    aliases: [],
    ...p,
  }
}

const off = { blocksChicken: false }

export const CATALOG: CatalogPattern[] = [
  pat({ id: 'base', zh: '底', en: 'Base', family: 'Foundation', kind: 'flat', value: 5, shapes: ALL, ...off }),
  pat({ id: 'concealed-hand', zh: '門前清', en: 'Concealed hand', family: 'Foundation', kind: 'flat', value: 5 }),
  pat({ id: 'kong', zh: '槓', en: 'Kong', family: 'Foundation', kind: 'per', value: 2 }),

  pat({ id: 'orphans', zh: '十三么', en: 'Thirteen orphans', family: 'Special', kind: 'flat', value: 160, shapes: ['orphans'], excludes: ['concealed-hand'] }),
  pat({ id: 'four-return-open', zh: '明四歸', en: 'Four returned, open', family: 'Special', kind: 'per', value: 5, shapes: ['orphans', 'eight'], pair: 'four-return-hidden' }),
  pat({ id: 'four-return-hidden', zh: '暗四歸', en: 'Four returned, concealed', family: 'Special', kind: 'per', value: 15, shapes: ['orphans', 'eight'], pair: 'four-return-open' }),
  pat({ id: 'sixteen', zh: '十六不搭', en: 'Sixteen unrelated', family: 'Special', kind: 'flat', value: 50, shapes: ['unrelated'] }),
  pat({ id: 'sixteen-fly', zh: '十六不搭(十六飛)', en: 'Sixteen-way wait', family: 'Special', kind: 'flat', value: 60, shapes: ['unrelated'], excludes: ['sixteen'] }),
  pat({ id: 'sixteen-same', zh: '不搭三相逢', en: 'Unrelated same ranks', family: 'Special', kind: 'flat', value: 20, shapes: ['unrelated'] }),
  pat({ id: 'sixteen-dragon', zh: '不搭雜龍', en: 'Unrelated mixed straight', family: 'Special', kind: 'flat', value: 20, shapes: ['unrelated'] }),
  pat({ id: 'eight', zh: '嚦咕嚦咕', en: 'Eight pairs', family: 'Special', kind: 'flat', value: 50, shapes: ['eight'] }),
  pat({ id: 'eight-fly', zh: '嚦咕嚦咕八飛', en: 'Eight-pair multi-wait', family: 'Special', kind: 'flat', value: 60, shapes: ['eight'], excludes: ['eight'] }),
  pat({ id: 'three-dragon-pairs', zh: '三元嚦咕', en: 'Three dragon pairs', family: 'Special', kind: 'flat', value: 20, shapes: ['eight'] }),
  pat({ id: 'three-wind-pairs', zh: '三風嚦咕', en: 'Three wind pairs', family: 'Special', kind: 'flat', value: 15, shapes: ['eight'] }),
  pat({ id: 'four-wind-pairs', zh: '四喜嚦咕', en: 'Four wind pairs', family: 'Special', kind: 'flat', value: 60, shapes: ['eight'], excludes: ['three-wind-pairs'] }),

  pat({ id: 'no-flowers', zh: '無花', en: 'No flowers', family: 'Bonus', kind: 'flat', value: 2, shapes: ALL, ...off }),
  pat({ id: 'right-flower', zh: '正花', en: 'Correct flower', family: 'Bonus', kind: 'per', value: 2, shapes: ALL, ...off }),
  pat({ id: 'wrong-flower', zh: '爛花', en: 'Wrong flower', family: 'Bonus', kind: 'per', value: 2, shapes: ALL, ...off }),

  pat({ id: 'no-honor-flower', zh: '無字花', en: 'No honors, no flowers', family: 'Purity', kind: 'flat', value: 10, shapes: NE, excludes: ['no-honor', 'no-flowers'] }),
  pat({ id: 'no-honor', zh: '無字', en: 'No honors', family: 'Purity', kind: 'flat', value: 2, shapes: NE }),
  pat({ id: 'all-honors', zh: '字一色', en: 'All honors', family: 'Purity', kind: 'flat', value: 160, shapes: NE }),

  pat({ id: 'wrong-seat', zh: '爛位風', en: 'Wrong seat wind', family: 'Winds', kind: 'flat', value: 2 }),
  pat({ id: 'right-seat', zh: '正位風', en: 'Right seat wind', family: 'Winds', kind: 'flat', value: 2 }),
  pat({ id: 'right-round', zh: '正圈風', en: 'Right round wind', family: 'Winds', kind: 'flat', value: 0 }),
  pat({ id: 'small-three-winds', zh: '小三風', en: 'Small three winds', family: 'Winds', kind: 'flat', value: 30, excludes: ['wrong-seat', 'right-seat', 'right-round'] }),
  pat({ id: 'big-three-winds', zh: '大三風', en: 'Big three winds', family: 'Winds', kind: 'flat', value: 60, excludes: ['wrong-seat', 'right-seat', 'right-round', 'small-three-winds'] }),
  pat({ id: 'small-four-winds', zh: '小四喜', en: 'Small four winds', family: 'Winds', kind: 'flat', value: 120, excludes: ['wrong-seat', 'right-seat', 'right-round', 'small-three-winds', 'big-three-winds'] }),
  pat({ id: 'big-four-winds', zh: '大四喜', en: 'Big four winds', family: 'Winds', kind: 'flat', value: 160, excludes: ['wrong-seat', 'right-seat', 'right-round', 'small-three-winds', 'big-three-winds', 'small-four-winds'] }),

  pat({ id: 'dragon', zh: '三元牌', en: 'Dragon pung', family: 'Dragons', kind: 'per', value: 2, ladder: 'dragons', tier: 0 }),
  pat({ id: 'small-dragons', zh: '小三元', en: 'Small three dragons', family: 'Dragons', kind: 'flat', value: 40, ladder: 'dragons', tier: 1 }),
  pat({ id: 'big-dragons', zh: '大三元', en: 'Big three dragons', family: 'Dragons', kind: 'flat', value: 80, ladder: 'dragons', tier: 2 }),

  pat({ id: 'all-runs', zh: '平胡', en: 'All runs', family: 'Shape', kind: 'flat', value: 5 }),
  pat({ id: 'pure-all-runs', zh: '無字花大平胡', en: 'Pure all runs', family: 'Shape', kind: 'flat', value: 20, excludes: ['all-runs', 'no-honor-flower'] }),
  pat({ id: 'all-pungs', zh: '對對胡', en: 'All pungs', family: 'Shape', kind: 'flat', value: 40 }),
  pat({ id: 'five-concealed-draw', zh: '坎坎胡', en: 'Five concealed pungs, self-draw', family: 'Shape', kind: 'flat', value: 160, excludes: ['all-pungs', 'two-concealed', 'three-concealed', 'four-concealed', 'five-concealed'] }),

  pat({ id: 'two-concealed', zh: '兩暗刻', en: 'Two concealed pungs', family: 'Concealed', kind: 'flat', value: 5, ladder: 'concealed', tier: 0 }),
  pat({ id: 'three-concealed', zh: '三暗刻', en: 'Three concealed pungs', family: 'Concealed', kind: 'flat', value: 15, ladder: 'concealed', tier: 1 }),
  pat({ id: 'four-concealed', zh: '四暗刻', en: 'Four concealed pungs', family: 'Concealed', kind: 'flat', value: 30, ladder: 'concealed', tier: 2 }),
  pat({ id: 'five-concealed', zh: '五暗刻', en: 'Five concealed pungs', family: 'Concealed', kind: 'flat', value: 80, ladder: 'concealed', tier: 3 }),
  pat({ id: 'five-kongs', zh: '五槓子', en: 'Five kongs', family: 'Concealed', kind: 'flat', value: 240, excludes: ['kong', 'four-concealed', 'five-concealed'] }),

  pat({ id: 'dual-pung', zh: '對碰', en: 'Dual pair wait', family: 'Finish', kind: 'flat', value: 2, shapes: ['normal'] }),
  pat({ id: 'single-wait', zh: '獨獨', en: 'Single wait', family: 'Finish', kind: 'flat', value: 2, shapes: ALL, excludes: ['fake-single'] }),
  pat({ id: 'fake-single', zh: '假獨', en: 'Fake single wait', family: 'Finish', kind: 'flat', value: 2, shapes: ALL }),
  pat({ id: 'visible-triple', zh: '明絕', en: 'Last visible copy', family: 'Finish', kind: 'flat', value: 5, shapes: ALL, ...off }),
  pat({ id: 'visible-exhausted', zh: '絕絕', en: 'Exhausted multi-wait', family: 'Finish', kind: 'flat', value: 10, shapes: ALL, excludes: ['visible-triple'], ...off }),
  pat({ id: 'self-draw', zh: '自摸', en: 'Self-draw', family: 'Finish', kind: 'flat', value: 1, shapes: SIT }),
  pat({ id: 'concealed-self', zh: '門清自摸', en: 'Concealed self-draw', family: 'Finish', kind: 'flat', value: 3, excludes: ['self-draw'] }),
  pat({ id: 'riichi', zh: '叮', en: 'Riichi', family: 'Finish', kind: 'flat', value: 5, shapes: SIT, ...off }),
  pat({ id: 'concealed-riichi', zh: '門清叮', en: 'Concealed riichi', family: 'Finish', kind: 'flat', value: 10, excludes: ['riichi'] }),
  pat({ id: 'heavenly-riichi', zh: '天叮', en: 'Heavenly riichi', family: 'Finish', kind: 'flat', value: 60, shapes: SIT, excludes: ['riichi', 'concealed-riichi'], ...off }),
  pat({ id: 'earthly-riichi', zh: '地叮', en: 'Earthly riichi', family: 'Finish', kind: 'flat', value: 50, shapes: SIT, excludes: ['riichi', 'concealed-riichi'], ...off }),
  pat({ id: 'ippatsu', zh: '一發', en: 'One-shot', family: 'Finish', kind: 'flat', value: 5, shapes: SIT, ...off }),
  pat({ id: 'eat-riichi', zh: '食叮', en: 'Eat a riichi', family: 'Finish', kind: 'flat', value: 5, shapes: SIT, ...off }),
  pat({ id: 'early-four', zh: '四子內', en: 'Within four discards', family: 'Finish', kind: 'flat', value: 60, shapes: SIT, ...off }),
  pat({ id: 'early-seven', zh: '七子內', en: 'Within seven discards', family: 'Finish', kind: 'flat', value: 30, shapes: SIT, ...off }),
  pat({ id: 'early-ten', zh: '十子內', en: 'Within ten discards', family: 'Finish', kind: 'flat', value: 15, shapes: SIT, ...off }),
  pat({ id: 'double-win', zh: '雙響', en: 'Double win', family: 'Finish', kind: 'flat', value: 5, shapes: SIT, ...off }),
  pat({ id: 'triple-win', zh: '三響', en: 'Triple win', family: 'Finish', kind: 'flat', value: 10, shapes: SIT, ...off }),
  pat({ id: 'heaven', zh: '天胡', en: 'Heavenly hand', family: 'Finish', kind: 'flat', value: 160, shapes: SIT, excludes: ['early-four', 'early-seven', 'early-ten'], ...off }),
  pat({ id: 'earth', zh: '地胡', en: 'Earth hand', family: 'Finish', kind: 'flat', value: 120, shapes: SIT, excludes: ['early-four', 'early-seven', 'early-ten'], ...off }),
  pat({ id: 'man', zh: '人胡', en: 'Human hand', family: 'Finish', kind: 'flat', value: 80, shapes: SIT, excludes: ['early-four', 'early-seven', 'early-ten'], ...off }),
  pat({ id: 'river', zh: '河底撈魚', en: 'Win on the last discard', family: 'Finish', kind: 'flat', value: 5, shapes: SIT, ...off }),
  pat({ id: 'sea', zh: '海底撈月', en: 'Win on the last wall tile', family: 'Finish', kind: 'flat', value: 10, shapes: SIT, ...off }),
  pat({ id: 'sea-one', zh: '海底撈月(一筒)', en: 'Last tile is 1 dot', family: 'Finish', kind: 'flat', value: 20, shapes: SIT, excludes: ['sea'], ...off }),
  pat({ id: 'flower-draw', zh: '花摸', en: 'Flower replacement', family: 'Finish', kind: 'per', value: 2, shapes: SIT, ...off }),
  pat({ id: 'kong-draw', zh: '槓摸', en: 'Kong replacement', family: 'Finish', kind: 'table', value: 0, table: [0, 5, 25, 125, 250, 250], shapes: SIT, ...off }),
  pat({ id: 'rob-kong', zh: '搶槓', en: 'Robbing a kong', family: 'Finish', kind: 'table', value: 0, table: [0, 5, 25, 125, 250, 250], shapes: SIT, ...off }),
  pat({ id: 'dealer', zh: '莊', en: 'Dealer streak', family: 'Finish', kind: 'streak', value: 0, streak: [1, 2], shapes: SIT, ...off }),
  pat({ id: 'all-claimed', zh: '全求人', en: 'All melds claimed', family: 'Finish', kind: 'flat', value: 30 }),
  pat({ id: 'all-self', zh: '半求人', en: 'All melds, self-draw', family: 'Finish', kind: 'flat', value: 15 }),
  pat({ id: 'chicken', zh: '大雞', en: 'Chicken hand', family: 'Finish', kind: 'flat', value: 30, ...off }),
  pat({ id: 'duck', zh: '大鴨', en: 'Duck hand', family: 'Finish', kind: 'flat', value: 15, ...off }),

  pat({ id: 'return1-open', zh: '明四歸一', en: 'Pung and run, open', family: 'Returns', kind: 'per', value: 5, pair: 'return1-hidden' }),
  pat({ id: 'return1-hidden', zh: '暗四歸一', en: 'Pung and run, concealed', family: 'Returns', kind: 'per', value: 15, pair: 'return1-open' }),
  pat({ id: 'return2-open', zh: '明四歸二', en: 'Pair and two runs, open', family: 'Returns', kind: 'flat', value: 15, pair: 'return2-hidden' }),
  pat({ id: 'return2-hidden', zh: '暗四歸二', en: 'Pair and two runs, concealed', family: 'Returns', kind: 'flat', value: 30, pair: 'return2-open' }),
  pat({ id: 'return4-open', zh: '明四歸四', en: 'Four runs, open', family: 'Returns', kind: 'per', value: 30, pair: 'return4-hidden' }),
  pat({ id: 'return4-hidden', zh: '暗四歸四', en: 'Four runs, concealed', family: 'Returns', kind: 'per', value: 60, pair: 'return4-open' }),

  pat({ id: 'identical-open', zh: '明般高', en: 'Identical runs, open', family: 'Sequences', kind: 'per', value: 5, pair: 'identical-hidden', aliases: ['一般高'] }),
  pat({ id: 'identical-hidden', zh: '暗般高', en: 'Identical runs, concealed', family: 'Sequences', kind: 'per', value: 8, pair: 'identical-open', aliases: ['一般高'] }),
  pat({ id: 'small-twin-open', zh: '明小雙般高', en: 'Twin runs with end pair, open', family: 'Sequences', kind: 'flat', value: 10, excludes: ['identical-open', 'identical-hidden'], pair: 'small-twin-hidden' }),
  pat({ id: 'small-twin-hidden', zh: '暗小雙般高', en: 'Twin runs with end pair, concealed', family: 'Sequences', kind: 'flat', value: 15, excludes: ['identical-open', 'identical-hidden'], pair: 'small-twin-open' }),
  pat({ id: 'true-twin-open', zh: '明真雙般高', en: 'Two identical pairs, open', family: 'Sequences', kind: 'flat', value: 20, excludes: ['identical-open', 'identical-hidden'], pair: 'true-twin-hidden' }),
  pat({ id: 'true-twin-hidden', zh: '暗真雙般高', en: 'Two identical pairs, concealed', family: 'Sequences', kind: 'flat', value: 40, excludes: ['identical-open', 'identical-hidden'], pair: 'true-twin-open' }),
  pat({ id: 'three-same-open', zh: '明一色三同順', en: 'Three identical runs, open', family: 'Sequences', kind: 'per', value: 30, excludes: ['identical-open', 'identical-hidden'], pair: 'three-same-hidden' }),
  pat({ id: 'three-same-hidden', zh: '暗一色三同順', en: 'Three identical runs, concealed', family: 'Sequences', kind: 'per', value: 60, excludes: ['identical-open', 'identical-hidden'], pair: 'three-same-open' }),
  pat({ id: 'four-same-open', zh: '明一色四同順', en: 'Four identical runs, open', family: 'Sequences', kind: 'per', value: 80, excludes: ['identical-open', 'identical-hidden', 'three-same-open', 'three-same-hidden'], pair: 'four-same-hidden' }),
  pat({ id: 'four-same-hidden', zh: '暗一色四同順', en: 'Four identical runs, concealed', family: 'Sequences', kind: 'per', value: 160, excludes: ['identical-open', 'identical-hidden', 'three-same-open', 'three-same-hidden'], pair: 'four-same-open' }),
  pat({ id: 'step-open', zh: '明單色步步高', en: 'Stepped runs, open', family: 'Sequences', kind: 'per', value: 15, pair: 'step-hidden' }),
  pat({ id: 'step-hidden', zh: '暗單色步步高', en: 'Stepped runs, concealed', family: 'Sequences', kind: 'per', value: 30, pair: 'step-open' }),
  pat({ id: 'step2-open', zh: '明單色二步高', en: 'Skip-stepped runs, open', family: 'Sequences', kind: 'per', value: 8, pair: 'step2-hidden' }),
  pat({ id: 'step2-hidden', zh: '暗單色二步高', en: 'Skip-stepped runs, concealed', family: 'Sequences', kind: 'per', value: 15, pair: 'step2-open' }),

  pat({ id: 'chain2', zh: '二連刻', en: 'Two linked pungs', family: 'Chains', kind: 'per', value: 5, window: { length: 2, small: false } }),
  pat({ id: 'chain3s', zh: '小三連刻', en: 'Small three linked', family: 'Chains', kind: 'per', value: 15, window: { length: 3, small: true } }),
  pat({ id: 'chain3', zh: '大三連刻', en: 'Big three linked', family: 'Chains', kind: 'per', value: 30, window: { length: 3, small: false } }),
  pat({ id: 'chain4s', zh: '小四連刻', en: 'Small four linked', family: 'Chains', kind: 'per', value: 0, window: { length: 4, small: true } }),
  pat({ id: 'chain4', zh: '大四連刻', en: 'Big four linked', family: 'Chains', kind: 'per', value: 0, window: { length: 4, small: false } }),
  pat({ id: 'chain5s', zh: '小五連刻', en: 'Small five linked', family: 'Chains', kind: 'per', value: 0, window: { length: 5, small: true } }),
  pat({ id: 'chain5', zh: '大五連刻', en: 'Big five linked', family: 'Chains', kind: 'per', value: 0, window: { length: 5, small: false } }),
  pat({ id: 'chain6s', zh: '小六連刻', en: 'Small six linked', family: 'Chains', kind: 'per', value: 0, window: { length: 6, small: true } }),
  pat({ id: 'chain-double', zh: '雙連刻', en: 'Two separate pairs of linked pungs', family: 'Chains', kind: 'per', value: 0, excludes: ['chain2'] }),

  pat({ id: 'meet', zh: '相逢', en: 'Same run, two suits', family: 'Cross', kind: 'per', value: 3 }),
  pat({ id: 'two-sisters', zh: '雙姊妹', en: 'Two separate meetings', family: 'Cross', kind: 'flat', value: 5 }),
  pat({ id: 'all-sisters', zh: '全姊妹', en: 'Every meld meets', family: 'Cross', kind: 'flat', value: 20, excludes: ['two-sisters'] }),
  pat({ id: 'stairs', zh: '樓梯', en: 'Five-step stair', family: 'Cross', kind: 'flat', value: 20 }),
  pat({ id: 'five-step', zh: '五步高', en: 'Strict stair', family: 'Cross', kind: 'flat', value: 40, excludes: ['stairs'], aliases: ['全碟'] }),
  pat({ id: 'meet3-open', zh: '明三相逢', en: 'Same run in three suits, open', family: 'Cross', kind: 'flat', value: 10, pair: 'meet3-hidden' }),
  pat({ id: 'meet3-hidden', zh: '暗三相逢', en: 'Same run in three suits, concealed', family: 'Cross', kind: 'flat', value: 20, pair: 'meet3-open' }),
  pat({ id: 'meet4-open', zh: '明四相逢', en: 'Four-run meeting, open', family: 'Cross', kind: 'flat', value: 40, excludes: ['meet3-open', 'meet3-hidden'], pair: 'meet4-hidden' }),
  pat({ id: 'meet4-hidden', zh: '暗四相逢', en: 'Four-run meeting, concealed', family: 'Cross', kind: 'flat', value: 80, excludes: ['meet3-open', 'meet3-hidden'], pair: 'meet4-open' }),
  pat({ id: 'meet5-open', zh: '明五相逢', en: 'Five-run meeting, open', family: 'Cross', kind: 'flat', value: 80, excludes: ['meet3-open', 'meet3-hidden', 'meet4-open', 'meet4-hidden'], pair: 'meet5-hidden' }),
  pat({ id: 'meet5-hidden', zh: '暗五相逢', en: 'Five-run meeting, concealed', family: 'Cross', kind: 'flat', value: 160, excludes: ['meet3-open', 'meet3-hidden', 'meet4-open', 'meet4-hidden'], pair: 'meet5-open' }),
  pat({ id: 'bros2', zh: '兩兄弟', en: 'Same pung, two suits', family: 'Cross', kind: 'per', value: 5 }),
  pat({ id: 'bros3s', zh: '小三兄弟', en: 'Small three brothers', family: 'Cross', kind: 'flat', value: 20 }),
  pat({ id: 'bros3', zh: '大三兄弟', en: 'Big three brothers', family: 'Cross', kind: 'flat', value: 40 }),
  pat({ id: 'color-chain-s', zh: '小三色連刻', en: 'Small three-suit chain', family: 'Cross', kind: 'per', value: 10 }),
  pat({ id: 'color-chain', zh: '大三色連刻', en: 'Big three-suit chain', family: 'Cross', kind: 'per', value: 20 }),
  pat({ id: 'color-step-open', zh: '明三色步步高', en: 'Three-suit steps, open', family: 'Cross', kind: 'per', value: 5, pair: 'color-step-hidden' }),
  pat({ id: 'color-step-hidden', zh: '暗三色步步高', en: 'Three-suit steps, concealed', family: 'Cross', kind: 'per', value: 10, pair: 'color-step-open' }),

  pat({ id: 'mixed-flush', zh: '混一色', en: 'Mixed flush', family: 'Flush', kind: 'flat', value: 40, shapes: NE, ladder: 'flush', tier: 0, aliases: ['混一'] }),
  pat({ id: 'pure-flush', zh: '清一色', en: 'Pure flush', family: 'Flush', kind: 'flat', value: 120, shapes: NE, ladder: 'flush', tier: 1 }),

  pat({ id: 'straight-open', zh: '明清龍', en: 'Pure straight, open', family: 'Straights', kind: 'per', value: 10, pair: 'straight-hidden' }),
  pat({ id: 'straight-hidden', zh: '暗清龍', en: 'Pure straight, concealed', family: 'Straights', kind: 'per', value: 20, pair: 'straight-open' }),
  pat({ id: 'mixed-straight-open', zh: '明雜龍', en: 'Mixed straight, open', family: 'Straights', kind: 'per', value: 8, pair: 'mixed-straight-hidden' }),
  pat({ id: 'mixed-straight-hidden', zh: '暗雜龍', en: 'Mixed straight, concealed', family: 'Straights', kind: 'per', value: 15, pair: 'mixed-straight-open' }),
  pat({ id: 'old-young-run', zh: '老少上', en: 'Terminal runs', family: 'Straights', kind: 'per', value: 3 }),
  pat({ id: 'old-young-pung', zh: '老少碰', en: 'Terminal pungs', family: 'Straights', kind: 'per', value: 5 }),

  pat({ id: 'common-x', zh: '混帶X', en: 'Common rank', family: 'Common', kind: 'flat', value: 30, aliases: ['混全帶'] }),
  pat({ id: 'common-xy', zh: '混帶XY', en: 'Two common ranks', family: 'Common', kind: 'flat', value: 50, excludes: ['common-x'] }),
  pat({ id: 'common-xyz', zh: '混帶XYZ', en: 'Three common ranks', family: 'Common', kind: 'flat', value: 60, excludes: ['common-xy'] }),
  pat({ id: 'all-common-x', zh: '全帶X', en: 'Common rank, no honors', family: 'Common', kind: 'flat', value: 120, excludes: ['common-x'] }),
  pat({ id: 'mixed-terminal', zh: '混帶么', en: 'Mixed terminals', family: 'Common', kind: 'flat', value: 40, shapes: NO, aliases: ['混全帶么'] }),
  pat({ id: 'all-terminal', zh: '全帶么', en: 'All terminals', family: 'Common', kind: 'flat', value: 80, excludes: ['no-five'] }),
  pat({ id: 'mixed-old', zh: '混老頭', en: 'Mixed terminal pungs', family: 'Common', kind: 'flat', value: 100, shapes: ['normal', 'orphans', 'eight'], excludes: ['mixed-terminal', 'all-terminal'] }),
  pat({ id: 'pure-old', zh: '清老頭', en: 'Pure terminal pungs', family: 'Common', kind: 'flat', value: 200, shapes: NE, excludes: ['mixed-terminal', 'all-terminal', 'mixed-old'] }),

  pat({ id: 'two-suits', zh: '缺一門', en: 'Two suits', family: 'Coverage', kind: 'flat', value: 10, shapes: NE }),
  pat({ id: 'five-small', zh: '小五門齊', en: 'Small five suits', family: 'Coverage', kind: 'flat', value: 10, shapes: NE }),
  pat({ id: 'five-big', zh: '大五門齊', en: 'Big five suits', family: 'Coverage', kind: 'flat', value: 15 }),
  pat({ id: 'seven-small', zh: '小七門齊', en: 'Small seven suits', family: 'Coverage', kind: 'flat', value: 15, shapes: NE, excludes: ['five-small'] }),
  pat({ id: 'seven-big', zh: '大七門齊', en: 'Big seven suits', family: 'Coverage', kind: 'flat', value: 20, excludes: ['five-big'] }),

  pat({ id: 'simples', zh: '斷么', en: 'All simples', family: 'Range', kind: 'flat', value: 10, shapes: NE }),
  pat({ id: 'no-five', zh: '缺五', en: 'No fives', family: 'Range', kind: 'flat', value: 10, shapes: NE }),
  pat({ id: 'above-five', zh: '大於五', en: 'Above five', family: 'Range', kind: 'flat', value: 40, shapes: NE, excludes: ['no-five'] }),
  pat({ id: 'below-five', zh: '小於五', en: 'Below five', family: 'Range', kind: 'flat', value: 40, shapes: NE, excludes: ['no-five'] }),

  pat({ id: 'eye', zh: '將眼', en: '2-5-8 pair', family: 'Pair', kind: 'per', value: 2, shapes: ['normal', 'unrelated', 'eight'] }),
  pat({ id: 'three-treasures', zh: '三寶', en: 'Three treasures', family: 'Compound', kind: 'flat', value: 40, shapes: NE }),
]

export const CATALOG_BY_ID = new Map(CATALOG.map((p) => [p.id, p]))

export const COUNT_LADDERS = ['dragons', 'concealed', 'flush'] as const

export function openConcealedPairs(): Array<[string, string]> {
  const unique = new Map<string, [string, string]>()
  for (const p of CATALOG) {
    if (!p.pair) continue
    const key = [p.id, p.pair].sort().join('|')
    unique.set(key, [p.id, p.pair].sort() as [string, string])
  }
  return [...unique.values()]
}
