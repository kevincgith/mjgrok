# MJWaits

Hong Kong / Taiwan mahjong scoring, waits, and a small trainer. The rules engine in `shared/engine` has no DOM or browser APIs. The React app is entirely client-side.

## Commands

```bash
npm install
npm test
npx tsc -b --pretty false --noEmit
npm run build
npm run dev
```

`npm test` runs Vitest. `npm run build` typechecks and writes `dist/`. The Vite base is `/mjgrok/`, which is the GitHub Pages project path. Dev and preview are served at `http://127.0.0.1:<port>/mjgrok/`. Share links, the manifest, and the service worker use that same path.

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
- 封頂 defaults to 999 and is the largest farn the ledger sheet will accept. Change the number in 設定 to change that input limit. A payment already recorded above the limit is still paid in full. See `clampFarnInput` in `acceptance.test.ts`.
- Recording a scored hand sends `total − 莊 − 雙響/三響`. The ledger adds the dealer bonus from its own streak, and it adds 5 or 10 again when the win is marked 雙響 or 三響. 底 stays inside the sent farn. Leave the ledger base at 0 when the score already includes 底, or the base is paid twice. See `ledgerFarn` in `acceptance.test.ts`.
- Jokers are wildcards with a concrete stand-in. Eight pairs, thirteen orphans, and sixteen unrelated accept one or more jokers in place of missing tiles. See `jokers.test.ts` and `acceptance.test.ts`.
- A pattern whose house value is 0, including 正圈風 and the longer 連刻 tiers, is detected again when that value is set above 0. It does not suppress other patterns while it is 0.
- There is no second scoring engine. The scoring document mentioned a frozen copy of an older app. That app is not in this repository and was not opened. If scoring throws, the page shows the error.

## Credits

Tile faces are cropped from Wikimedia Commons, “SVG Oblique illustrations of Mahjong tiles”, CC BY-SA 4.0, Cangjie6 and other contributors. See Credits in the app and `src/lib/tileCredits.json`.
