# Implementation audit

Checked by running `npx tsc --noEmit`, `npm test` (41 tests, all passed), and `npm run build` (Vite production build succeeded). Discard ranking of one 17-tile hand measured about 0.9s on the first call in Node; later calls in the same process are much faster because shanten keys are cached.

## Complete

- 34 tile kinds, 4-copy cap, unlimited jokers, flowers and seasons never concealed.
- Notation with digit-before-suit groups, declared `(meld)` / `[kong]`, winning `*`, canonical formatting.
- Shanten for standard hands, including declared-meld checkpoints and short drill sizes. Worked examples: complete `-1`, pair wait `0`, one-step `1`, two-step `2`.
- Thirteen orphans, sixteen unrelated (including 十六飛, 三相逢, 雜龍), eight pairs (including 八飛, dragon/wind pair bonuses, quad 明/暗).
- Waits at checkpoint sizes with every decomposition. `111222333` returns both the pung reading and the chow reading.
- Joker budget search records a concrete stand-in per joker per decomposition.
- Discard ranking is explicitly an estimate, drops exhausted kinds, and reports tenpai%, win%, accepting tiles, and a two-step draw list.
- All 146 catalog patterns have a house value and a test mention. Bigger patterns suppress the listed smaller ones. Eight-pairs plus a normal reading are both reported and summed.
- Ledger replay matches the worked 拉 numbers (11 then 20 → worth 26, claim 37) and the 踢 numbers (29 then 20 → worth 35, new claim 20). Self-draw is pairwise. A draw keeps claims. A different winner clears the previous holder's claims. Surrender pays nothing. Jackpot contributions and a taken pot stay zero-sum. Undo is replay without the last event.
- 封頂 is an editable input and is not applied to payments.
- Situation buttons force or clear 自摸, 搶槓, 雙響/三響, 地胡, 食叮, early-vs-last, and heaven/earth/man vs 叮, as specified. 人胡 does not force 自摸.
- Tile art: one SVG per kind, cropped from Wikimedia Commons oblique tiles, CC BY-SA 4.0, Cangjie6 and other authors credited. Character, bamboo, flower, and honor faces read clearly. A few dot tiles are cropped tighter than the rest because their source paths sit in a different part of the oblique drawing.

## Gaps

- There is no second "legacy" scorer. The scoring document described a frozen copy of an older app. This repository is the first implementation, so a duplicate engine would not be an independent check. If `scoreHand` throws, the Scoring page shows no total instead of silently switching engines.
- Rules 設定 edits tai values (0 turns a pattern off), names the set, and can stack the 三元 / 暗刻 / 一色 ladders. The engine also accepts exclusion edits, shape toggles, and chicken-block overrides, but the sheet does not yet expose those controls, QR, import/export files, or the multi-page print reference.
- Special-hand scoring is skipped when the concealed hand contains a joker. Standard decomposition still runs and can score the joker as a concrete tile. A joker thirteen-orphans or sixteen-unrelated hand is therefore not given the special total.
- Discard analysis on a cold 17-tile hand is about a second in this environment. The UI calls it on the Waits and Drills tabs without a worker. A second pass is cached. It can hitch a phone on the first ranking.
- Drills Waits and Discards generate a guaranteed-wait hand, grade it, and store answered/correct/wrong/time. Endless does not yet deal a full wall with undo/redo of wall, stats, and turns. The page says so.
- Dice rolls three dice, highlights the counted stacks, and uses the caption "Break the left wall" when the total selects that wall: counterclockwise from the dealer, `(total - 1) % 4`, with `18 - total` stacks staying. Swap uses round `((sum - 1) % 3) + 1` and tiles `floor(sum / 3)`, and shows the product. The seat tab lists the eight ceremony steps and the counterclockwise count. It does not yet animate full-size tiles through all eight steps or apply the result onto the ledger table.
- Ledger shows the four seats, records 食胡 / 自摸, replays undo and redo, settles the fewest payments, and draws a simple net chart. It does not yet include the full per-player stat grid, head-to-head, best/worst hands, pattern stats from Scoring, or a crosshair on the chart.
- Online sharing, camera capture, Play mode, bots, and WebGL are omitted on purpose.
- Tile faces: character, bamboo, flower, and honor tiles show the suit symbol. Some dot tiles are cropped tighter than the others because those source paths sit lower in the oblique drawing. Invalid `i:` attributes from the Illustrator export were stripped so browsers can render the SVGs.

## Resolutions

- 小三風 is two or more wind pungs whose pair is a wind not already used as a pung. 小四喜 (three pungs plus the missing wind as the pair) excludes it, which matches the worked exclusion tests.
- 假獨 looks at physically concealed chows, including the chow the winning tile just completed. Marking that chow 明 for other patterns does not remove the kanchan/penchan/tanki shape.
- 海底撈月(一筒) requires the winning tile to be 1筒, self-draw, and the sea-bottom flag. It excludes plain 海底撈月.
- Swap-dice "Tiles (floor of 3)" is `floor((die1 + die2) / 3)`. Round is the total wrapped into 1..3. The product of those two numbers is shown.
