/** Tile identity, hand shape, and situation types. No DOM. */

export type Suit = 'm' | 't' | 'b' | 'z'
export type BonusSuit = 'f' | 's'
export type TileSuit = Suit | BonusSuit | 'j'

/** A single tile. Jokers use suit `j` and rank 0. Flowers are `f` 1-4 (梅蘭菊竹), seasons `s` 1-4 (春夏秋冬). */
export interface Tile {
  suit: TileSuit
  rank: number
}

export type Kind = string

export type MeldType = 'chow' | 'pung' | 'open-kong' | 'concealed-kong'

export interface DeclaredMeld {
  type: MeldType
  tiles: Tile[]
  concealed: boolean
}

/** Concealed tiles, declared melds, and bonus tiles. Flowers and seasons are never concealed. */
export interface Hand {
  concealed: Tile[]
  declared: DeclaredMeld[]
  flowers: Tile[]
  /** 食胡 tile, when the hand is complete or the user marked one. */
  winningTile?: Tile | null
}

export type RiichiState = 'none' | 'riichi' | 'heavenly-riichi' | 'earthly-riichi'
export type EarlyWinState = 'none' | 'four' | 'seven' | 'ten'
export type MultiWinState = 'none' | 'double' | 'triple'
export type HeavenlyWinState = 'none' | 'heaven' | 'earth' | 'man'
export type LastTileState = 'none' | 'river-bottom' | 'sea-bottom'
export type HandShape = 'normal' | 'orphans' | 'unrelated' | 'eight'

export interface Situation {
  roundWind: 1 | 2 | 3 | 4
  seatWind: 1 | 2 | 3 | 4
  /** 0 = 莊 not declared. 1 = 莊. 2 = 莊連1. Tai is 2n-1 when n >= 1. */
  dealerStreak: number
  selfDraw: boolean
  riichi: RiichiState
  instantWin: boolean
  eatRiichi: boolean
  earlyWin: EarlyWinState
  multiWin: MultiWinState
  heavenlyWin: HeavenlyWinState
  lastTileWin: LastTileState
  flowerDraw: number
  kongDraw: number
  robKong: number
  /** Manual 明絕. Auto-detect still runs. */
  manualVisibleTriple: boolean
  /** Manual 絕絕. Blocked unless the concealed wait is genuinely multi-way. */
  manualVisibleExhausted: boolean
}

export interface WaitTile {
  kind: Kind
  remaining: number
  /** Every meld/pair reading of the completed hand, including ambiguous ones. */
  decompositions: ResolvedDecomposition[]
}

export interface WaitResult {
  shanten: number
  waits: WaitTile[]
  /** Sum of remaining copies over the 34 kinds. Jokers are not added into this sum. */
  total: number
  /** Every one of the 34 kinds completes the hand. */
  universal: boolean
  jokerWait: boolean
  checkpoint: number
  atCheckpoint: boolean
}

export interface ResolvedMeld {
  type: 'chow' | 'pung' | 'kong' | 'single'
  tiles: Kind[]
  concealed: boolean
  /** 明: declared, or completed by a claimed 食胡 tile. */
  open: boolean
  declared: boolean
  /** Positions in `tiles` filled by a joker, and the concrete stand-in. */
  jokerSlots: number[]
}

export interface ResolvedDecomposition {
  melds: ResolvedMeld[]
  pair: Kind[]
  pairJokers: number
  shape: HandShape
  /** Concrete stand-in for each joker in concealed order. */
  jokerStandIns: Kind[]
}

export interface PatternMatch {
  id: string
  nameZh: string
  nameEn: string
  tai: number
  count: number
  /** One row per instance; each row is the groups (melds/pair) that form it. */
  instances: Kind[][][]
}

export interface ScoreReading {
  total: number
  matches: PatternMatch[]
  decomposition: ResolvedDecomposition
  shape: HandShape
}

export interface ScoreResult extends ScoreReading {
  /** Present when 嚦咕嚦咕 and an ordinary reading are both valid. `total` already sums both. */
  second?: ScoreReading
  rulesFingerprint: string
  limitedBySearch: boolean
}

export const KIND_COUNT = 34
export const SUITS: Suit[] = ['m', 't', 'b', 'z']
export const WIND_NAMES = ['東', '南', '西', '北'] as const
export const DRAGON_NAMES = ['中', '發', '白'] as const
export const FLOWER_NAMES = ['梅', '蘭', '菊', '竹'] as const
export const SEASON_NAMES = ['春', '夏', '秋', '冬'] as const

const SUIT_MAX: Record<string, number> = { m: 9, t: 9, b: 9, z: 7, f: 4, s: 4 }

export function defaultSituation(): Situation {
  return {
    roundWind: 1,
    seatWind: 1,
    dealerStreak: 0,
    selfDraw: false,
    riichi: 'none',
    instantWin: false,
    eatRiichi: false,
    earlyWin: 'none',
    multiWin: 'none',
    heavenlyWin: 'none',
    lastTileWin: 'none',
    flowerDraw: 0,
    kongDraw: 0,
    robKong: 0,
    manualVisibleTriple: false,
    manualVisibleExhausted: false,
  }
}

export function emptyHand(): Hand {
  return { concealed: [], declared: [], flowers: [], winningTile: null }
}

export function kindOf(tile: Tile): Kind {
  if (tile.suit === 'j') return 'j'
  return `${tile.rank}${tile.suit}`
}

export function tileOf(kind: Kind): Tile {
  if (kind === 'j') return { suit: 'j', rank: 0 }
  const suit = kind.slice(-1) as TileSuit
  const rank = Number(kind.slice(0, -1))
  return { suit, rank }
}

export function isJoker(kind: Kind): boolean {
  return kind === 'j'
}

export function isBonus(kind: Kind): boolean {
  return kind.endsWith('f') || kind.endsWith('s')
}

export function isNumbered(kind: Kind): boolean {
  return kind.endsWith('m') || kind.endsWith('t') || kind.endsWith('b')
}

export function isHonor(kind: Kind): boolean {
  return kind.endsWith('z')
}

export function isTerminal(kind: Kind): boolean {
  if (!isNumbered(kind)) return false
  const r = rankOf(kind)
  return r === 1 || r === 9
}

export function isOrphanKind(kind: Kind): boolean {
  return isHonor(kind) || isTerminal(kind)
}

export function suitOf(kind: Kind): TileSuit {
  if (kind === 'j') return 'j'
  return kind.slice(-1) as TileSuit
}

export function rankOf(kind: Kind): number {
  if (kind === 'j') return 0
  return Number(kind.slice(0, -1))
}

/** 0-8 characters, 9-17 dots, 18-26 bamboo, 27-33 honors. */
export function kindIndex(kind: Kind): number {
  if (kind === 'j' || isBonus(kind)) return -1
  const s = suitOf(kind)
  const r = rankOf(kind)
  if (s === 'm') return r - 1
  if (s === 't') return 9 + r - 1
  if (s === 'b') return 18 + r - 1
  return 27 + r - 1
}

export function indexKind(index: number): Kind {
  if (index < 9) return `${index + 1}m`
  if (index < 18) return `${index - 9 + 1}t`
  if (index < 27) return `${index - 18 + 1}b`
  return `${index - 27 + 1}z`
}

export const ORPHAN_INDEXES: number[] = [0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33]

export function validKind(kind: Kind): boolean {
  if (kind === 'j') return true
  const suit = kind.slice(-1)
  const max = SUIT_MAX[suit]
  if (!max) return false
  const rank = Number(kind.slice(0, -1))
  return Number.isInteger(rank) && rank >= 1 && rank <= max && String(rank) + suit === kind
}

export function countsOf(tiles: Tile[]): { counts: number[]; jokers: number } {
  const counts = new Array<number>(KIND_COUNT).fill(0)
  let jokers = 0
  for (const tile of tiles) {
    const kind = kindOf(tile)
    if (kind === 'j') jokers += 1
    else {
      const idx = kindIndex(kind)
      if (idx >= 0) counts[idx] += 1
    }
  }
  return { counts, jokers }
}

export function declaredCounts(hand: Hand): number[] {
  const counts = new Array<number>(KIND_COUNT).fill(0)
  for (const meld of hand.declared) {
    for (const tile of meld.tiles) {
      const idx = kindIndex(kindOf(tile))
      if (idx >= 0) counts[idx] += 1
    }
  }
  return counts
}

/** Visible declared copies, ignoring concealed kongs. */
export function visibleDeclaredCounts(hand: Hand): number[] {
  const counts = new Array<number>(KIND_COUNT).fill(0)
  for (const meld of hand.declared) {
    if (meld.concealed) continue
    for (const tile of meld.tiles) {
      const idx = kindIndex(kindOf(tile))
      if (idx >= 0) counts[idx] += 1
    }
  }
  return counts
}

export function allNormalTiles(hand: Hand): Tile[] {
  const out = hand.concealed.slice()
  for (const meld of hand.declared) out.push(...meld.tiles)
  return out
}

export function kongCount(hand: Hand): number {
  return hand.declared.filter((m) => m.type === 'open-kong' || m.type === 'concealed-kong').length
}

export function hasConcealedKong(hand: Hand): boolean {
  return hand.declared.some((m) => m.type === 'concealed-kong' || (m.concealed && m.type !== 'chow' && m.type !== 'pung'))
}

export function copyCapMessage(tiles: Tile[]): string | null {
  const map = new Map<string, number>()
  for (const tile of tiles) {
    const kind = kindOf(tile)
    if (kind === 'j') continue
    if (isBonus(kind)) {
      map.set(kind, (map.get(kind) ?? 0) + 1)
      if ((map.get(kind) ?? 0) > 1) return `Only one ${kind} bonus tile exists`
      continue
    }
    map.set(kind, (map.get(kind) ?? 0) + 1)
    if ((map.get(kind) ?? 0) > 4) return `More than 4 copies of ${kind}`
  }
  return null
}

/**
 * Checkpoint sizes are 1, 4, 7, 10, 13, 16 after declared melds shrink the concealed hand by 3 each.
 * A complete hand is one tile past the checkpoint (5 melds + pair = 17 with the winning tile).
 *
 * With no declared melds, a hand sitting on a smaller checkpoint (a drill or a short puzzle)
 * is scored against that many melds. A hand one past a checkpoint is "just drew".
 * Anything else in a live 16-tile game aims at 16 concealed tiles and 5 melds.
 */
export function inferTarget(concealedCount: number, declaredCount: number, meldsNeeded?: number): {
  need: number
  checkpoint: number
  winning: number
} {
  if (meldsNeeded != null) {
    const checkpoint = 3 * meldsNeeded + 1
    return { need: meldsNeeded, checkpoint, winning: checkpoint + 1 }
  }
  const gameNeed = 5 - declaredCount
  const gameCp = 3 * gameNeed + 1
  if (declaredCount > 0 || concealedCount >= gameCp) {
    return { need: gameNeed, checkpoint: gameCp, winning: gameCp + 1 }
  }
  const checkpoints = [1, 4, 7, 10, 13, 16]
  if (checkpoints.includes(concealedCount)) {
    const need = (concealedCount - 1) / 3
    return { need, checkpoint: concealedCount, winning: concealedCount + 1 }
  }
  if (checkpoints.includes(concealedCount - 1)) {
    const checkpoint = concealedCount - 1
    const need = (checkpoint - 1) / 3
    return { need, checkpoint, winning: concealedCount }
  }
  return { need: gameNeed, checkpoint: gameCp, winning: gameCp + 1 }
}

export function cloneCounts(counts: number[]): number[] {
  return counts.slice()
}

export function countsKey(counts: number[], jokers = 0): string {
  return `${counts.join('')}:${jokers}`
}

export function tilesOfKind(kind: Kind, n: number): Tile[] {
  return Array.from({ length: n }, () => tileOf(kind))
}

export function sameTile(a: Tile | null | undefined, b: Tile | null | undefined): boolean {
  if (!a || !b) return false
  return kindOf(a) === kindOf(b)
}

export function handTilesForCap(hand: Hand): Tile[] {
  return [...allNormalTiles(hand), ...hand.flowers]
}
