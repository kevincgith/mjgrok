import { describe, expect, it } from 'vitest'
import { decomposeStandard } from './decompose.ts'
import { formatNotation, parseHand, parseNotation } from './notation.ts'
import { isEightPairsComplete, isSixteenUnrelatedComplete, isThirteenOrphansComplete } from './specials.ts'
import { shanten, shantenOfCounts } from './shanten.ts'
import { kindIndex, type Tile } from './tiles.ts'

function tiles(text: string): Tile[] {
  return parseNotation(text)
}

function counts(text: string): number[] {
  const c = new Array<number>(34).fill(0)
  for (const t of tiles(text)) {
    const idx = kindIndex(`${t.rank}${t.suit}`)
    c[idx] += 1
  }
  return c
}

describe('notation', () => {
  it('parses digit-then-suit groups and formats canonically', () => {
    const parsed = parseNotation('999m11t22b111z')
    expect(parsed).toHaveLength(3 + 2 + 2 + 3)
    expect(formatNotation(parsed)).toBe('999m11t22b111z')
  })

  it('keeps jokers uncapped and rejects a fifth copy', () => {
    expect(parseNotation('jjjjj')).toHaveLength(5)
    expect(() => parseNotation('11111m')).toThrow(/4 copies/)
  })

  it('parses declared melds and a winning tile', () => {
    const hand = parseHand('(123m)(1111z)[2222t]456m789m11t*')
    expect(hand.declared.map((m) => m.type)).toEqual(['chow', 'open-kong', 'concealed-kong'])
    expect(hand.winningTile).toMatchObject({ suit: 't', rank: 1 })
    expect(hand.concealed.map((t) => `${t.rank}${t.suit}`).join('')).toBe('4m5m6m7m8m9m1t1t')
  })

  it('rejects a bad concealed kong and an unknown suit', () => {
    expect(() => parseHand('[123m]')).toThrow(/kong/i)
    expect(() => parseNotation('12x')).toThrow(/Suit/)
  })
})

describe('special complete hands', () => {
  it('recognises eight pairs, thirteen orphans, and sixteen unrelated', () => {
    expect(isEightPairsComplete(counts('1122m3344t5566b77711z'))).toBe(true)
    expect(isEightPairsComplete(counts('1122334455667788m'))).toBe(false)
    expect(isThirteenOrphansComplete(counts('19m19t19b1234567z777z1m'))).toBe(true)
    expect(isSixteenUnrelatedComplete(counts('147m147t147b11234567z'))).toBe(true)
    expect(isSixteenUnrelatedComplete(counts('147m258t369b11234567z'))).toBe(true)
    expect(isSixteenUnrelatedComplete(counts('123m147t147b11234567z'))).toBe(false)
  })
})

describe('shanten', () => {
  it('is -1 for a complete 5-meld hand and 0 for a pair wait', () => {
    expect(shanten(parseHand('123m456m789m123t456t99t'))).toBe(-1)
    expect(shanten(parseHand('123m456m789m123t456t9t'))).toBe(0)
  })

  it('is 0 for a two-sided wait and 1 or 2 for the worked examples', () => {
    expect(shanten(parseHand('123m456m789m123t45t99b'))).toBe(0)
    expect(shanten(parseHand('123m456m789m123t4t99t1b'))).toBe(1)
    expect(shanten(parseHand('123m456m789m123t147b2z'))).toBe(2)
  })

  it('counts a declared meld toward the checkpoint', () => {
    expect(shanten(parseHand('(123m)456m789m123t456t99t'))).toBe(-1)
    expect(shanten(parseHand('(123m)456m789m123t456t9t'))).toBe(0)
  })

  it('treats a just-drawn tile by its best discard', () => {
    expect(shanten(parseHand('123m456m789m123t456t9t1b'))).toBe(0)
    expect(shanten(parseHand('123m456m789m123t456t99t'))).toBe(-1)
  })

  it('scores short puzzle sizes used by drills', () => {
    expect(shanten(parseHand('123m9m'), { meldsNeeded: 1 })).toBe(0)
    expect(shanten(parseHand('123m99m'), { meldsNeeded: 1 })).toBe(-1)
    expect(shanten(parseHand('19m55m'), { meldsNeeded: 1 })).toBe(1)
  })

  it('reaches eight-pairs and thirteen-orphans tenpai', () => {
    expect(shanten(parseHand('1122334455667788m'))).toBe(0)
    expect(shanten(parseHand('1122m3344t5566b77711z'))).toBe(-1)
    expect(shanten(parseHand('19m19t19b1234567z777z'))).toBe(0)
  })
})

describe('decomposition', () => {
  it('finds both the pung reading and the chow reading of 111222333', () => {
    const c = counts('111222333m99t')
    // 9 + 2 = 11 tiles = 3 melds + pair, need 3
    const found = decomposeStandard(c, 0, 3)
    const shapes = found.decomps.map((d) => d.melds.map((m) => m.type).sort().join(','))
    expect(shapes.some((s) => s === 'pung,pung,pung')).toBe(true)
    expect(shapes.some((s) => s === 'chow,chow,chow')).toBe(true)
  })
})

describe('brute-force cross check', () => {
  function bfWin(source: number[], need: number): boolean {
    const c = source.slice()
    const tiles = c.reduce((a, b) => a + b, 0)
    if (tiles !== need * 3 + 2) return false
    const rec = (needM: number, pair: boolean): boolean => {
      let i = 0
      while (i < 34 && c[i] === 0) i += 1
      if (i === 34) return needM === 0 && pair
      if (needM > 0 && c[i] >= 3) {
        c[i] -= 3
        if (rec(needM - 1, pair)) {
          c[i] += 3
          return true
        }
        c[i] += 3
      }
      if (!pair && c[i] >= 2) {
        c[i] -= 2
        if (rec(needM, true)) {
          c[i] += 2
          return true
        }
        c[i] += 2
      }
      const base = i < 9 ? 0 : i < 18 ? 9 : i < 27 ? 18 : -1
      if (needM > 0 && base >= 0 && i - base <= 6 && c[i + 1] > 0 && c[i + 2] > 0) {
        c[i] -= 1
        c[i + 1] -= 1
        c[i + 2] -= 1
        if (rec(needM - 1, pair)) {
          c[i] += 1
          c[i + 1] += 1
          c[i + 2] += 1
          return true
        }
        c[i] += 1
        c[i + 1] += 1
        c[i + 2] += 1
      }
      return false
    }
    return rec(need, false)
  }

  function bfTenpai(source: number[], need: number): boolean {
    const c = source.slice()
    for (let i = 0; i < 34; i++) {
      if (c[i] >= 4) continue
      c[i] += 1
      const win = bfWin(c, need)
      c[i] -= 1
      if (win) return true
    }
    return false
  }

  function mulberry(seed: number) {
    let s = seed >>> 0
    return () => {
      s = (s + 0x6d2b79f5) >>> 0
      let t = Math.imul(s ^ (s >>> 15), 1 | s)
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
  }

  it('matches an independent completer on seeded one-suit hands', () => {
    const rand = mulberry(20261117)
    const need = 2
    const checkpoint = need * 3 + 1
    for (let n = 0; n < 40; n++) {
      const c = new Array<number>(34).fill(0)
      for (let k = 0; k < checkpoint; k++) {
        const idx = Math.floor(rand() * 9)
        if (c[idx] >= 4) {
          k -= 1
          continue
        }
        c[idx] += 1
      }
      const engine = shantenOfCounts(c, 0, need)
      const win = bfWin(
        (() => {
          // winning would be checkpoint+1; compare tenpai flag only
          return c
        })(),
        need,
      )
      expect(win).toBe(false)
      const tenpai = bfTenpai(c, need)
      if (tenpai) expect(engine).toBe(0)
      else expect(engine).toBeGreaterThan(0)
      if (engine === 0) expect(tenpai).toBe(true)
    }
  })
})
