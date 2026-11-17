# Implementation audit

The numbers below are from the run that produced this file. Do not treat an older sentence in git history as the current result. This build is not claimed production-ready.

`npx tsc -b --noEmit` passed. `npm test` passed 353 tests. `npm run build` succeeded.

## Complete

- 34 tile kinds, 4-copy cap, unlimited jokers, flowers and seasons never concealed.
- Notation with digit-before-suit groups, declared `(meld)` / `[kong]`, winning `*`, canonical formatting.
- Shanten for standard hands, including declared-meld checkpoints and short drill sizes. Worked examples: complete `-1`, pair wait `0`, one-step `1`, two-step `2`.
- Thirteen orphans, sixteen unrelated (including 十六飛, 三相逢, 雜龍), eight pairs (including 八飛, dragon/wind pair bonuses, quad 明/暗).
- Waits at checkpoint sizes with every decomposition. `111222333` returns both the pung reading and the chow reading.
- Joker budget search records a concrete stand-in per joker. Special hands use the same stand-in: `jokers.test.ts` scores eight pairs, thirteen orphans, and sixteen unrelated when a joker fills the missing kind, and a 16-tile eight-pair shape with the joker still needed is shanten 0.
- Discard ranking is explicitly an estimate, drops exhausted kinds, and reports tenpai%, win%, accepting tiles, and a two-step draw list.
- `catalogExact.test.ts` names every catalog id. Each paying pattern asserts the exact tai and the instance count on a named hand, lists the patterns that hand must drop, and names a hand where the pattern is absent. Value-0 patterns (`right-round`, the zero 連刻 tiers) assert that they do not pay. `patternDepth.test.ts` still checks disabled-rule suppression: `big-dragons` at 0 restores `dragon` at 2×3.
- Ledger replay matches the worked 拉 numbers (11 then 20 → worth 26, claim 37) and the 踢 numbers (29 then 20 → worth 35, new claim 20). Self-draw is pairwise. A draw keeps claims. A different winner clears the previous holder's claims. Surrender pays nothing. Jackpot contributions and a taken pot stay zero-sum. Undo is replay without the last event.
- 封頂 is clamped to 0–999 on the settings input. `ledger.test.ts` “pays 反雪…” records a 5000-farn self-draw with limitInput 999 and the winner’s net is still above 5000. Payments are not capped.
- Situation buttons force or clear 自摸, 搶槓, 雙響/三響, 地胡, 食叮, early-vs-last, and heaven/earth/man vs 叮, as specified. 人胡 does not force 自摸.
- Tile art: one SVG per kind. Each viewBox is the white face path of the Wikimedia Commons oblique tile, CC BY-SA 4.0. A contact sheet of all 43 faces (characters, bamboo, dots 1–9, honors, flowers, seasons, joker) shows the suit symbol inside the face. Credits stay in each SVG comment and `src/lib/tileCredits.json`.

## Gaps

- There is no second legacy scorer and there will not be one in this repository. The scoring document described a frozen copy of an older app. That app was not opened. `scoreHand` errors are shown as text on the Scoring page (`Scoring failed` or the thrown message). The page does not replace a thrown total with a blank success state.
- Rules 設定 edits values, exclusion edges, the four shape flags, and the chicken block. It exports JSON, imports a file (a clashing name gets a “ 2”), copies a `#r=` link, draws a QR of that link with the `qrcode` package, and prints a reference grouped by family with a page break before each family after the first. The printout does not draw a tile picture beside each pattern. The QR was not scanned with a camera.
- Discard ranking runs in `src/workers/discard.worker.ts`. The Waits and Drills pages show the worker’s elapsed milliseconds. The first cold ranking of a 17-tile hand is still about a second of worker time. The UI stays clickable, but the ranking is not instant.
- Endless deals a shuffled 136-tile wall. Undo and redo restore the wall and the saved stats. New wall asks before clearing an unfinished hand. Reset asks before wiping `mjwaits.endless`.
- Drill waits store answered/correct/wrong/time in `mjwaits.drills` under a key for the level and the flush flag. Discard drills store tries, best picks, and regret for that level.
- The dice page draws four walls of 18 two-high stacks, rotated a few degrees, and gold-marks the counted stacks on the wall `(total - 1) % 4` selects. The seat ceremony writes each player’s wind and rotates the ring so the previous bottom player stays at the bottom. The tile travel is a CSS transition.
- Scoring’s Record button opens the ledger 食胡 sheet. The winner is the player whose stored wind matches 門風, or the seat that many places after the dealer. Farn is the total minus 莊 and minus 雙響/三響. The pattern rows are stored on the win and tallied per player.
- Ledger substitution keeps the outgoing net on that identity and seats the new player at zero. A swap exchanges chairs only. Every bonus preset is an editable amount and can be paid to the selected player. A freeform bonus can be everyone-pays, pays-everyone, or from/to. Stats, pattern counts, history, and the zero-crossed running total are on the ledger. Best and worst hand thumbnails are not drawn.
- Online sharing, camera capture, Play mode, bots, and WebGL are omitted on purpose.
- After the service worker had claimed `http://127.0.0.1:4174/` and cached the shell, stylesheet, script, and tile SVGs, a navigation with Chrome’s network emulation set offline still rendered the MJWaits heading. A reload with `ignoreCache: true` did not; that flag bypasses the worker. Serving `dist/` at `/mjgrok/` returns the HTML with `./assets/...` and the script, stylesheet, and `tiles/t5.svg` respond 200.

## Resolutions

- 小三風 is two or more wind pungs whose pair is a wind not already used as a pung. 小四喜 (three pungs plus the missing wind as the pair) excludes it, which matches the worked exclusion tests.
- 假獨 looks at physically concealed chows, including the chow the winning tile just completed. Marking that chow 明 for other patterns does not remove the kanchan/penchan/tanki shape.
- 海底撈月(一筒) requires the winning tile to be 1筒, self-draw, and the sea-bottom flag. It excludes plain 海底撈月.
- Swap-dice "Tiles (floor of 3)" is `floor((die1 + die2) / 3)`. Round is the total wrapped into 1..3. The product of those two numbers is shown.
