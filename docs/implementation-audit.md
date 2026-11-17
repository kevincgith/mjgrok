# Implementation audit

The numbers below are from the run that produced this file. Do not treat an older sentence in git history as the current result. This build is not claimed production-ready.

## Complete

- 34 tile kinds, 4-copy cap, unlimited jokers, flowers and seasons never concealed.
- Notation with digit-before-suit groups, declared `(meld)` / `[kong]`, winning `*`, canonical formatting.
- Shanten for standard hands, including declared-meld checkpoints and short drill sizes. Worked examples: complete `-1`, pair wait `0`, one-step `1`, two-step `2`.
- Thirteen orphans, sixteen unrelated (including 十六飛, 三相逢, 雜龍), eight pairs (including 八飛, dragon/wind pair bonuses, quad 明/暗).
- Waits at checkpoint sizes with every decomposition. `111222333` returns both the pung reading and the chow reading.
- Joker budget search records a concrete stand-in per joker. Special hands use the same stand-in: `jokers.test.ts` scores eight pairs, thirteen orphans, and sixteen unrelated when a joker fills the missing kind, and a 16-tile eight-pair shape with the joker still needed is shanten 0.
- Discard ranking is explicitly an estimate, drops exhausted kinds, and reports tenpai%, win%, accepting tiles, and a two-step draw list.
- Pattern checks with an exact tai number, a negative hand, or a disabled-rule case live in `patternDepth.test.ts`. Eight-pairs plus a normal reading are both reported and the totals are added. A pattern set to 0 stops suppressing the smaller pattern (`big-dragons` off restores `dragon` at 2×3; `no-honor-flower` off restores `no-flowers` at 2).
- Ledger replay matches the worked 拉 numbers (11 then 20 → worth 26, claim 37) and the 踢 numbers (29 then 20 → worth 35, new claim 20). Self-draw is pairwise. A draw keeps claims. A different winner clears the previous holder's claims. Surrender pays nothing. Jackpot contributions and a taken pot stay zero-sum. Undo is replay without the last event.
- 封頂 is clamped to 0–999 on the settings input. `ledger.test.ts` “pays 反雪…” records a 5000-farn self-draw with limitInput 999 and the winner’s net is still above 5000. Payments are not capped.
- Situation buttons force or clear 自摸, 搶槓, 雙響/三響, 地胡, 食叮, early-vs-last, and heaven/earth/man vs 叮, as specified. 人胡 does not force 自摸.
- Tile art: one SVG per kind. Each viewBox is the white face path of the Wikimedia Commons oblique tile, CC BY-SA 4.0. A contact sheet of all 43 faces (characters, bamboo, dots 1–9, honors, flowers, seasons, joker) shows the suit symbol inside the face. Credits stay in each SVG comment and `src/lib/tileCredits.json`.

## Gaps

- There is no second legacy scorer and there will not be one in this repository. The scoring document described a frozen copy of an older app. That app was not opened. `scoreHand` errors are shown as text on the Scoring page (`Scoring failed` or the thrown message). The page does not replace a thrown total with a blank success state.
- Rules 設定 edits tai values, names the set, stacks the three ladders, exports JSON, imports a JSON file, copies a `#r=` link, and prints the open sheet. It still does not edit exclusion edges, shape toggles, or chicken-block flags, and it does not draw a QR code or a paginated pattern reference.
- Discard ranking runs in `src/workers/discard.worker.ts`. The Waits and Drills pages show the worker’s elapsed milliseconds. The first cold ranking of a 17-tile hand is still about a second of worker time. The UI stays clickable, but the ranking is not instant.
- Endless deals a shuffled 136-tile wall, grades a discard against the worker ranking, and keeps undo, redo, and Cmd/Ctrl-Z. Stats persist in `mjwaits.endless`. It does not yet show a separate “turns to tenpai” average across many hands beyond the current hand’s turn counters.
- The seat tab runs and pauses eight timed steps, moves the six tiles, and can write a `seats` event plus a dealer change into the ledger. The phone’s bottom player stays at the bottom. The travel is a CSS transition of the six labels, not a frame-by-frame dice tumble, and the four walls are still one row of stacks rather than a pinwheel.
- Ledger records 食胡, 流局, 投降, 一炮多響, a 花 bonus, undo/redo, a per-player net line, and a settlement image. It does not yet record every bonus preset, a roster substitution that moves totals with a player, best/worst hand thumbnails, or pattern tallies taken from Scoring.
- The catalog table in `docs/scoring-coverage.md` still lists many ids as present in `scoring.test.ts`. That file asserts tai > 0 or absence inside shared examples. It is not a separate negative, 明/暗, and repeat-count case for every id. The exact cases are named in the coverage preamble.
- Online sharing, camera capture, Play mode, bots, and WebGL are omitted on purpose.
- Drill wait/discard stats are still component state, not localStorage. Scoring “record into the open ledger” is not wired; the ledger is filled from its own sheet.

## Resolutions

- 小三風 is two or more wind pungs whose pair is a wind not already used as a pung. 小四喜 (three pungs plus the missing wind as the pair) excludes it, which matches the worked exclusion tests.
- 假獨 looks at physically concealed chows, including the chow the winning tile just completed. Marking that chow 明 for other patterns does not remove the kanchan/penchan/tanki shape.
- 海底撈月(一筒) requires the winning tile to be 1筒, self-draw, and the sea-bottom flag. It excludes plain 海底撈月.
- Swap-dice "Tiles (floor of 3)" is `floor((die1 + die2) / 3)`. Round is the total wrapped into 1..3. The product of those two numbers is shown.
