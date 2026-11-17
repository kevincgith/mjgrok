import { useMemo, useState } from 'react'
import { analyzeDiscards, findWaits, shanten, type Tile } from '@mjwaits/shared'
import { TileFace } from './ui'

type Stats = { answered: number; correct: number; wrong: number; ms: number }
const empty = (): Stats => ({ answered: 0, correct: 0, wrong: 0, ms: 0 })

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
  const [stats, setStats] = useState<Stats>(empty())
  const [puzzle, setPuzzle] = useState(() => deal(1, false))
  const [started, setStarted] = useState(Date.now())
  const [picked, setPicked] = useState<string[]>([])
  const [shown, setShown] = useState(false)
  const answer = useMemo(() => findWaits({ concealed: puzzle.tiles, declared: [], flowers: [] }, { meldsNeeded: level }).waits.map((w) => w.kind), [puzzle, level])
  function grade() {
    const wrong = picked.filter((k) => !answer.includes(k)).length
    const missed = answer.filter((k) => !picked.includes(k)).length
    const ok = wrong === 0 && missed === 0
    setStats({ ...stats, answered: stats.answered + 1, correct: stats.correct + (ok ? 1 : 0), wrong: stats.wrong + (ok ? 0 : 1), ms: stats.ms + (Date.now() - started) })
    setShown(true)
  }
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
          <button onClick={() => { setStats(empty()); setPuzzle(deal(level, flush)); setShown(false) }}>Reset</button>
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
        {tab === 'discards' && <DiscardDrill level={level} />}
        {tab === 'endless' && <p className="muted">Shanten now {shanten({ concealed: puzzle.tiles, declared: [], flowers: [] }, { meldsNeeded: level })}. Endless keeps a full wall in the Dice and Ledger sessions; use Waits discard ranking for the same grader.</p>}
      </div>
    </section>
  )
}

function DiscardDrill({ level }: { level: number }) {
  const puzzle = useMemo(() => {
    const dealt = deal(level, false)
    dealt.tiles.push({ suit: 'm', rank: 9 })
    return dealt
  }, [level])
  const ranked = useMemo(() => analyzeDiscards({ concealed: puzzle.tiles, declared: [], flowers: [] }, { meldsNeeded: level }).slice(0, 6), [puzzle, level])
  const [choice, setChoice] = useState('')
  const best = ranked[0]?.winPercent ?? 0
  return (
    <>
      <div className="tiles">{puzzle.tiles.map((t, i) => <TileFace key={i} kind={`${t.rank}${t.suit}`} onClick={() => setChoice(`${t.rank}${t.suit}`)} />)}</div>
      {choice && <p>Choice {choice}. Best win {best}%. {ranked.find((r) => r.discard === choice)?.winPercent === best ? 'Best' : 'Regret'}</p>}
      {ranked.map((r) => <p key={r.discard}>{r.discard} win {r.winPercent}%</p>)}
    </>
  )
}
