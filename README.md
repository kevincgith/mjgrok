# MJWaits

Hong Kong / Taiwan mahjong scoring, waits, and a small trainer. The rules engine in `shared/engine` has no DOM or browser APIs. The React app is entirely client-side.

## Commands

```bash
npm install
npm test
npm run build
npm run dev
```

`npm test` runs Vitest. `npm run build` typechecks and writes `dist/`. Asset URLs are relative, so the same build works at `/` and under `/mjgrok/`.

Regenerate tile faces from Wikimedia Commons (rate-limited; be polite):

```bash
python3 scripts/fetch-tiles.py
```

## Ambiguities

- Shanten `-1` means the hand is already won. `0` means tenpai. Declared melds shrink the concealed checkpoint by 3 tiles each. A hand with no declarations that sits on 4, 7, 10, or 13 tiles is treated as a short puzzle, which is what the drills use.
- Eight pairs and an ordinary 5-meld reading of the same 17 tiles are both scored. The total is the sum.
- 小三風 is two or more wind pungs plus a wind pair that is not already a pung. 小四喜 replaces it when three wind pungs and the missing wind pair are both present.
- 假獨 still recognises a kanchan, penchan, or tanki on a chow that was not declared, even after that chow is marked 明 because the winning tile completed it.
- Swap dice: Round is `((sum - 1) % 3) + 1` (always 1–3). Tiles is `floor(sum / 3)`. The screen shows both and their product.
- Wall break: from the dealer, count players counterclockwise by the dice total (`(total - 1) % 4`). Count that many stacks clockwise along the chosen wall. `18 - total` stacks stay. A total of 12 breaks the left wall and leaves 6.
- Ledger 拉: the first win records a claim equal to the plain payment (base + farn + dealer bonus + 雙響/三響). A repeat pays plain + half the claim, rounding 0.5 up, and the new claim is the old claim plus that worth. 踢 pays the same way, deletes the old claim, and the new claim starts at the plain amount only.
- 封頂 is an input cap of 999. A payment larger than that is still paid in full. See `ledger.test.ts`.
- Jokers are wildcards with a concrete stand-in. Eight pairs, thirteen orphans, and sixteen unrelated accept a joker in place of a missing tile. See `jokers.test.ts`.

## Credits

Tile faces are cropped from Wikimedia Commons, “SVG Oblique illustrations of Mahjong tiles”, CC BY-SA 4.0, Cangjie6 and other contributors. See Credits in the app and `src/lib/tileCredits.json`.
