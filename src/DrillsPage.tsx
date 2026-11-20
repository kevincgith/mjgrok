import { useEffect, useMemo, useState } from 'react'
import { findWaits, shanten, type Tile } from '@mjwaits/shared'
import { TileFace } from './ui'
import { useDiscards } from './lib/useDiscards'

type Stats = { answered: number; correct: number; wrong: number; ms: number }
type DiscardStats = { answered: number; best: number; regret: number }
interface DrillStore { waits: Record<string, Stats>; discards: Record<string, DiscardStats> }
const DRILL_KEY = 'mjwaits.drills'
const empty = (): Stats => ({ answered: 0, correct: 0, wrong: 0, ms: 0 })
const emptyDiscard = (): DiscardStats => ({ answered: 0, best: 0, regret: 0 })
function loadDrills(): DrillStore {
  try {
    const parsed = JSON.parse(localStorage.getItem(DRILL_KEY) || '') as DrillStore
    return { waits: parsed.waits ?? {}, discards: parsed.discards ?? {} }
  } catch { return { waits: {}, discards: {} } }
}
function waitKey(level: number, flush: boolean) { return `${level}-${flush ? 'flush' : 'suit'}` }

function rng(seed: number) {
  let s = seed || 1
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296 }
}

function deal(level: number, flush: boolean, random = rng(Date.now() % 100000)) {
  const suit = flush ? ['m', 't', 'b'][Math.floor(random() * 3)] : 'm'
  const tiles: Tile[] = []
  for (let i = 0; i < level; i++) {
    const start = 1 + Math.floor(random() * 7)
    tiles.push({ suit: suit as 'm', rank: start }, { suit: suit as 'm', rank: start + 1 }, { suit: suit as 'm', rank: start + 2 })
  }
  const pair = 1 + Math.floor(random() * 9)
  tiles.push({ suit: suit as 'm', rank: pair })
  return { tiles, wait: `${pair}${suit}`, suit }
}

export function DrillsPage() {
  const [tab, setTab] = useState<'waits' | 'discards' | 'endless'>('waits')
  const [level, setLevel] = useState(1)
  const [flush, setFlush] = useState(false)
  const [book, setBook] = useState<DrillStore>(loadDrills)
  const stats = book.waits[waitKey(level, flush)] ?? empty()
  const [puzzle, setPuzzle] = useState(() => deal(1, false))
  const [started, setStarted] = useState(Date.now())
  const [picked, setPicked] = useState<string[]>([])
  const [shown, setShown] = useState(false)
  const answer = useMemo(() => findWaits({ concealed: puzzle.tiles, declared: [], flowers: [] }, { meldsNeeded: level }).waits.map((w) => w.kind), [puzzle, level])
  function grade() {
    const wrong = picked.filter((k) => !answer.includes(k)).length
    const missed = answer.filter((k) => !picked.includes(k)).length
    const ok = wrong === 0 && missed === 0
    const key = waitKey(level, flush)
    setBook({ ...book, waits: { ...book.waits, [key]: { answered: stats.answered + 1, correct: stats.correct + (ok ? 1 : 0), wrong: stats.wrong + (ok ? 0 : 1), ms: stats.ms + (Date.now() - started) } } })
    setShown(true)
  }
  useEffect(() => { localStorage.setItem(DRILL_KEY, JSON.stringify(book)) }, [book])
  return (
    <section>
      <div className="seg">
        <button className={tab === 'waits' ? 'on' : ''} onClick={() => setTab('waits')}>Waits</button>
        <button className={tab === 'discards' ? 'on' : ''} onClick={() => setTab('discards')}>Discards</button>
        <button className={tab === 'endless' ? 'on' : ''} onClick={() => setTab('endless')}>Endless</button>
      </div>
      <div className="card">
        <div className="row">
          {[1, 2, 3, 4, 5].map((n) => <button key={n} className={level === n ? 'on' : ''} onClick={() => { setLevel(n); setPuzzle(deal(n, flush)); setShown(false); setPicked([]) }}>L{n}</button>)}
          <button className={flush ? 'on' : ''} onClick={() => setFlush(!flush)}>Flush</button>
          <button onClick={() => { if (!window.confirm('Clear saved drill stats for every level?')) return; setBook({ waits: {}, discards: {} }); setPuzzle(deal(level, flush)); setShown(false) }}>Reset</button>
        </div>
        <p className="muted">{stats.answered} answered, {stats.correct} correct, {stats.wrong} wrong, {stats.answered ? Math.round(stats.correct / stats.answered * 100) : 0}%, avg {stats.answered ? Math.round(stats.ms / stats.answered / 100) / 10 : 0}s</p>
        {tab === 'waits' && (
          <>
            <div className="tiles">{puzzle.tiles.map((t, i) => <TileFace key={i} kind={`${t.rank}${t.suit}`} />)}</div>
            <div className="tiles">
              {Array.from({ length: 9 }, (_, n) => `${n + 1}${puzzle.suit}`).map((kind) => (
                <TileFace key={kind} kind={kind} className={picked.includes(kind) ? 'win' : ''} onClick={() => setPicked(picked.includes(kind) ? picked.filter((k) => k !== kind) : [...picked, kind])} />
              ))}
            </div>
            {!shown && <button className="primary" onClick={grade}>Submit</button>}
            {shown && (
              <>
                <p>{answer.every((k) => picked.includes(k)) && picked.every((k) => answer.includes(k)) ? 'Hit' : 'Review'}</p>
                <div className="tiles">{answer.map((k) => <TileFace key={k} kind={k} className={picked.includes(k) ? 'win' : ''} />)}</div>
                <button onClick={() => { setPuzzle(deal(level, flush)); setShown(false); setPicked([]); setStarted(Date.now()) }}>Next</button>
              </>
            )}
          </>
        )}
        {tab === 'discards' && <DiscardDrill level={level} book={book} onBook={setBook} />}
        {tab === 'endless' && <Endless />}
      </div>
    </section>
  )
}

function DiscardDrill({ level, book, onBook }: { level: number; book: DrillStore; onBook: (next: DrillStore) => void }) {
  const puzzle = useMemo(() => {
    const dealt = deal(level, false)
    dealt.tiles.push({ suit: 'm', rank: 9 })
    return dealt
  }, [level])
  const hand = useMemo(() => ({ concealed: puzzle.tiles, declared: [], flowers: [] }), [puzzle])
  const ranked = useDiscards(hand, true, level)
  const [choice, setChoice] = useState('')
  const saved = book.discards[String(level)] ?? emptyDiscard()
  const best = ranked.rows[0]?.winPercent ?? 0
  function choose(kind: string) {
    setChoice(kind)
    const row = ranked.rows.find((item) => item.discard === kind)
    if (!row || ranked.pending) return
    const regret = Math.max(0, best - row.winPercent)
    onBook({ ...book, discards: { ...book.discards, [String(level)]: { answered: saved.answered + 1, best: saved.best + (regret === 0 ? 1 : 0), regret: saved.regret + regret } } })
  }
  return (
    <>
      <div className="tiles">{puzzle.tiles.map((t, i) => <TileFace key={i} kind={`${t.rank}${t.suit}`} onClick={() => choose(`${t.rank}${t.suit}`)} />)}</div>
      <p className="muted">Saved L{level}: {saved.answered} tries, {saved.best} best, regret {saved.answered ? Math.round(saved.regret / saved.answered) : 0}. {ranked.pending ? 'Ranking in a worker…' : ranked.elapsedMs ? `Worker ${ranked.elapsedMs} ms` : ''}</p>
      {ranked.error && <p className="bad">{ranked.error}</p>}
      {choice && <p>Choice {choice}. Best win {best}%. {ranked.rows.find((r) => r.discard === choice)?.winPercent === best ? 'Best' : 'Regret'}</p>}
      {ranked.rows.map((r) => <p key={r.discard}>{r.discard} win {r.winPercent}%</p>)}
    </>
  )
}

interface EndlessStats {
  hands: number
  won: number
  loose: number
  regretSum: number
  turns: number
  tenpaiTurns: number
  winTurns: number
}
const ENDLESS_KEY = 'mjwaits.endless'
function loadEndless(): EndlessStats {
  try { return JSON.parse(localStorage.getItem(ENDLESS_KEY) || '') as EndlessStats } catch { return { hands: 0, won: 0, loose: 0, regretSum: 0, turns: 0, tenpaiTurns: 0, winTurns: 0 } }
}
function fullWall(): Tile[] {
  const tiles: Tile[] = []
  for (const suit of ['m', 't', 'b'] as const) for (let rank = 1; rank <= 9; rank++) for (let n = 0; n < 4; n++) tiles.push({ suit, rank })
  for (let rank = 1; rank <= 7; rank++) for (let n = 0; n < 4; n++) tiles.push({ suit: 'z', rank })
  for (let i = tiles.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const tmp = tiles[i]
    tiles[i] = tiles[j]
    tiles[j] = tmp
  }
  return tiles
}
function kindOfTile(tile: Tile) { return `${tile.rank}${tile.suit}` }

function Endless() {
  const [wall, setWall] = useState<Tile[]>(() => fullWall())
  const [hand, setHand] = useState<Tile[]>([])
  const [pile, setPile] = useState<Tile[]>([])
  const [turn, setTurn] = useState(0)
  const [loose, setLoose] = useState(0)
  const [regret, setRegret] = useState(0)
  const [tenpaiTurn, setTenpaiTurn] = useState<number | null>(null)
  const [winTurn, setWinTurn] = useState<number | null>(null)
  const [history, setHistory] = useState<string[]>([])
  const [future, setFuture] = useState<string[]>([])
  const [stats, setStats] = useState<EndlessStats>(loadEndless)
  const [note, setNote] = useState('')
  const live = hand.length ? hand : wall.slice(0, 16)
  const model = useMemo(() => ({ concealed: live, declared: [], flowers: [] }), [live])
  const now = shanten(model)
  const thrown = useMemo(() => {
    const map: Record<string, number> = {}
    for (const tile of pile) map[kindOfTile(tile)] = (map[kindOfTile(tile)] ?? 0) + 1
    return map
  }, [pile])
  const analysis = useDiscards(model, hand.length > 0 && winTurn === null, 5, thrown)
  useEffect(() => { localStorage.setItem(ENDLESS_KEY, JSON.stringify(stats)) }, [stats])
  useEffect(() => {
    if (hand.length) return
    setHand(wall.slice(0, 16))
    setWall(wall.slice(16))
  }, [])
  function snapshot() {
    return JSON.stringify({ wall, hand, pile, turn, loose, regret, tenpaiTurn, winTurn, stats })
  }
  function restore(raw: string) {
    const snap = JSON.parse(raw) as { wall: Tile[]; hand: Tile[]; pile: Tile[]; turn: number; loose: number; regret: number; tenpaiTurn: number | null; winTurn: number | null; stats?: EndlessStats }
    setWall(snap.wall); setHand(snap.hand); setPile(snap.pile); setTurn(snap.turn); setLoose(snap.loose); setRegret(snap.regret); setTenpaiTurn(snap.tenpaiTurn); setWinTurn(snap.winTurn)
    if (snap.stats) setStats(snap.stats)
  }
  function undo() {
    const prev = history[history.length - 1]
    if (!prev) return
    setFuture([snapshot(), ...future])
    setHistory(history.slice(0, -1))
    restore(prev)
  }
  function redo() {
    const next = future[0]
    if (!next) return
    setHistory([...history, snapshot()])
    setFuture(future.slice(1))
    restore(next)
  }
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'z') return
      event.preventDefault()
      if (event.shiftKey) redo()
      else undo()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })
  function discard(index: number) {
    if (winTurn !== null || analysis.pending) return
    const chosen = kindOfTile(hand[index])
    const before = now
    const best = analysis.rows[0]
    const row = analysis.rows.find((item) => item.discard === chosen)
    const nextLoose = row && row.shanten > before ? loose + 1 : loose
    const nextRegret = regret + Math.max(0, (best?.winPercent ?? 0) - (row?.winPercent ?? 0))
    const nextHand = hand.filter((_, i) => i !== index)
    const drawn = wall[0]
    const rest = wall.slice(1)
    const after = drawn ? [...nextHand, drawn] : nextHand
    const afterShanten = shanten({ concealed: after, declared: [], flowers: [] })
    const nextTurn = turn + 1
    setHistory([...history, snapshot()])
    setFuture([])
    setHand(after)
    setWall(rest)
    setPile([...pile, hand[index]])
    setTurn(nextTurn)
    setLoose(nextLoose)
    setRegret(nextRegret)
    if (tenpaiTurn === null && afterShanten <= 0) setTenpaiTurn(nextTurn)
    if (afterShanten < 0) {
      setWinTurn(nextTurn)
      setStats({ ...stats, hands: stats.hands + 1, won: stats.won + 1, loose: stats.loose + nextLoose, regretSum: stats.regretSum + nextRegret, turns: stats.turns + nextTurn, tenpaiTurns: stats.tenpaiTurns + (tenpaiTurn ?? nextTurn), winTurns: stats.winTurns + nextTurn })
      setNote('Win')
    } else setNote(row ? `regret ${Math.max(0, (best?.winPercent ?? 0) - row.winPercent)} points` : 'No ranking yet')
  }
  function fresh() {
    if (turn > 0 && winTurn === null && !window.confirm('Start a new wall? This hand’s progress is cleared.')) return
    const next = fullWall()
    setWall(next.slice(16))
    setHand(next.slice(0, 16))
    setPile([])
    setTurn(0)
    setLoose(0)
    setRegret(0)
    setTenpaiTurn(null)
    setWinTurn(null)
    setHistory([])
    setFuture([])
    setNote('')
    if (turn > 0 && winTurn === null) setStats({ ...stats, hands: stats.hands + 1, loose: stats.loose + loose, regretSum: stats.regretSum + regret, turns: stats.turns + turn })
  }
  return (
    <>
      <p>Turn {turn} · shanten {now} · wall {wall.length} · best {analysis.rows[0]?.winPercent ?? '…'}% · loose {loose} · regret {turn ? Math.round(regret / turn) : 0}</p>
      <p className="muted">Tenpai turn {tenpaiTurn ?? '—'} · win turn {winTurn ?? '—'} · hands won {stats.won}/{stats.hands} · {analysis.pending ? 'Ranking…' : analysis.elapsedMs ? `Worker ${analysis.elapsedMs} ms` : ''}</p>
      {analysis.error && <p className="bad">{analysis.error}</p>}
      <div className="tiles">{hand.map((tile, i) => <TileFace key={`${kindOfTile(tile)}${i}`} kind={kindOfTile(tile)} onClick={() => discard(i)} />)}</div>
      <div className="row">
        <button onClick={undo}>Undo</button>
        <button onClick={redo}>Redo</button>
        <button onClick={fresh}>New wall</button>
        <button onClick={() => { if (!window.confirm('Reset Endless stats and deal a new wall?')) return; localStorage.removeItem(ENDLESS_KEY); setStats({ hands: 0, won: 0, loose: 0, regretSum: 0, turns: 0, tenpaiTurns: 0, winTurns: 0 }); const next = fullWall(); setWall(next.slice(16)); setHand(next.slice(0, 16)); setPile([]); setTurn(0); setLoose(0); setRegret(0); setTenpaiTurn(null); setWinTurn(null); setHistory([]); setFuture([]) }}>Reset</button>
      </div>
      {note && <p>{note}</p>}
      <p className="muted">Tap a tile to discard. Cmd/Ctrl-Z undoes. The worker ranks the hand before the tap is graded.</p>
    </>
  )
}
