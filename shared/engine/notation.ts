import {
  type DeclaredMeld,
  type Hand,
  type Kind,
  type Tile,
  type TileSuit,
  copyCapMessage,
  kindOf,
  validKind,
} from './tiles.ts'

export class NotationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'NotationError'
  }
}

const SUITS = new Set(['m', 't', 'b', 'z', 'f', 's'])

interface Parsed {
  concealed: Tile[]
  declared: DeclaredMeld[]
  flowers: Tile[]
  winning: Tile | null
}

/** Flat tiles in written order. Declared groups are included. Copy-cap and shape are validated. */
export function parseNotation(text: string): Tile[] {
  const parsed = parseParts(text)
  return [...parsed.concealed, ...parsed.declared.flatMap((m) => m.tiles), ...parsed.flowers]
}

export function parseHand(text: string): Hand {
  const parsed = parseParts(text)
  return {
    concealed: parsed.concealed,
    declared: parsed.declared,
    flowers: parsed.flowers,
    winningTile: parsed.winning,
  }
}

export function formatNotation(tiles: Tile[]): string {
  const groups = new Map<string, number[]>()
  let jokers = 0
  const order = ['m', 't', 'b', 'z', 'f', 's']
  for (const suit of order) groups.set(suit, [])
  for (const tile of tiles) {
    if (tile.suit === 'j') {
      jokers += 1
      continue
    }
    const list = groups.get(tile.suit)
    if (!list) throw new NotationError(`Cannot format suit ${tile.suit}`)
    list.push(tile.rank)
  }
  let out = ''
  for (const suit of order) {
    const ranks = groups.get(suit) ?? []
    if (!ranks.length) continue
    ranks.sort((a, b) => a - b)
    out += ranks.join('') + suit
  }
  out += 'j'.repeat(jokers)
  return out
}

export function formatHand(hand: Hand): string {
  const parts: string[] = []
  for (const meld of hand.declared) {
    const body = formatNotation(meld.tiles)
    parts.push(meld.type === 'concealed-kong' ? `[${body}]` : `(${body})`)
  }
  let concealed = formatNotation(hand.concealed)
  if (hand.winningTile) {
    const mark = kindOf(hand.winningTile)
    const idx = concealed.lastIndexOf(mark)
    if (idx >= 0) concealed = `${concealed.slice(0, idx + mark.length)}*${concealed.slice(idx + mark.length)}`
  }
  if (concealed) parts.push(concealed)
  const flowers = formatNotation(hand.flowers)
  if (flowers) parts.push(flowers)
  return parts.join('')
}

function parseParts(text: string): Parsed {
  const src = text.replace(/\s+/g, '')
  const concealed: Tile[] = []
  const declared: DeclaredMeld[] = []
  const flowers: Tile[] = []
  let winning: Tile | null = null
  let i = 0

  const pushTile = (tile: Tile, into: Tile[]) => {
    if (!validKind(kindOf(tile))) throw new NotationError(`Invalid tile ${kindOf(tile)}`)
    into.push(tile)
  }

  while (i < src.length) {
    const ch = src[i]
    if (ch === 'j') {
      let n = 0
      while (src[i] === 'j') {
        n += 1
        i += 1
      }
      for (let k = 0; k < n; k++) concealed.push({ suit: 'j', rank: 0 })
      continue
    }
    if (ch === '(' || ch === '[') {
      const close = ch === '(' ? ')' : ']'
      const end = src.indexOf(close, i + 1)
      if (end < 0) throw new NotationError('Unclosed meld')
      const inner = src.slice(i + 1, end)
      const tiles = readGroup(inner)
      if (ch === '[') {
        if (tiles.length !== 4 || !tiles.every((t) => kindOf(t) === kindOf(tiles[0]))) {
          throw new NotationError('Concealed kong must be four identical tiles')
        }
        declared.push({ type: 'concealed-kong', tiles, concealed: true })
      } else if (tiles.length === 4 && tiles.every((t) => kindOf(t) === kindOf(tiles[0]))) {
        declared.push({ type: 'open-kong', tiles, concealed: false })
      } else if (tiles.length === 3 && tiles.every((t) => kindOf(t) === kindOf(tiles[0]))) {
        declared.push({ type: 'pung', tiles, concealed: false })
      } else if (tiles.length === 3 && isChow(tiles)) {
        declared.push({ type: 'chow', tiles: sortChow(tiles), concealed: false })
      } else {
        throw new NotationError(`Bad declared meld ${inner}`)
      }
      i = end + 1
      continue
    }
    if (ch >= '1' && ch <= '9') {
      const digits: { rank: number; win: boolean }[] = []
      while (i < src.length && src[i] >= '1' && src[i] <= '9') {
        const rank = Number(src[i])
        i += 1
        let win = false
        if (src[i] === '*') {
          win = true
          i += 1
        }
        digits.push({ rank, win })
      }
      const suit = src[i]
      if (!suit || !SUITS.has(suit)) throw new NotationError(`Suit missing after ${digits.map((d) => d.rank).join('')}`)
      i += 1
      if (src[i] === '*') {
        digits[digits.length - 1].win = true
        i += 1
      }
      const dest = suit === 'f' || suit === 's' ? flowers : concealed
      for (const digit of digits) {
        const tile = { suit: suit as TileSuit, rank: digit.rank }
        pushTile(tile, dest)
        if (digit.win) {
          if (winning) throw new NotationError('Only one winning tile')
          winning = tile
        }
      }
      continue
    }
    throw new NotationError(`Unexpected '${ch}'`)
  }

  const cap = copyCapMessage([...concealed, ...declared.flatMap((m) => m.tiles), ...flowers])
  if (cap) throw new NotationError(cap)
  return { concealed, declared, flowers, winning }
}

function readGroup(body: string): Tile[] {
  if (!/^[1-9]+[mtbz]$/.test(body)) {
    throw new NotationError(`Bad meld tiles ${body}`)
  }
  const suit = body.slice(-1) as TileSuit
  const digits = body.slice(0, -1)
  return digits.split('').map((d) => ({ suit, rank: Number(d) }))
}

function isChow(tiles: Tile[]): boolean {
  if (tiles.some((t) => t.suit === 'z' || t.suit === 'j' || t.suit !== tiles[0].suit)) return false
  const ranks = tiles.map((t) => t.rank).sort((a, b) => a - b)
  return ranks[1] === ranks[0] + 1 && ranks[2] === ranks[1] + 1
}

function sortChow(tiles: Tile[]): Tile[] {
  return tiles.slice().sort((a, b) => a.rank - b.rank)
}

export function kindList(tiles: Tile[]): Kind[] {
  return tiles.map(kindOf)
}
