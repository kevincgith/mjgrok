import { CATALOG } from './taiCatalog.ts'
import { decomposeStandard } from './decompose.ts'
import { compile, houseRules, type EffectiveRules, type RuleDiff } from './rules.ts'
import {
  eightGroups,
  isEightPairsComplete,
  isSixteenUnrelatedComplete,
  isThirteenOrphansComplete,
  preEightWaitCount,
  ranksAreSame,
  ranksCoverOneToNine,
  resolveEightFill,
  resolveOrphanFill,
  resolveSixteenFill,
  sixteenPairAndRanks,
} from './specials.ts'
import { findWaits, markWinning } from './waits.ts'
import {
  type Hand,
  type HandShape,
  type Kind,
  type PatternMatch,
  type ResolvedDecomposition,
  type ResolvedMeld,
  type ScoreResult,
  type Situation,
  defaultSituation,
  countsOf,
  indexKind,
  inferTarget,
  kindIndex,
  kindOf,
  rankOf,
  suitOf,
} from './tiles.ts'

interface Hit {
  count: number
  rows: Kind[][][]
}

interface Ctx {
  hand: Hand
  sit: Situation
  rules: EffectiveRules
  melds: ResolvedMeld[]
  pair: Kind[]
  shape: HandShape
  winning: Kind | null
  selfDraw: boolean
  waitKinds: Kind[] | null
  /** Concrete tile counts after jokers have been assigned a stand-in. */
  resolvedCounts?: number[]
}

const NONE: Hit = { count: 0, rows: [] }

function hit(count: number, rows: Kind[][][] = []): Hit {
  return count > 0 ? { count, rows } : NONE
}

function runs(melds: ResolvedMeld[]): ResolvedMeld[] {
  return melds.filter((m) => m.type === 'chow')
}

function pungs(melds: ResolvedMeld[]): ResolvedMeld[] {
  return melds.filter((m) => m.type === 'pung' || m.type === 'kong')
}

function numbered(kind: Kind): boolean {
  return kind.endsWith('m') || kind.endsWith('t') || kind.endsWith('b')
}

function honor(kind: Kind): boolean {
  return kind.endsWith('z')
}

function terminal(kind: Kind): boolean {
  return numbered(kind) && (rankOf(kind) === 1 || rankOf(kind) === 9)
}

function runStart(meld: ResolvedMeld): { suit: string; start: number } | null {
  if (meld.type !== 'chow') return null
  const suit = suitOf(meld.tiles[0])
  if (suit === 'z' || suit === 'j' || suit === 'f' || suit === 's') return null
  const ranks = meld.tiles.map(rankOf).sort((a, b) => a - b)
  if (ranks[1] !== ranks[0] + 1 || ranks[2] !== ranks[1] + 1) return null
  return { suit, start: ranks[0] }
}

function product(groups: ResolvedMeld[][]): ResolvedMeld[][] {
  if (groups.some((g) => g.length === 0)) return []
  let rows: ResolvedMeld[][] = [[]]
  for (const group of groups) {
    const next: ResolvedMeld[][] = []
    for (const row of rows) for (const meld of group) next.push([...row, meld])
    rows = next
    if (rows.length > 64) break
  }
  return rows
}

function splitOpen(rows: ResolvedMeld[][]): { open: ResolvedMeld[][]; hidden: ResolvedMeld[][] } {
  return {
    open: rows.filter((row) => row.some((m) => m.open)),
    hidden: rows.filter((row) => row.every((m) => !m.open)),
  }
}

function rowsOf(list: ResolvedMeld[][]): Kind[][][] {
  return list.map((row) => row.map((m) => m.tiles))
}

function concealedHand(hand: Hand): boolean {
  return !hand.declared.some((m) => m.type === 'chow' || m.type === 'pung')
}

function hasDeclaredMeld(hand: Hand): boolean {
  return hand.declared.length > 0
}

function allTiles(ctx: Ctx): Kind[] {
  return [...ctx.melds.flatMap((m) => m.tiles), ...ctx.pair]
}

function suitsUsed(tiles: Kind[]): Set<string> {
  const set = new Set<string>()
  for (const tile of tiles) if (numbered(tile)) set.add(suitOf(tile))
  return set
}

function category(kind: Kind): string | null {
  if (numbered(kind)) return suitOf(kind)
  if (!honor(kind)) return null
  return rankOf(kind) <= 4 ? 'w' : 'd'
}

export function scoreHand(hand: Hand, situation: Situation = defaultSituation(), diff?: RuleDiff): ScoreResult[] {
  const rules = diff ? compile(diff) : houseRules()
  const winning = hand.winningTile ? kindOf(hand.winningTile) : null
  const selfDraw = situation.selfDraw
  const waitKinds = winning ? preWaits(hand, winning) : null
  const normal = scoreNormal(hand, situation, rules, winning, selfDraw, waitKinds)
  const specials = hand.declared.length === 0 ? scoreSpecials(hand, situation, rules, winning, selfDraw, waitKinds) : []
  const eight = specials.find((s) => s.shape === 'eight')
  const others = specials.filter((s) => s.shape !== 'eight')
  const results: ScoreResult[] = []
  if (normal && eight) {
    results.push({
      ...normal,
      total: normal.total + eight.total,
      second: { total: eight.total, matches: eight.matches, decomposition: eight.decomposition, shape: 'eight' },
      rulesFingerprint: rules.fingerprint,
      limitedBySearch: normal.limitedBySearch,
    })
  } else if (normal) results.push(normal)
  else if (eight) results.push(eight)
  results.push(...others)
  results.sort((a, b) => b.total - a.total)
  return results.slice(0, 1)
}

function preWaits(hand: Hand, winning: Kind): Kind[] | null {
  const idx = hand.concealed.findIndex((t) => kindOf(t) === winning)
  if (idx < 0) return null
  const concealed = hand.concealed.filter((_, i) => i !== idx)
  const target = inferTarget(concealed.length, hand.declared.length)
  if (concealed.length !== target.checkpoint) return null
  const found = findWaits({ ...hand, concealed, winningTile: null }, { meldsNeeded: target.need })
  return found.waits.filter((w) => w.kind !== 'j').map((w) => w.kind)
}

function scoreNormal(
  hand: Hand,
  sit: Situation,
  rules: EffectiveRules,
  winning: Kind | null,
  selfDraw: boolean,
  waitKinds: Kind[] | null,
): ScoreResult | null {
  const { counts, jokers } = countsOf(hand.concealed)
  const target = inferTarget(hand.concealed.length, hand.declared.length)
  if (counts.reduce((s, c) => s + c, 0) + jokers !== target.need * 3 + 2) return null
  const found = decomposeStandard(counts, jokers, target.need)
  let best: ScoreResult | null = null
  for (const decomp of found.decomps) {
    const melds: ResolvedMeld[] = hand.declared.map((meld) => ({
      type: meld.type === 'chow' ? 'chow' : meld.type === 'pung' ? 'pung' : 'kong',
      tiles: meld.tiles.map(kindOf),
      concealed: meld.concealed,
      open: !meld.concealed,
      declared: true,
      jokerSlots: [],
    }))
    for (const meld of decomp.melds) {
      melds.push({
        type: meld.type,
        tiles: meld.indexes.map(indexKind),
        concealed: true,
        open: false,
        declared: false,
        jokerSlots: meld.jokerAt.slice(),
      })
    }
    const pair = [indexKind(decomp.pairIndex), indexKind(decomp.pairIndex)]
    markWinning(melds, pair, winning, selfDraw)
    const reading = settle(
      collect({ hand, sit, rules, melds, pair, shape: 'normal', winning, selfDraw, waitKinds }),
      rules,
      'normal',
      { melds, pair, pairJokers: decomp.pairJokers, shape: 'normal', jokerStandIns: decomp.jokerStandIns.map(indexKind) },
      found.limited,
    )
    if (!best || reading.total > best.total) best = reading
  }
  return best
}

function scoreSpecials(
  hand: Hand,
  sit: Situation,
  rules: EffectiveRules,
  winning: Kind | null,
  selfDraw: boolean,
  waitKinds: Kind[] | null,
): ScoreResult[] {
  const { counts, jokers } = countsOf(hand.concealed)
  const out: ScoreResult[] = []
  if (isThirteenOrphansComplete(counts, jokers)) {
    const fill = resolveOrphanFill(counts, jokers)
    const reading = fill ? orphanReading(fill.counts, fill.standIns) : orphanReading(counts, [])
    if (reading) {
      markWinning(reading.melds, reading.pair, winning, selfDraw)
      out.push(settle(collect({ hand, sit, rules, melds: reading.melds, pair: reading.pair, shape: 'orphans', winning, selfDraw, waitKinds, resolvedCounts: fill?.counts }), rules, 'orphans', reading, false))
    }
  }
  if (isSixteenUnrelatedComplete(counts, jokers)) {
    const fill = resolveSixteenFill(counts, jokers)
    const info = fill ? { pair: indexKind(fill.pair), ranks: fill.ranks } : sixteenPairAndRanks(counts)
    const source = fill?.counts ?? counts
    if (info) {
      const melds: ResolvedMeld[] = []
      for (let i = 0; i < 34; i++) {
        if (source[i] === 1) {
          melds.push({ type: 'single', tiles: [indexKind(i)], concealed: true, open: false, declared: false, jokerSlots: [] })
        }
      }
      const pairKind = typeof info.pair === 'string' ? info.pair : indexKind(info.pair)
      const decomp: ResolvedDecomposition = {
        melds,
        pair: [pairKind, pairKind],
        pairJokers: 0,
        shape: 'unrelated',
        jokerStandIns: (fill?.standIns ?? []).map(indexKind),
      }
      out.push(settle(collect({ hand, sit, rules, melds, pair: decomp.pair, shape: 'unrelated', winning, selfDraw, waitKinds, resolvedCounts: source }), rules, 'unrelated', decomp, false))
    }
  }
  if (isEightPairsComplete(counts, jokers)) {
    const fill = resolveEightFill(counts, jokers)
    const use = fill?.counts ?? counts
    const groups = eightGroups(use)
    const melds: ResolvedMeld[] = []
    const seen = new Set<string>()
    for (const kind of groups.pairKinds) {
      if (groups.quadKinds.includes(kind)) continue
      if (seen.has(kind)) continue
      seen.add(kind)
      melds.push({ type: 'pung', tiles: [kind, kind], concealed: true, open: false, declared: false, jokerSlots: [] })
    }
    for (const kind of groups.quadKinds) {
      melds.push({ type: 'pung', tiles: [kind, kind, kind, kind], concealed: true, open: false, declared: false, jokerSlots: [] })
    }
    if (groups.triple) {
      melds.push({ type: 'pung', tiles: [groups.triple, groups.triple, groups.triple], concealed: true, open: false, declared: false, jokerSlots: [] })
    }
    const pairKind = groups.triple ?? groups.pairKinds[0]
    const decomp: ResolvedDecomposition = { melds, pair: [pairKind, pairKind], pairJokers: 0, shape: 'eight', jokerStandIns: (fill?.standIns ?? []).map(indexKind) }
    out.push(settle(collect({ hand, sit, rules, melds, pair: decomp.pair, shape: 'eight', winning, selfDraw, waitKinds, resolvedCounts: use }), rules, 'eight', decomp, false))
  }
  return out
}

function orphanReading(counts: number[], standIns: number[] = []): ResolvedDecomposition | null {
  for (let i = 0; i < 34; i++) {
    if (counts[i] < 3) continue
    const next = counts.slice()
    next[i] -= 3
    if (!orphanRest(next)) continue
    const melds: ResolvedMeld[] = [
      { type: 'pung', tiles: [indexKind(i), indexKind(i), indexKind(i)], concealed: true, open: false, declared: false, jokerSlots: [] },
    ]
    let pair = ''
    for (let k = 0; k < 34; k++) {
      if (next[k] === 2) pair = indexKind(k)
      else if (next[k] === 1) {
        melds.push({ type: 'single', tiles: [indexKind(k)], concealed: true, open: false, declared: false, jokerSlots: [] })
      }
    }
    if (!pair) continue
    return { melds, pair: [pair, pair], pairJokers: 0, shape: 'orphans', jokerStandIns: standIns.map(indexKind) }
  }
  // run meld
  for (const base of [0, 9, 18]) {
    for (let s = 0; s <= 6; s++) {
      const slots = [base + s, base + s + 1, base + s + 2]
      if (slots.some((idx) => counts[idx] <= 0)) continue
      const next = counts.slice()
      for (const idx of slots) next[idx] -= 1
      if (!orphanRest(next)) continue
      const melds: ResolvedMeld[] = [
        { type: 'chow', tiles: slots.map(indexKind), concealed: true, open: false, declared: false, jokerSlots: [] },
      ]
      let pair = ''
      for (let k = 0; k < 34; k++) {
        if (next[k] === 2) pair = indexKind(k)
        else if (next[k] === 1) melds.push({ type: 'single', tiles: [indexKind(k)], concealed: true, open: false, declared: false, jokerSlots: [] })
      }
      if (!pair) continue
      return { melds, pair: [pair, pair], pairJokers: 0, shape: 'orphans', jokerStandIns: standIns.map(indexKind) }
    }
  }
  return null
}

function orphanRest(counts: number[]): boolean {
  const orphans = new Set([0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33])
  let extra = 0
  for (const o of orphans) {
    if (counts[o] < 1 || counts[o] > 2) return false
    extra += counts[o] - 1
  }
  for (let i = 0; i < 34; i++) if (!orphans.has(i) && counts[i] > 0) return false
  return extra === 1
}

function collect(ctx: Ctx): Record<string, Hit> {
  const raw: Record<string, Hit> = {}
  const tiles = allTiles(ctx)
  const numberedTiles = tiles.filter(numbered)
  const honorTiles = tiles.filter(honor)
  const suitSet = suitsUsed(tiles)
  const chows = runs(ctx.melds)
  const trips = pungs(ctx.melds)
  const set = (id: string, value: Hit) => {
    raw[id] = value
  }
  set('base', hit(1))
  set('concealed-hand', hit(concealedHand(ctx.hand) ? 1 : 0))
  set('kong', hit(ctx.melds.filter((m) => m.type === 'kong').length, ctx.melds.filter((m) => m.type === 'kong').map((m) => [m.tiles])))

  const flowers = ctx.hand.flowers
  const right = flowers.filter((f) => f.rank === ctx.sit.seatWind).length
  set('no-flowers', hit(flowers.length === 0 ? 1 : 0))
  set('right-flower', hit(right, flowers.filter((f) => f.rank === ctx.sit.seatWind).map((f) => [[kindOf(f)]])))
  set('wrong-flower', hit(flowers.length - right))
  set('no-honor', hit(honorTiles.length === 0 ? 1 : 0))
  set('no-honor-flower', hit(honorTiles.length === 0 && flowers.length === 0 ? 1 : 0))
  set('all-honors', hit(tiles.length > 0 && tiles.every(honor) ? 1 : 0))

  const windMelds = trips.filter((m) => honor(m.tiles[0]) && rankOf(m.tiles[0]) <= 4)
  const dragonMelds = trips.filter((m) => honor(m.tiles[0]) && rankOf(m.tiles[0]) >= 5)
  const windRanks = new Set(windMelds.map((m) => rankOf(m.tiles[0])))
  const pairWind = honor(ctx.pair[0]) && rankOf(ctx.pair[0]) <= 4
  const pairDragon = honor(ctx.pair[0]) && rankOf(ctx.pair[0]) >= 5
  set('wrong-seat', hit([...windRanks].some((r) => r !== ctx.sit.seatWind) ? 1 : 0))
  set('right-seat', hit(windRanks.has(ctx.sit.seatWind) ? 1 : 0))
  set('right-round', hit(windRanks.has(ctx.sit.roundWind) ? 1 : 0))
  const winds = windRanks.size
  set('small-three-winds', hit(winds >= 2 && pairWind && !windRanks.has(rankOf(ctx.pair[0])) && winds + 1 >= 3 ? 1 : 0))
  set('big-three-winds', hit(winds >= 3 ? 1 : 0))
  set('small-four-winds', hit(winds >= 3 && pairWind && !windRanks.has(rankOf(ctx.pair[0])) ? 1 : 0))
  set('big-four-winds', hit(winds === 4 ? 1 : 0))
  const dragonRanks = new Set(dragonMelds.map((m) => rankOf(m.tiles[0])))
  set('dragon', hit(dragonMelds.length, dragonMelds.map((m) => [m.tiles])))
  set('small-dragons', hit(dragonRanks.size === 2 && pairDragon && !dragonRanks.has(rankOf(ctx.pair[0])) ? 1 : 0))
  set('big-dragons', hit(dragonRanks.size === 3 ? 1 : 0))

  const allChows = ctx.shape === 'normal' && ctx.melds.length === 5 && ctx.melds.every((m) => m.type === 'chow')
  const allTrips = ctx.shape === 'normal' && ctx.melds.length === 5 && ctx.melds.every((m) => m.type === 'pung' || m.type === 'kong')
  set('all-runs', hit(allChows ? 1 : 0))
  set('pure-all-runs', hit(allChows && honorTiles.length === 0 && flowers.length === 0 ? 1 : 0))
  set('all-pungs', hit(allTrips ? 1 : 0))
  set('five-concealed-draw', hit(ctx.shape === 'normal' && ctx.melds.length === 5 && ctx.melds.every((m) => m.type === 'pung' && m.concealed) && ctx.selfDraw ? 1 : 0))
  const concealedUnits = ctx.melds.filter((m) => m.type === 'kong' || (m.type === 'pung' && !m.open)).length
  set('two-concealed', hit(concealedUnits >= 2 ? 1 : 0))
  set('three-concealed', hit(concealedUnits >= 3 ? 1 : 0))
  set('four-concealed', hit(concealedUnits >= 4 ? 1 : 0))
  set('five-concealed', hit(concealedUnits >= 5 ? 1 : 0))
  set('five-kongs', hit(ctx.melds.filter((m) => m.type === 'kong').length === 5 ? 1 : 0))

  set('dual-pung', hit(ctx.winning && ctx.pair[0] !== ctx.winning && ctx.melds.some((m) => m.type === 'pung' && m.tiles.length === 3 && !m.declared && m.concealed && m.tiles.includes(ctx.winning as string)) ? 1 : 0))
  set('single-wait', hit(ctx.winning && ctx.waitKinds && ctx.waitKinds.length === 1 ? 1 : 0))
  set('fake-single', fakeSingle(ctx))
  set('visible-triple', visibleTriple(ctx))
  set('visible-exhausted', visibleExhausted(ctx))
  set('self-draw', hit(ctx.selfDraw ? 1 : 0))
  set('concealed-self', hit(ctx.selfDraw && concealedHand(ctx.hand) ? 1 : 0))
  const blockedOpen = hasDeclaredMeld(ctx.hand)
  set('riichi', hit(ctx.sit.riichi === 'riichi' ? 1 : 0))
  set('concealed-riichi', hit(ctx.sit.riichi === 'riichi' && concealedHand(ctx.hand) ? 1 : 0))
  set('heavenly-riichi', hit(ctx.sit.riichi === 'heavenly-riichi' && !blockedOpen ? 1 : 0))
  set('earthly-riichi', hit(ctx.sit.riichi === 'earthly-riichi' && !blockedOpen ? 1 : 0))
  set('ippatsu', hit(ctx.sit.instantWin && ctx.sit.riichi !== 'none' ? 1 : 0))
  set('eat-riichi', hit(ctx.sit.eatRiichi ? 1 : 0))
  set('early-four', hit(ctx.sit.earlyWin === 'four' ? 1 : 0))
  set('early-seven', hit(ctx.sit.earlyWin === 'seven' ? 1 : 0))
  set('early-ten', hit(ctx.sit.earlyWin === 'ten' ? 1 : 0))
  set('double-win', hit(ctx.sit.multiWin === 'double' ? 1 : 0))
  set('triple-win', hit(ctx.sit.multiWin === 'triple' ? 1 : 0))
  set('heaven', hit(ctx.sit.heavenlyWin === 'heaven' && !blockedOpen ? 1 : 0))
  set('earth', hit(ctx.sit.heavenlyWin === 'earth' && !blockedOpen ? 1 : 0))
  set('man', hit(ctx.sit.heavenlyWin === 'man' && !blockedOpen ? 1 : 0))
  set('river', hit(ctx.sit.lastTileWin === 'river-bottom' ? 1 : 0))
  set('sea', hit(ctx.sit.lastTileWin === 'sea-bottom' ? 1 : 0))
  set('sea-one', hit(ctx.sit.lastTileWin === 'sea-bottom' && ctx.selfDraw && ctx.winning === '1t' ? 1 : 0))
  set('flower-draw', hit(ctx.sit.flowerDraw))
  set('kong-draw', hit(ctx.sit.kongDraw))
  set('rob-kong', hit(ctx.sit.robKong))
  set('dealer', hit(ctx.sit.dealerStreak))
  const declaredAll = ctx.shape === 'normal' && ctx.melds.length > 0 && ctx.melds.every((m) => m.declared)
  set('all-claimed', hit(declaredAll && !ctx.selfDraw ? 1 : 0))
  set('all-self', hit(declaredAll && ctx.selfDraw ? 1 : 0))

  if (ctx.shape === 'normal') {
    Object.assign(raw, sequenceHits(ctx))
    Object.assign(raw, chainHits(ctx))
    Object.assign(raw, crossHits(ctx))
    Object.assign(raw, straightHits(chows))
    Object.assign(raw, returnHits(ctx))
  }
  set('mixed-flush', hit(suitSet.size === 1 && honorTiles.length > 0 ? 1 : 0))
  set('pure-flush', hit(suitSet.size === 1 && honorTiles.length === 0 && numberedTiles.length > 0 ? 1 : 0))
  Object.assign(raw, commonHits(ctx, tiles))
  Object.assign(raw, rangeHits(tiles, suitSet))
  set('eye', eyeHit(ctx))
  set('three-treasures', hit(threeTreasures(tiles, suitSet) ? 1 : 0))
  if (ctx.shape === 'orphans') {
    set('orphans', hit(1))
    const quad = orphanQuad(ctx)
    set('four-return-open', hit(quad === 'open' ? 1 : 0))
    set('four-return-hidden', hit(quad === 'hidden' ? 1 : 0))
  }
  if (ctx.shape === 'unrelated') {
    const info = sixteenInfo(ctx)
    set('sixteen', hit(1))
    set('sixteen-fly', hit(ctx.winning && ctx.winning === ctx.pair[0] ? 1 : 0))
    set('sixteen-same', hit(info.same && honor(ctx.pair[0]) ? 1 : 0))
    set('sixteen-dragon', hit(info.cover && honor(ctx.pair[0]) ? 1 : 0))
  }
  if (ctx.shape === 'eight') {
    set('eight', hit(1))
    const counts = ctx.resolvedCounts ?? countsOf(ctx.hand.concealed).counts
    const pre = ctx.winning ? counts.slice() : null
    if (pre && ctx.winning) {
      const idx = kindIndex(ctx.winning)
      if (idx >= 0 && pre[idx] > 0) pre[idx] -= 1
    }
    const fly = pre ? preEightWaitCount(pre) > 2 : false
    set('eight-fly', hit(ctx.winning && fly ? 1 : 0))
    const present = (from: number, to: number) => {
      let n = 0
      for (let i = from; i <= to; i++) if (counts[i] > 0) n += 1
      return n
    }
    set('three-dragon-pairs', hit(present(31, 33) === 3 ? 1 : 0))
    set('three-wind-pairs', hit(present(27, 30) >= 3 ? 1 : 0))
    set('four-wind-pairs', hit(present(27, 30) === 4 ? 1 : 0))
    const quads = eightQuad(ctx, counts)
    set('four-return-open', quads.open)
    set('four-return-hidden', quads.hidden)
    // presence-only suit coverage for eight pairs
    const touched = new Set<string>()
    for (const tile of tiles) {
      const cat = category(tile)
      if (cat) touched.add(cat)
    }
    const five = touched.has('m') && touched.has('t') && touched.has('b') && touched.has('w') && touched.has('d')
    const flower = flowers.some((f) => f.suit === 'f')
    const season = flowers.some((f) => f.suit === 's')
    set('five-small', hit(five ? 1 : 0))
    set('seven-small', hit(five && flower && season ? 1 : 0))
  }
  if (ctx.shape === 'normal') coverage(ctx, tiles, flowers, set)
  chicken(ctx, raw, set)
  return raw
}

function sequenceHits(ctx: Ctx): Record<string, Hit> {
  const by = new Map<string, ResolvedMeld[]>()
  for (const meld of runs(ctx.melds)) {
    const key = runStart(meld)
    if (!key) continue
    const id = `${key.suit}${key.start}`
    by.set(id, [...(by.get(id) ?? []), meld])
  }
  let openPairs = 0
  let hiddenPairs = 0
  const openRows: Kind[][][] = []
  const hiddenRows: Kind[][][] = []
  const multi: Array<{ key: string; n: number; concealed: number; open: number }> = []
  for (const [key, list] of by) {
    const concealed = list.filter((m) => !m.open)
    const open = list.filter((m) => m.open)
    const hidden = Math.floor(concealed.length / 2)
    const rest = concealed.length % 2
    const shown = Math.floor((open.length + rest) / 2)
    hiddenPairs += hidden
    openPairs += shown
    for (let i = 0; i < hidden; i++) hiddenRows.push([concealed[i * 2].tiles, concealed[i * 2 + 1].tiles])
    for (let i = 0; i < shown; i++) openRows.push([list[0].tiles, list[1].tiles])
    multi.push({ key, n: list.length, concealed: concealed.length, open: open.length })
  }
  const three = multi.filter((m) => m.n >= 3)
  const four = multi.filter((m) => m.n >= 4)
  const shapes = multi.filter((m) => m.n >= 2)
  const trueTwin = shapes.length >= 2
  const trueHidden = shapes.filter((m) => m.concealed >= 2).length >= 2
  let smallOpen = 0
  let smallHidden = 0
  if (numbered(ctx.pair[0])) {
    const rank = rankOf(ctx.pair[0])
    const suit = suitOf(ctx.pair[0])
    for (const start of [rank + 1, rank - 3]) {
      const list = by.get(`${suit}${start}`) ?? []
      if (list.length >= 2) {
        if (list.every((m) => !m.open)) smallHidden = 1
        else smallOpen = 1
      }
    }
  }
  return {
    'identical-open': hit(openPairs, openRows),
    'identical-hidden': hit(hiddenPairs, hiddenRows),
    'small-twin-open': hit(smallOpen),
    'small-twin-hidden': hit(smallHidden),
    'true-twin-open': hit(trueTwin && !trueHidden ? 1 : 0),
    'true-twin-hidden': hit(trueHidden ? 1 : 0),
    'three-same-open': hit(three.filter((m) => m.open > 0).length),
    'three-same-hidden': hit(three.filter((m) => m.open === 0).length),
    'four-same-open': hit(four.filter((m) => m.open > 0).length),
    'four-same-hidden': hit(four.filter((m) => m.open === 0).length),
    ...stepHits(by),
  }
}

function stepHits(by: Map<string, ResolvedMeld[]>): Record<string, Hit> {
  const out: Record<string, Hit> = {
    'step-open': NONE,
    'step-hidden': NONE,
    'step2-open': NONE,
    'step2-hidden': NONE,
  }
  for (const suit of ['m', 't', 'b']) {
    for (const gap of [1, 2]) {
      let open = 0
      let hidden = 0
      const openRows: Kind[][][] = []
      const hiddenRows: Kind[][][] = []
      for (let start = 1; start <= 9 - gap * 2; start++) {
        const groups = [0, 1, 2].map((i) => by.get(`${suit}${start + i * gap}`) ?? [])
        const parts = splitOpen(product(groups))
        open += parts.open.length
        hidden += parts.hidden.length
        openRows.push(...rowsOf(parts.open))
        hiddenRows.push(...rowsOf(parts.hidden))
      }
      const id = gap === 1 ? 'step' : 'step2'
      out[`${id}-open`] = hit((out[`${id}-open`]?.count ?? 0) + open, [...(out[`${id}-open`]?.rows ?? []), ...openRows])
      out[`${id}-hidden`] = hit((out[`${id}-hidden`]?.count ?? 0) + hidden, [...(out[`${id}-hidden`]?.rows ?? []), ...hiddenRows])
    }
  }
  return out
}

function chainHits(ctx: Ctx): Record<string, Hit> {
  const result: Record<string, Hit> = {}
  for (const pattern of CATALOG) if (pattern.window || pattern.id === 'chain-double') result[pattern.id] = NONE
  const trips = pungs(ctx.melds).filter((m) => numbered(m.tiles[0]))
  for (const suit of ['m', 't', 'b']) {
    const has = new Set(trips.filter((m) => suitOf(m.tiles[0]) === suit).map((m) => rankOf(m.tiles[0])))
    const pairRank = numbered(ctx.pair[0]) && suitOf(ctx.pair[0]) === suit ? rankOf(ctx.pair[0]) : 0
    const enabled = CATALOG.filter((p) => p.window && ctx.rules.pattern(p.id).value > 0).sort((a, b) => (b.window!.length - a.window!.length) || Number(a.window!.small) - Number(b.window!.small))
    const found: Array<{ id: string; start: number; length: number }> = []
    for (const pattern of enabled) {
      const length = pattern.window!.length
      for (let start = 1; start <= 10 - length; start++) {
        const ranks = Array.from({ length }, (_, i) => start + i)
        const big = ranks.every((r) => has.has(r))
        const pairAt = ranks.filter((r) => r === pairRank).length === 1
        const pungCount = ranks.filter((r) => has.has(r)).length
        const small = pairAt && pungCount === length - 1 && ranks.every((r) => has.has(r) || r === pairRank)
        const ok = pattern.window!.small ? small : big
        if (!ok) continue
        const contained = found.some((f) => f.length > length && f.start <= start && f.start + f.length >= start + length)
        if (contained) continue
        found.push({ id: pattern.id, start, length })
        const prev = result[pattern.id] ?? NONE
        result[pattern.id] = hit(prev.count + 1, prev.rows)
      }
    }
  }
  if (ctx.rules.pattern('chain-double').value > 0) {
    const pairs = (result['chain2']?.count ?? 0)
    if (pairs >= 2) result['chain-double'] = hit(Math.floor(pairs / 2))
  }
  return result
}

function crossHits(ctx: Ctx): Record<string, Hit> {
  const byStart = new Map<number, Map<string, ResolvedMeld[]>>()
  for (const meld of runs(ctx.melds)) {
    const key = runStart(meld)
    if (!key) continue
    if (!byStart.has(key.start)) byStart.set(key.start, new Map())
    const suitMap = byStart.get(key.start)!
    suitMap.set(key.suit, [...(suitMap.get(key.suit) ?? []), meld])
  }
  let meet = 0
  const meetRows: Kind[][][] = []
  let meet3o = 0
  let meet3h = 0
  let meet4o = 0
  let meet4h = 0
  let meet5o = 0
  let meet5h = 0
  const consumed = new Set<number>()
  for (const [start, suitMap] of byStart) {
    const suits = ['m', 't', 'b'].map((s) => suitMap.get(s) ?? [])
    const total = suits.reduce((n, g) => n + g.length, 0)
    const present = suits.filter((g) => g.length > 0).length
    let higher = false
    const anyOpen = suits.some((g) => g.some((m) => m.open))
    if (present === 3 && total >= 5 && (ctx.rules.pattern('meet5-open').value > 0 || ctx.rules.pattern('meet5-hidden').value > 0)) {
      higher = true
      if (anyOpen) meet5o += 1
      else meet5h += 1
    } else if (present === 3 && total >= 4 && (ctx.rules.pattern('meet4-open').value > 0 || ctx.rules.pattern('meet4-hidden').value > 0)) {
      higher = true
      if (anyOpen) meet4o += 1
      else meet4h += 1
    } else if (present === 3 && (ctx.rules.pattern('meet3-open').value > 0 || ctx.rules.pattern('meet3-hidden').value > 0)) {
      higher = true
      if (anyOpen) meet3o += 1
      else meet3h += 1
    }
    if (!higher) {
      for (let a = 0; a < 3; a++) {
        for (let b = a + 1; b < 3; b++) {
          meet += suits[a].length * suits[b].length
          for (const x of suits[a]) for (const y of suits[b]) meetRows.push([x.tiles, y.tiles])
        }
      }
    } else consumed.add(start)
  }
  const disjoint = disjointMeets(byStart)
  const allMeet = ctx.melds.length === 5 && ctx.melds.every((m) => {
    const key = runStart(m)
    if (!key) return false
    const suitMap = byStart.get(key.start)
    if (!suitMap) return false
    return ['m', 't', 'b'].some((s) => s !== key.suit && (suitMap.get(s)?.length ?? 0) > 0)
  })
  const stair = stairHit(runs(ctx.melds))
  const brothers = brotherHits(ctx)
  return {
    meet: hit(meet, meetRows),
    'two-sisters': hit(disjoint >= 2 ? 1 : 0),
    'all-sisters': hit(allMeet ? 1 : 0),
    stairs: hit(stair.stairs ? 1 : 0),
    'five-step': hit(stair.strict ? 1 : 0),
    'meet3-open': hit(meet3o),
    'meet3-hidden': hit(meet3h),
    'meet4-open': hit(meet4o),
    'meet4-hidden': hit(meet4h),
    'meet5-open': hit(meet5o),
    'meet5-hidden': hit(meet5h),
    ...brothers,
    ...colorSteps(runs(ctx.melds)),
  }
}

function disjointMeets(byStart: Map<number, Map<string, ResolvedMeld[]>>): number {
  const pairs: Array<[ResolvedMeld, ResolvedMeld]> = []
  for (const suitMap of byStart.values()) {
    const suits = ['m', 't', 'b']
    for (let a = 0; a < 3; a++) {
      for (let b = a + 1; b < 3; b++) {
        for (const x of suitMap.get(suits[a]) ?? []) for (const y of suitMap.get(suits[b]) ?? []) pairs.push([x, y])
      }
    }
  }
  let best = 0
  for (let i = 0; i < pairs.length; i++) {
    for (let j = i + 1; j < pairs.length; j++) {
      const used = new Set([pairs[i][0], pairs[i][1], pairs[j][0], pairs[j][1]])
      if (used.size === 4) best = 2
    }
  }
  return best
}

function stairHit(list: ResolvedMeld[]): { stairs: boolean; strict: boolean } {
  if (list.length !== 5) return { stairs: false, strict: false }
  const keyed = list.map(runStart).filter((k): k is { suit: string; start: number } => !!k)
  if (keyed.length !== 5) return { stairs: false, strict: false }
  const ordered = keyed.slice().sort((a, b) => a.start - b.start)
  const start = ordered[0].start
  const stairs = ordered.every((k, i) => k.start === start + i)
  if (!stairs) return { stairs: false, strict: false }
  const suits = ordered.map((k) => k.suit)
  const same = suits.every((s) => s === suits[0])
  const rotation = new Set(suits.slice(0, 3)).size === 3 && suits[3] === suits[0] && suits[4] === suits[1]
  return { stairs: true, strict: same || rotation }
}

function brotherHits(ctx: Ctx): Record<string, Hit> {
  const by = new Map<number, Map<string, ResolvedMeld[]>>()
  for (const meld of pungs(ctx.melds)) {
    if (!numbered(meld.tiles[0])) continue
    const rank = rankOf(meld.tiles[0])
    const suit = suitOf(meld.tiles[0])
    if (!by.has(rank)) by.set(rank, new Map())
    by.get(rank)!.set(suit, [...(by.get(rank)!.get(suit) ?? []), meld])
  }
  let bros = 0
  let big = 0
  let small = 0
  const pairRank = numbered(ctx.pair[0]) ? rankOf(ctx.pair[0]) : 0
  const pairSuit = numbered(ctx.pair[0]) ? suitOf(ctx.pair[0]) : ''
  for (const [rank, suitMap] of by) {
    const present = ['m', 't', 'b'].filter((s) => (suitMap.get(s)?.length ?? 0) > 0)
    if (present.length === 3 && ctx.rules.pattern('bros3').value > 0) big += 1
    else if (present.length === 2 && pairRank === rank && !present.includes(pairSuit) && ctx.rules.pattern('bros3s').value > 0) small += 1
    else bros += (present.length * (present.length - 1)) / 2
  }
  const color = colorChains(ctx)
  return { bros2: hit(bros), bros3: hit(big), bros3s: hit(small), ...color }
}

function colorChains(ctx: Ctx): Record<string, Hit> {
  const has = new Map<string, Set<number>>()
  for (const meld of pungs(ctx.melds)) {
    if (!numbered(meld.tiles[0])) continue
    const suit = suitOf(meld.tiles[0])
    if (!has.has(suit)) has.set(suit, new Set())
    has.get(suit)!.add(rankOf(meld.tiles[0]))
  }
  const pair = numbered(ctx.pair[0]) ? { suit: suitOf(ctx.pair[0]), rank: rankOf(ctx.pair[0]) } : null
  let big = 0
  let small = 0
  for (let start = 1; start <= 7; start++) {
    const ranks = [start, start + 1, start + 2]
    const perm = ['m', 't', 'b']
    const assignments = permutations(perm)
    let bigHit = false
    let smallHit = false
    for (const order of assignments) {
      const okBig = ranks.every((r, i) => has.get(order[i])?.has(r))
      if (okBig) bigHit = true
      if (pair && ranks.includes(pair.rank)) {
        const okSmall = ranks.every((r, i) => (r === pair.rank ? order[i] === pair.suit : has.get(order[i])?.has(r)))
        if (okSmall) smallHit = true
      }
    }
    if (bigHit) big += 1
    if (smallHit) small += 1
  }
  return { 'color-chain': hit(big), 'color-chain-s': hit(small) }
}

function permutations(items: string[]): string[][] {
  if (items.length <= 1) return [items]
  const out: string[][] = []
  for (let i = 0; i < items.length; i++) {
    for (const rest of permutations(items.filter((_, j) => j !== i))) out.push([items[i], ...rest])
  }
  return out
}

function colorSteps(list: ResolvedMeld[]): Record<string, Hit> {
  const by = new Map<string, Map<number, ResolvedMeld[]>>()
  for (const meld of list) {
    const key = runStart(meld)
    if (!key) continue
    if (!by.has(key.suit)) by.set(key.suit, new Map())
    const starts = by.get(key.suit)!
    starts.set(key.start, [...(starts.get(key.start) ?? []), meld])
  }
  let open = 0
  let hidden = 0
  for (let start = 1; start <= 7; start++) {
    for (const order of permutations(['m', 't', 'b'])) {
      const groups = order.map((suit, i) => by.get(suit)?.get(start + i) ?? [])
      const parts = splitOpen(product(groups))
      open += parts.open.length
      hidden += parts.hidden.length
    }
  }
  return { 'color-step-open': hit(open), 'color-step-hidden': hit(hidden) }
}

function straightHits(list: ResolvedMeld[]): Record<string, Hit> {
  const by = new Map<string, Map<number, ResolvedMeld[]>>()
  for (const meld of list) {
    const key = runStart(meld)
    if (!key) continue
    if (!by.has(key.suit)) by.set(key.suit, new Map())
    by.get(key.suit)!.set(key.start, [...(by.get(key.suit)!.get(key.start) ?? []), meld])
  }
  const so: ResolvedMeld[][] = []
  const sh: ResolvedMeld[][] = []
  const mo: ResolvedMeld[][] = []
  const mh: ResolvedMeld[][] = []
  let old = 0
  for (const suit of ['m', 't', 'b']) {
    const starts = by.get(suit) ?? new Map()
    const parts = splitOpen(product([starts.get(1) ?? [], starts.get(4) ?? [], starts.get(7) ?? []]))
    so.push(...parts.open)
    sh.push(...parts.hidden)
    if ((starts.get(4) ?? []).length === 0) {
      old += (starts.get(1)?.length ?? 0) * (starts.get(7)?.length ?? 0)
    }
  }
  for (const order of permutations(['m', 't', 'b'])) {
    const groups = [1, 4, 7].map((start, i) => by.get(order[i])?.get(start) ?? [])
    const parts = splitOpen(product(groups))
    mo.push(...parts.open)
    mh.push(...parts.hidden)
  }
  return {
    'straight-open': hit(so.length, rowsOf(so)),
    'straight-hidden': hit(sh.length, rowsOf(sh)),
    'mixed-straight-open': hit(mo.length, rowsOf(mo)),
    'mixed-straight-hidden': hit(mh.length, rowsOf(mh)),
    'old-young-run': hit(old),
    'old-young-pung': hit(0),
  }
}

function returnHits(ctx: Ctx): Record<string, Hit> {
  const out: Record<string, Hit> = {
    'return1-open': NONE,
    'return1-hidden': NONE,
    'return2-open': NONE,
    'return2-hidden': NONE,
    'return4-open': NONE,
    'return4-hidden': NONE,
    'old-young-pung': NONE,
  }
  const trips = pungs(ctx.melds)
  for (const suit of ['m', 't', 'b']) {
    const low = trips.find((m) => suitOf(m.tiles[0]) === suit && rankOf(m.tiles[0]) === 1)
    const high = trips.find((m) => suitOf(m.tiles[0]) === suit && rankOf(m.tiles[0]) === 9)
    if (low && high) out['old-young-pung'] = hit((out['old-young-pung']?.count ?? 0) + 1, [...(out['old-young-pung']?.rows ?? []), [low.tiles, high.tiles]])
  }
  for (let i = 0; i < 27; i++) {
    const kind = indexKind(i)
    const inChow = runs(ctx.melds).filter((m) => m.tiles.includes(kind))
    const pung = pungs(ctx.melds).find((m) => m.tiles[0] === kind && m.type === 'pung')
    if (pung && inChow.length >= 1) {
      const open = pung.open || inChow.some((m) => m.open)
      const id = open ? 'return1-open' : 'return1-hidden'
      out[id] = hit(out[id].count + 1, [...out[id].rows, [pung.tiles, inChow[0].tiles]])
    }
    if (ctx.pair[0] === kind && inChow.length >= 2) {
      const open = inChow.some((m) => m.open)
      const id = open ? 'return2-open' : 'return2-hidden'
      out[id] = hit(1, [[ctx.pair, inChow[0].tiles, inChow[1].tiles]])
    }
    if (inChow.length >= 4) {
      const open = inChow.some((m) => m.open)
      const id = open ? 'return4-open' : 'return4-hidden'
      out[id] = hit(out[id].count + 1, [...out[id].rows, inChow.slice(0, 4).map((m) => m.tiles)])
    }
  }
  return out
}

function commonHits(ctx: Ctx, tiles: Kind[]): Record<string, Hit> {
  const realNonHonor = ctx.melds.filter((m) => m.tiles.every(numbered))
  const honorSomewhere = tiles.some(honor)
  const pairHonor = honor(ctx.pair[0])
  const pairTerminal = terminal(ctx.pair[0]) || pairHonor
  let commonX = 0
  let commonXY = 0
  let commonXYZ = 0
  let allX = 0
  if (realNonHonor.length > 0) {
    for (let x = 1; x <= 9; x++) {
      if (realNonHonor.every((m) => m.tiles.some((t) => rankOf(t) === x)) && (pairHonor || rankOf(ctx.pair[0]) === x)) commonX = 1
    }
    if (pairHonor) {
      for (let x = 1; x <= 9; x++) for (let y = x + 1; y <= 9; y++) {
        if (realNonHonor.every((m) => m.tiles.some((t) => rankOf(t) === x) && m.tiles.some((t) => rankOf(t) === y))) commonXY = 1
        for (let z = y + 1; z <= 9; z++) {
          if (realNonHonor.every((m) => [x, y, z].every((r) => m.tiles.some((t) => rankOf(t) === r)))) commonXYZ = 1
        }
      }
    }
  }
  if (!honorSomewhere && numbered(ctx.pair[0])) {
    for (let x = 1; x <= 9; x++) {
      if (ctx.melds.every((m) => m.tiles.some((t) => rankOf(t) === x)) && rankOf(ctx.pair[0]) === x) allX = 1
    }
  }
  const terminalMeld = (m: ResolvedMeld) => m.tiles.some((t) => terminal(t))
  const mixedTerminal = honorSomewhere && realNonHonor.length > 0 && realNonHonor.every(terminalMeld) && pairTerminal
  const allTerminal = !honorSomewhere && ctx.melds.every(terminalMeld) && terminal(ctx.pair[0]) && realNonHonor.length > 0
  const allPungLike = ctx.shape === 'eight' || (ctx.melds.length > 0 && ctx.melds.every((m) => m.type === 'pung' || m.type === 'kong' || (ctx.shape === 'orphans' && m.type === 'single')))
  const onlyTerminalHonor = tiles.every((t) => terminal(t) || honor(t))
  const hasTerminal = tiles.some(terminal)
  const orphanPung = ctx.shape === 'orphans' && ctx.melds.some((m) => m.type === 'pung')
  const mixedOld = (ctx.shape === 'normal' && allPungLike && ctx.melds.every((m) => m.type === 'pung' || m.type === 'kong') && onlyTerminalHonor && hasTerminal)
    || (ctx.shape === 'eight' && onlyTerminalHonor && hasTerminal)
    || (ctx.shape === 'orphans' && orphanPung)
  const pureOld = (ctx.shape !== 'orphans' && !honorSomewhere && hasTerminal && tiles.every(terminal) && (ctx.shape === 'eight' || ctx.melds.every((m) => m.type === 'pung' || m.type === 'kong')))
  return {
    'common-x': hit(commonX),
    'common-xy': hit(commonXY),
    'common-xyz': hit(commonXYZ),
    'all-common-x': hit(allX),
    'mixed-terminal': hit(mixedTerminal || (ctx.shape === 'orphans' && realNonHonor.every(terminalMeld) && realNonHonor.length > 0) ? 1 : 0),
    'all-terminal': hit(allTerminal ? 1 : 0),
    'mixed-old': hit(mixedOld ? 1 : 0),
    'pure-old': hit(pureOld ? 1 : 0),
  }
}

function rangeHits(tiles: Kind[], suits: Set<string>): Record<string, Hit> {
  const nums = tiles.filter(numbered)
  const honors = tiles.some(honor)
  const ranks = nums.map(rankOf)
  const simples = !honors && nums.length === tiles.length && ranks.every((r) => r >= 2 && r <= 8)
  const noFive = !honors && ranks.every((r) => r !== 5)
  const above = !honors && nums.length === tiles.length && ranks.every((r) => r >= 6)
  const below = !honors && nums.length === tiles.length && ranks.every((r) => r <= 4)
  const two = suits.size === 2 && !honors
  return {
    simples: hit(simples ? 1 : 0),
    'no-five': hit(noFive ? 1 : 0),
    'above-five': hit(above ? 1 : 0),
    'below-five': hit(below ? 1 : 0),
    'two-suits': hit(two ? 1 : 0),
    'five-small': NONE,
    'five-big': NONE,
    'seven-small': NONE,
    'seven-big': NONE,
  }
}

function coverage(ctx: Ctx, tiles: Kind[], flowers: { suit: string }[], set: (id: string, hit: Hit) => void): void {
  const touched = new Set<string>()
  for (const tile of tiles) {
    const cat = category(tile)
    if (cat) touched.add(cat)
  }
  const full = new Set<string>()
  for (const meld of ctx.melds) {
    const cats = new Set(meld.tiles.map(category))
    if (cats.size === 1) {
      const cat = [...cats][0]
      if (cat) full.add(cat)
    }
  }
  const fiveNames = ['m', 't', 'b', 'w', 'd']
  const fiveTouch = fiveNames.every((n) => touched.has(n))
  const fiveFull = fiveNames.every((n) => full.has(n))
  const flower = flowers.some((f) => f.suit === 'f')
  const season = flowers.some((f) => f.suit === 's')
  set('five-big', hit(fiveFull ? 1 : 0))
  set('five-small', hit(fiveTouch && !fiveFull ? 1 : 0))
  set('seven-big', hit(fiveFull && flower && season ? 1 : 0))
  set('seven-small', hit(fiveTouch && !fiveFull && flower && season ? 1 : 0))
}

function eyeHit(ctx: Ctx): Hit {
  if (ctx.shape === 'eight') {
    const counts = ctx.resolvedCounts ?? countsOf(ctx.hand.concealed).counts
    let n = 0
    const rows: Kind[][][] = []
    for (let i = 0; i < 27; i++) {
      const rank = (i % 9) + 1
      if (![2, 5, 8].includes(rank)) continue
      if (counts[i] === 2) {
        n += 1
        rows.push([[indexKind(i), indexKind(i)]])
      } else if (counts[i] === 4) {
        n += 2
        rows.push([[indexKind(i), indexKind(i)], [indexKind(i), indexKind(i)]])
      }
    }
    return hit(n, rows)
  }
  if (!numbered(ctx.pair[0])) return NONE
  const rank = rankOf(ctx.pair[0])
  return hit([2, 5, 8].includes(rank) ? 1 : 0, [[[ctx.pair[0], ctx.pair[1]]]])
}

function threeTreasures(tiles: Kind[], suits: Set<string>): boolean {
  const nums = tiles.filter(numbered)
  const honors = tiles.some(honor)
  const ranks = nums.map(rankOf)
  const noFive = !honors && ranks.every((r) => r !== 5)
  const above = !honors && ranks.every((r) => r >= 6) && nums.length === tiles.length
  const below = !honors && ranks.every((r) => r <= 4) && nums.length === tiles.length
  const simples = !honors && nums.length === tiles.length && ranks.every((r) => r >= 2 && r <= 8)
  const pure = suits.size === 1 && !honors
  const two = suits.size === 2 && !honors
  return (noFive || above || below) && simples && (pure || two)
}

function fakeSingle(ctx: Ctx): Hit {
  if (!ctx.winning) return NONE
  if (ctx.shape === 'eight') {
    const counts = ctx.resolvedCounts ?? countsOf(ctx.hand.concealed).counts
    const idx = kindIndex(ctx.winning)
    const triple = counts.some((c, i) => c === 3 && i !== idx)
    return hit(idx >= 0 && counts[idx] === 4 && triple ? 1 : 0)
  }
  if (ctx.shape === 'orphans') {
    const single = ctx.melds.some((m) => m.type === 'single' && m.tiles[0] === ctx.winning)
    const meld = ctx.melds.some((m) => m.type !== 'single' && m.tiles.includes(ctx.winning as string))
    return hit(single && meld ? 1 : 0)
  }
  if (ctx.pair[0] === ctx.winning) return hit(1)
  for (const meld of ctx.melds) {
    if (meld.declared || meld.type !== 'chow') continue
    const key = runStart(meld)
    if (!key || !meld.tiles.includes(ctx.winning)) continue
    const rank = rankOf(ctx.winning)
    if (rank === key.start + 1) return hit(1)
    if (key.start === 1 && rank === 3) return hit(1)
    if (key.start === 7 && rank === 7) return hit(1)
  }
  return NONE
}

function visibleTriple(ctx: Ctx): Hit {
  if (!ctx.winning || ctx.winning === 'j') return NONE
  const idx = kindIndex(ctx.winning)
  if (idx < 0) return NONE
  let visible = 0
  for (const meld of ctx.hand.declared) {
    if (meld.concealed) continue
    visible += meld.tiles.filter((t) => kindOf(t) === ctx.winning).length
  }
  const elsewhere = ctx.hand.concealed.filter((t) => kindOf(t) === ctx.winning).length > (ctx.hand.winningTile && kindOf(ctx.hand.winningTile) === ctx.winning ? 1 : 0)
  if (visible === 3) return hit(1)
  if (ctx.sit.manualVisibleTriple && !elsewhere) return hit(1)
  return NONE
}

function visibleExhausted(ctx: Ctx): Hit {
  if (!ctx.winning || !ctx.waitKinds || ctx.waitKinds.length < 2) {
    return NONE
  }
  let left = 0
  for (const kind of ctx.waitKinds) {
    const idx = kindIndex(kind)
    if (idx < 0) continue
    let visible = 0
    for (const meld of ctx.hand.declared) {
      if (meld.concealed) continue
      visible += meld.tiles.filter((t) => kindOf(t) === kind).length
    }
    left += Math.max(0, 4 - visible)
  }
  const elsewhere = ctx.hand.concealed.filter((t) => kindOf(t) === ctx.winning).length > 1
  if (left === 1) return hit(1)
  if (ctx.sit.manualVisibleExhausted && !elsewhere) return hit(1)
  return NONE
}

function orphanQuad(ctx: Ctx): 'open' | 'hidden' | null {
  const pung = ctx.melds.find((m) => m.type === 'pung')
  if (!pung) return null
  const kind = pung.tiles[0]
  const single = ctx.melds.some((m) => m.type === 'single' && m.tiles[0] === kind)
  if (!single) return null
  if (ctx.winning === kind && !ctx.selfDraw) return 'open'
  return 'hidden'
}

function eightQuad(ctx: Ctx, counts: number[]): { open: Hit; hidden: Hit } {
  const openRows: Kind[][][] = []
  const hiddenRows: Kind[][][] = []
  for (let i = 0; i < 34; i++) {
    if (counts[i] !== 4) continue
    const tiles = [indexKind(i), indexKind(i), indexKind(i), indexKind(i)]
    if (ctx.winning === indexKind(i) && !ctx.selfDraw) openRows.push([tiles])
    else hiddenRows.push([tiles])
  }
  return { open: hit(openRows.length, openRows), hidden: hit(hiddenRows.length, hiddenRows) }
}

function sixteenInfo(ctx: Ctx): { same: boolean; cover: boolean } {
  const counts = ctx.resolvedCounts ?? countsOf(ctx.hand.concealed).counts
  const info = sixteenPairAndRanks(counts)
  if (!info) return { same: false, cover: false }
  return { same: ranksAreSame(info.ranks), cover: ranksCoverOneToNine(info.ranks) }
}

function chicken(ctx: Ctx, raw: Record<string, Hit>, set: (id: string, value: Hit) => void): void {
  const blocking: string[] = []
  for (const pattern of CATALOG) {
    if (pattern.id === 'chicken' || pattern.id === 'duck') continue
    const count = raw[pattern.id]?.count ?? 0
    if (count <= 0 || !ctx.rules.allows(pattern.id, ctx.shape)) continue
    if (ctx.rules.tai(pattern.id, count) <= 0) continue
    if (!ctx.rules.blocksChicken(pattern.id)) continue
    blocking.push(pattern.id)
  }
  const flowers = ctx.hand.flowers.length
  const duckBlock = blocking.filter((id) => id !== 'self-draw' && id !== 'concealed-self')
  set('chicken', hit(!ctx.selfDraw && flowers <= 1 && blocking.length === 0 ? 1 : 0))
  set('duck', hit(ctx.selfDraw && flowers <= 1 && duckBlock.length === 0 ? 1 : 0))
}

function settle(raw: Record<string, Hit>, rules: EffectiveRules, shape: HandShape, decomposition: ResolvedDecomposition, limited: boolean): ScoreResult {
  const fired = new Set<string>()
  for (const pattern of CATALOG) {
    const count = raw[pattern.id]?.count ?? 0
    if (count <= 0 || !rules.allows(pattern.id, shape)) continue
    if (rules.tai(pattern.id, count) <= 0) continue
    fired.add(pattern.id)
  }
  const drop = new Set<string>()
  for (const id of fired) for (const target of rules.excludes(id)) drop.add(target)
  const matches: PatternMatch[] = []
  for (const pattern of CATALOG) {
    if (!fired.has(pattern.id) || drop.has(pattern.id)) continue
    const count = raw[pattern.id]?.count ?? 0
    const tai = rules.tai(pattern.id, count)
    matches.push({
      id: pattern.id,
      nameZh: pattern.zh,
      nameEn: pattern.en,
      tai,
      count,
      instances: raw[pattern.id]?.rows ?? [],
    })
  }
  const total = matches.reduce((s, m) => s + m.tai, 0)
  return { total, matches, decomposition, shape, rulesFingerprint: rules.fingerprint, limitedBySearch: limited }
}
