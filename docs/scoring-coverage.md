# Scoring coverage

Detection lives in `shared/engine/scoring.ts`. Values and exclusions live in `shared/engine/taiCatalog.ts`.

## Exact assertions

These tests check a number, a missing pattern, or a repeated instance. A row in the table further down that only names `scoring.test.ts` means that file contains the id and, for most ids, an `expectHas` (tai greater than 0) or `expectLacks` inside a shared example. That is weaker than the cases in this list.

| Test | What it asserts |
|---|---|
| `patternDepth.test.ts` pays pure all-runs | `123m456m789m123t456t99t` has 無字花大平胡 20, 底 5, 門前清 5, and lacks 平胡, 無字, 無花 |
| `patternDepth.test.ts` two concealed straights | `123456789789m123t11t` has 暗清龍 count 2, tai 40, two instances, and lacks 明清龍 |
| `patternDepth.test.ts` pung reading | `111222333444555m99t` keeps 對對胡 40 and lacks 平胡; every meld is a pung |
| `patternDepth.test.ts` identical runs | open `(123m)123m…` is 明般高 5 and not 暗般高; concealed `123123m…` is 暗般高 8 |
| `patternDepth.test.ts` flush negative | `123456789m456m111z99m` has 混一色 40 and lacks 清一色 |
| `patternDepth.test.ts` disabled 大三元 | house hand has 大三元 80 and lacks 三元牌; value 0 on 大三元 restores 三元牌 count 3, tai 6 |
| `patternDepth.test.ts` disabled 無字花 | value 0 on 無字花 and 無字花大平胡 lets 無花 and 無字 score 2 |
| `patternDepth.test.ts` dual eight | `11122334455667788m` has a second reading, 嚦咕嚦咕 at least 50, and a total strictly larger than that reading |
| `patternDepth.test.ts` sea one | winning 1筒 with sea-bottom and 自摸 is 海底撈月(一筒) 20 and lacks 海底撈月 |
| `patternDepth.test.ts` five concealed | without 自摸, 坎坎胡 is absent; with 自摸 it is 160; a kong in place of a pung removes it |
| `jokers.test.ts` eight | `1122m3344t5566b77z11zj` scores 嚦咕嚦咕 and the joker stand-in is 7z |
| `jokers.test.ts` orphans | `1m19t19b1234567z777z1mj` scores 十三么 at least 160 and the stand-in includes 9m |
| `jokers.test.ts` sixteen | `147m147t147b1234567zj` scores 十六不搭 or 十六飛 |
| `basics.test.ts` seeded brute force | 40 one-suit hands, seed 20261117: engine shanten 0/1/>1 matches an independent tenpai check and a one-exchange check |
| `ledger.test.ts` 反雪 and 封頂 | multi-ron by A, a draw, then A self-draws 5000 with limitInput 999; A’s net is above 5000, B and C are negative, zero-sum holds |
| `catalogExact.test.ts` | every catalog id: exact tai and count, listed exclusions absent, and a named hand where a paying pattern is absent |
| `ledger.test.ts` substitution | after A’s self-draw of 10, substituting E leaves A at 30 and E at 0; swapping E and B does not move the nets |

The table below is the catalog index. It is not, by itself, evidence that every pattern has a negative hand and a repeat-count check.

| id | 中文 | English | house value | covered by |
|---|---|---|---|---|
| `base` | 底 | Base | 5 | `shared/engine/scoring.test.ts` |
| `concealed-hand` | 門前清 | Concealed hand | 5 | `shared/engine/scoring.test.ts` |
| `kong` | 槓 | Kong | 2 | `shared/engine/scoring.test.ts` |
| `orphans` | 十三么 | Thirteen orphans | 160 | `shared/engine/scoring.test.ts` |
| `four-return-open` | 明四歸 | Four returned, open | 5 | `shared/engine/scoring.test.ts` |
| `four-return-hidden` | 暗四歸 | Four returned, concealed | 15 | `shared/engine/scoring.test.ts` |
| `sixteen` | 十六不搭 | Sixteen unrelated | 50 | `shared/engine/scoring.test.ts` |
| `sixteen-fly` | 十六不搭(十六飛) | Sixteen-way wait | 60 | `shared/engine/scoring.test.ts` |
| `sixteen-same` | 不搭三相逢 | Unrelated same ranks | 20 | `shared/engine/scoring.test.ts` |
| `sixteen-dragon` | 不搭雜龍 | Unrelated mixed straight | 20 | `shared/engine/scoring.test.ts` |
| `eight` | 嚦咕嚦咕 | Eight pairs | 50 | `shared/engine/scoring.test.ts` |
| `eight-fly` | 嚦咕嚦咕八飛 | Eight-pair multi-wait | 60 | `shared/engine/scoring.test.ts` |
| `three-dragon-pairs` | 三元嚦咕 | Three dragon pairs | 20 | `shared/engine/scoring.test.ts` |
| `three-wind-pairs` | 三風嚦咕 | Three wind pairs | 15 | `shared/engine/scoring.test.ts` |
| `four-wind-pairs` | 四喜嚦咕 | Four wind pairs | 60 | `shared/engine/scoring.test.ts` |
| `no-flowers` | 無花 | No flowers | 2 | `shared/engine/scoring.test.ts` |
| `right-flower` | 正花 | Correct flower | 2 | `shared/engine/scoring.test.ts` |
| `wrong-flower` | 爛花 | Wrong flower | 2 | `shared/engine/scoring.test.ts` |
| `no-honor-flower` | 無字花 | No honors, no flowers | 10 | `shared/engine/scoring.test.ts` |
| `no-honor` | 無字 | No honors | 2 | `shared/engine/scoring.test.ts` |
| `all-honors` | 字一色 | All honors | 160 | `shared/engine/scoring.test.ts` |
| `wrong-seat` | 爛位風 | Wrong seat wind | 2 | `shared/engine/scoring.test.ts` |
| `right-seat` | 正位風 | Right seat wind | 2 | `shared/engine/scoring.test.ts` |
| `right-round` | 正圈風 | Right round wind | 0 | `shared/engine/scoring.test.ts` |
| `small-three-winds` | 小三風 | Small three winds | 30 | `shared/engine/scoring.test.ts` |
| `big-three-winds` | 大三風 | Big three winds | 60 | `shared/engine/scoring.test.ts` |
| `small-four-winds` | 小四喜 | Small four winds | 120 | `shared/engine/scoring.test.ts` |
| `big-four-winds` | 大四喜 | Big four winds | 160 | `shared/engine/scoring.test.ts` |
| `dragon` | 三元牌 | Dragon pung | 2 | `shared/engine/scoring.test.ts` |
| `small-dragons` | 小三元 | Small three dragons | 40 | `shared/engine/scoring.test.ts` |
| `big-dragons` | 大三元 | Big three dragons | 80 | `shared/engine/scoring.test.ts` |
| `all-runs` | 平胡 | All runs | 5 | `shared/engine/scoring.test.ts` |
| `pure-all-runs` | 無字花大平胡 | Pure all runs | 20 | `shared/engine/scoring.test.ts` |
| `all-pungs` | 對對胡 | All pungs | 40 | `shared/engine/scoring.test.ts` |
| `five-concealed-draw` | 坎坎胡 | Five concealed pungs, self-draw | 160 | `shared/engine/scoring.test.ts` |
| `two-concealed` | 兩暗刻 | Two concealed pungs | 5 | `shared/engine/scoring.test.ts` |
| `three-concealed` | 三暗刻 | Three concealed pungs | 15 | `shared/engine/scoring.test.ts` |
| `four-concealed` | 四暗刻 | Four concealed pungs | 30 | `shared/engine/scoring.test.ts` |
| `five-concealed` | 五暗刻 | Five concealed pungs | 80 | `shared/engine/scoring.test.ts` |
| `five-kongs` | 五槓子 | Five kongs | 240 | `shared/engine/scoring.test.ts` |
| `dual-pung` | 對碰 | Dual pair wait | 2 | `shared/engine/scoring.test.ts` |
| `single-wait` | 獨獨 | Single wait | 2 | `shared/engine/scoring.test.ts` |
| `fake-single` | 假獨 | Fake single wait | 2 | `shared/engine/scoring.test.ts` |
| `visible-triple` | 明絕 | Last visible copy | 5 | `shared/engine/scoring.test.ts` |
| `visible-exhausted` | 絕絕 | Exhausted multi-wait | 10 | `shared/engine/scoring.test.ts` |
| `self-draw` | 自摸 | Self-draw | 1 | `shared/engine/scoring.test.ts` |
| `concealed-self` | 門清自摸 | Concealed self-draw | 3 | `shared/engine/scoring.test.ts` |
| `riichi` | 叮 | Riichi | 5 | `shared/engine/scoring.test.ts` |
| `concealed-riichi` | 門清叮 | Concealed riichi | 10 | `shared/engine/scoring.test.ts` |
| `heavenly-riichi` | 天叮 | Heavenly riichi | 60 | `shared/engine/scoring.test.ts` |
| `earthly-riichi` | 地叮 | Earthly riichi | 50 | `shared/engine/scoring.test.ts` |
| `ippatsu` | 一發 | One-shot | 5 | `shared/engine/scoring.test.ts` |
| `eat-riichi` | 食叮 | Eat a riichi | 5 | `shared/engine/scoring.test.ts` |
| `early-four` | 四子內 | Within four discards | 60 | `shared/engine/scoring.test.ts` |
| `early-seven` | 七子內 | Within seven discards | 30 | `shared/engine/scoring.test.ts` |
| `early-ten` | 十子內 | Within ten discards | 15 | `shared/engine/scoring.test.ts` |
| `double-win` | 雙響 | Double win | 5 | `shared/engine/scoring.test.ts` |
| `triple-win` | 三響 | Triple win | 10 | `shared/engine/scoring.test.ts` |
| `heaven` | 天胡 | Heavenly hand | 160 | `shared/engine/scoring.test.ts` |
| `earth` | 地胡 | Earth hand | 120 | `shared/engine/scoring.test.ts` |
| `man` | 人胡 | Human hand | 80 | `shared/engine/scoring.test.ts` |
| `river` | 河底撈魚 | Win on the last discard | 5 | `shared/engine/scoring.test.ts` |
| `sea` | 海底撈月 | Win on the last wall tile | 10 | `shared/engine/scoring.test.ts` |
| `sea-one` | 海底撈月(一筒) | Last tile is 1 dot | 20 | `shared/engine/scoring.test.ts` |
| `flower-draw` | 花摸 | Flower replacement | 2 | `shared/engine/scoring.test.ts` |
| `kong-draw` | 槓摸 | Kong replacement | table [0,5,25,125,250,250] | `shared/engine/scoring.test.ts` |
| `rob-kong` | 搶槓 | Robbing a kong | table [0,5,25,125,250,250] | `shared/engine/scoring.test.ts` |
| `dealer` | 莊 | Dealer streak | streak 1+2 each | `shared/engine/scoring.test.ts` |
| `all-claimed` | 全求人 | All melds claimed | 30 | `shared/engine/scoring.test.ts` |
| `all-self` | 半求人 | All melds, self-draw | 15 | `shared/engine/scoring.test.ts` |
| `chicken` | 大雞 | Chicken hand | 30 | `shared/engine/scoring.test.ts` |
| `duck` | 大鴨 | Duck hand | 15 | `shared/engine/scoring.test.ts` |
| `return1-open` | 明四歸一 | Pung and run, open | 5 | `shared/engine/scoring.test.ts` |
| `return1-hidden` | 暗四歸一 | Pung and run, concealed | 15 | `shared/engine/scoring.test.ts` |
| `return2-open` | 明四歸二 | Pair and two runs, open | 15 | `shared/engine/scoring.test.ts` |
| `return2-hidden` | 暗四歸二 | Pair and two runs, concealed | 30 | `shared/engine/scoring.test.ts` |
| `return4-open` | 明四歸四 | Four runs, open | 30 | `shared/engine/scoring.test.ts` |
| `return4-hidden` | 暗四歸四 | Four runs, concealed | 60 | `shared/engine/scoring.test.ts` |
| `identical-open` | 明般高 | Identical runs, open | 5 | `shared/engine/scoring.test.ts` |
| `identical-hidden` | 暗般高 | Identical runs, concealed | 8 | `shared/engine/scoring.test.ts` |
| `small-twin-open` | 明小雙般高 | Twin runs with end pair, open | 10 | `shared/engine/scoring.test.ts` |
| `small-twin-hidden` | 暗小雙般高 | Twin runs with end pair, concealed | 15 | `shared/engine/scoring.test.ts` |
| `true-twin-open` | 明真雙般高 | Two identical pairs, open | 20 | `shared/engine/scoring.test.ts` |
| `true-twin-hidden` | 暗真雙般高 | Two identical pairs, concealed | 40 | `shared/engine/scoring.test.ts` |
| `three-same-open` | 明一色三同順 | Three identical runs, open | 30 | `shared/engine/scoring.test.ts` |
| `three-same-hidden` | 暗一色三同順 | Three identical runs, concealed | 60 | `shared/engine/scoring.test.ts` |
| `four-same-open` | 明一色四同順 | Four identical runs, open | 80 | `shared/engine/scoring.test.ts` |
| `four-same-hidden` | 暗一色四同順 | Four identical runs, concealed | 160 | `shared/engine/scoring.test.ts` |
| `step-open` | 明單色步步高 | Stepped runs, open | 15 | `shared/engine/scoring.test.ts` |
| `step-hidden` | 暗單色步步高 | Stepped runs, concealed | 30 | `shared/engine/scoring.test.ts` |
| `step2-open` | 明單色二步高 | Skip-stepped runs, open | 8 | `shared/engine/scoring.test.ts` |
| `step2-hidden` | 暗單色二步高 | Skip-stepped runs, concealed | 15 | `shared/engine/scoring.test.ts` |
| `chain2` | 二連刻 | Two linked pungs | 5 | `shared/engine/scoring.test.ts` |
| `chain3s` | 小三連刻 | Small three linked | 15 | `shared/engine/scoring.test.ts` |
| `chain3` | 大三連刻 | Big three linked | 30 | `shared/engine/scoring.test.ts` |
| `chain4s` | 小四連刻 | Small four linked | 0 | `shared/engine/scoring.test.ts` |
| `chain4` | 大四連刻 | Big four linked | 0 | `shared/engine/scoring.test.ts` |
| `chain5s` | 小五連刻 | Small five linked | 0 | `shared/engine/scoring.test.ts` |
| `chain5` | 大五連刻 | Big five linked | 0 | `shared/engine/scoring.test.ts` |
| `chain6s` | 小六連刻 | Small six linked | 0 | `shared/engine/scoring.test.ts` |
| `chain-double` | 雙連刻 | Two separate pairs of linked pungs | 0 | `shared/engine/scoring.test.ts` |
| `meet` | 相逢 | Same run, two suits | 3 | `shared/engine/scoring.test.ts` |
| `two-sisters` | 雙姊妹 | Two separate meetings | 5 | `shared/engine/scoring.test.ts` |
| `all-sisters` | 全姊妹 | Every meld meets | 20 | `shared/engine/scoring.test.ts` |
| `stairs` | 樓梯 | Five-step stair | 20 | `shared/engine/scoring.test.ts` |
| `five-step` | 五步高 | Strict stair | 40 | `shared/engine/scoring.test.ts` |
| `meet3-open` | 明三相逢 | Same run in three suits, open | 10 | `shared/engine/scoring.test.ts` |
| `meet3-hidden` | 暗三相逢 | Same run in three suits, concealed | 20 | `shared/engine/scoring.test.ts` |
| `meet4-open` | 明四相逢 | Four-run meeting, open | 40 | `shared/engine/scoring.test.ts` |
| `meet4-hidden` | 暗四相逢 | Four-run meeting, concealed | 80 | `shared/engine/scoring.test.ts` |
| `meet5-open` | 明五相逢 | Five-run meeting, open | 80 | `shared/engine/scoring.test.ts` |
| `meet5-hidden` | 暗五相逢 | Five-run meeting, concealed | 160 | `shared/engine/scoring.test.ts` |
| `bros2` | 兩兄弟 | Same pung, two suits | 5 | `shared/engine/scoring.test.ts` |
| `bros3s` | 小三兄弟 | Small three brothers | 20 | `shared/engine/scoring.test.ts` |
| `bros3` | 大三兄弟 | Big three brothers | 40 | `shared/engine/scoring.test.ts` |
| `color-chain-s` | 小三色連刻 | Small three-suit chain | 10 | `shared/engine/scoring.test.ts` |
| `color-chain` | 大三色連刻 | Big three-suit chain | 20 | `shared/engine/scoring.test.ts` |
| `color-step-open` | 明三色步步高 | Three-suit steps, open | 5 | `shared/engine/scoring.test.ts` |
| `color-step-hidden` | 暗三色步步高 | Three-suit steps, concealed | 10 | `shared/engine/scoring.test.ts` |
| `mixed-flush` | 混一色 | Mixed flush | 40 | `shared/engine/scoring.test.ts` |
| `pure-flush` | 清一色 | Pure flush | 120 | `shared/engine/scoring.test.ts` |
| `straight-open` | 明清龍 | Pure straight, open | 10 | `shared/engine/scoring.test.ts` |
| `straight-hidden` | 暗清龍 | Pure straight, concealed | 20 | `shared/engine/scoring.test.ts` |
| `mixed-straight-open` | 明雜龍 | Mixed straight, open | 8 | `shared/engine/scoring.test.ts` |
| `mixed-straight-hidden` | 暗雜龍 | Mixed straight, concealed | 15 | `shared/engine/scoring.test.ts` |
| `old-young-run` | 老少上 | Terminal runs | 3 | `shared/engine/scoring.test.ts` |
| `old-young-pung` | 老少碰 | Terminal pungs | 5 | `shared/engine/scoring.test.ts` |
| `common-x` | 混帶X | Common rank | 30 | `shared/engine/scoring.test.ts` |
| `common-xy` | 混帶XY | Two common ranks | 50 | `shared/engine/scoring.test.ts` |
| `common-xyz` | 混帶XYZ | Three common ranks | 60 | `shared/engine/scoring.test.ts` |
| `all-common-x` | 全帶X | Common rank, no honors | 120 | `shared/engine/scoring.test.ts` |
| `mixed-terminal` | 混帶么 | Mixed terminals | 40 | `shared/engine/scoring.test.ts` |
| `all-terminal` | 全帶么 | All terminals | 80 | `shared/engine/scoring.test.ts` |
| `mixed-old` | 混老頭 | Mixed terminal pungs | 100 | `shared/engine/scoring.test.ts` |
| `pure-old` | 清老頭 | Pure terminal pungs | 200 | `shared/engine/scoring.test.ts` |
| `two-suits` | 缺一門 | Two suits | 10 | `shared/engine/scoring.test.ts` |
| `five-small` | 小五門齊 | Small five suits | 10 | `shared/engine/scoring.test.ts` |
| `five-big` | 大五門齊 | Big five suits | 15 | `shared/engine/scoring.test.ts` |
| `seven-small` | 小七門齊 | Small seven suits | 15 | `shared/engine/scoring.test.ts` |
| `seven-big` | 大七門齊 | Big seven suits | 20 | `shared/engine/scoring.test.ts` |
| `simples` | 斷么 | All simples | 10 | `shared/engine/scoring.test.ts` |
| `no-five` | 缺五 | No fives | 10 | `shared/engine/scoring.test.ts` |
| `above-five` | 大於五 | Above five | 40 | `shared/engine/scoring.test.ts` |
| `below-five` | 小於五 | Below five | 40 | `shared/engine/scoring.test.ts` |
| `eye` | 將眼 | 2-5-8 pair | 2 | `shared/engine/scoring.test.ts` |
| `three-treasures` | 三寶 | Three treasures | 40 | `shared/engine/scoring.test.ts` |

Also covered outside this table:

- Notation, copy cap, shanten (-1/0/1/2), declared-meld checkpoint, eight-pairs and thirteen-orphans tenpai, ambiguous pung/chow decomposition, and a seeded independent tenpai cross-check: `shared/engine/basics.test.ts`.
- Waits, both decompositions, discard estimate, exhausted tiles: `shared/engine/waits.test.ts`.
- Ledger 拉/踢 numbers, self-draw, draw, claim clearing, surrender, jackpot zero-sum, round labels, undo replay, settlement: `shared/engine/ledger.test.ts`.
