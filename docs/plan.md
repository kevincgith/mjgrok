# MJWaits plan

Built from the attached scoring rules and the product brief only. No other mahjong application was read.

## Folder tree

```
mjgrok/
  index.html
  package.json
  vite.config.ts
  tsconfig.json
  public/
    manifest.webmanifest
    sw.js
    icons/icon.svg icon-192.svg icon-512.svg
    tiles/m1..m9 t1..t9 b1..b9 z1..z7 flower1..4 season1..4 joker.svg
  scripts/fetch-tiles.py
  shared/engine/
    tiles.ts notation.ts shanten.ts specials.ts decompose.ts
    waits.ts jokers.ts discards.ts
    taiCatalog.ts rules.ts scoring.ts ledger.ts
    index.ts
    basics.test.ts scoring.test.ts waits.test.ts ledger.test.ts
  src/
    main.tsx App.tsx styles.css
    ScoringPage.tsx WaitsPage.tsx DrillsPage.tsx LedgerPage.tsx DicePage.tsx
    CreditsPage.tsx RulesSheet.tsx ui.tsx
    lib/situation.ts lib/tileCredits.json
  docs/
    plan.md scoring-rules.md scoring-coverage.md implementation-audit.md
```

## Conventions

- A complete hand is 5 melds + 1 pair = 17 tiles including the winning tile.
- Checkpoint sizes are 1, 4, 7, 10, 13, 16 concealed tiles after each declared meld shrinks the concealed hand by 3.
- Shanten `-1` is a win. Shanten `0` is tenpai. Higher numbers are exchanges still needed.
- With no declared melds, a hand sitting on a smaller checkpoint is scored as a short puzzle (drills). A hand one past a checkpoint is "just drew".
- Specials (十三么, 十六不搭, 嚦咕嚦咕) apply only to a fully concealed 17-tile hand. Eight-pairs and a normal reading are both scored and summed.
- Jokers are a wildcard budget. Each decomposition records a concrete stand-in. They are not expanded by trying all 34 substitutions.
- Discard percentages are estimates over the next self-draws. They are never labelled exact.

## Engine signatures

```ts
parseNotation(text: string): Tile[]
parseHand(text: string): Hand
formatNotation(tiles: Tile[]): string
formatHand(hand: Hand): string
shanten(hand: Hand, opts?: { meldsNeeded?: number }): number
findWaits(hand: Hand, opts?: { meldsNeeded?: number }): WaitResult
analyzeDiscards(hand: Hand, options?: DiscardOptions): DiscardAnalysis[]
scoreHand(hand: Hand, situation?: Situation, diff?: RuleDiff): ScoreResult[]
replayLedger(events: LedgerEvent[]): LedgerState
fewestPayments(nets: Record<string, number>): { from: string; to: string; amount: number }[]
```

`Tile` is `{ suit, rank }`. `Hand` is concealed tiles, declared melds, flowers, and an optional winning tile. `Situation` carries the 情況 flags. `ScoreResult.second` is set when eight-pairs and an ordinary reading are both valid; `total` already includes both. `DiscardAnalysis.estimate` is always true.

## Checklist

- [x] Tile faces cropped from Wikimedia Commons CC BY-SA 4.0
- [x] Notation, shanten, waits, jokers, discards, scoring, ledger
- [x] Tests for every catalog pattern, shanten cross-check, ledger examples
- [x] React UI: Scoring, Waits, Drills, Ledger, Dice, Credits
- [x] PWA manifest, icons, handwritten service worker, relative base
- [ ] Full seat-ceremony animation and full ledger stat grids (see audit)
