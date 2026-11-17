import { useEffect, useState } from 'react'
import { replayLedger, type LedgerEvent } from '@mjwaits/shared'

function rot(face: number) {
  const map: Record<number, string> = { 1: 'rotateX(0deg)', 2: 'rotateY(-90deg)', 3: 'rotateX(-90deg)', 4: 'rotateX(90deg)', 5: 'rotateY(90deg)', 6: 'rotateX(180deg)' }
  return map[face] ?? 'rotateX(0deg)'
}

export function DicePage() {
  const [tab, setTab] = useState<'dice' | 'swap' | 'seats'>('dice')
  const [dice, setDice] = useState([1, 1, 1])
  const [rolling, setRolling] = useState(false)
  const total = dice.reduce((s, n) => s + n, 0)
  const triple = dice.every((n) => n === dice[0])
  const low = dice.slice().sort().join('') === '123'
  function roll(count: number) {
    setRolling(true)
    window.setTimeout(() => {
      setDice(Array.from({ length: count }, () => 1 + Math.floor(Math.random() * 6)))
      setRolling(false)
    }, 700)
  }
  const wall = (total - 1) % 4
  const names = ['the dealer wall', 'the right wall', 'the across wall', 'the left wall']
  return (
    <section>
      <div className="seg">
        <button className={tab === 'dice' ? 'on' : ''} onClick={() => setTab('dice')}>擲骰 Dice</button>
        <button className={tab === 'swap' ? 'on' : ''} onClick={() => setTab('swap')}>換牌 Swap</button>
        <button className={tab === 'seats' ? 'on' : ''} onClick={() => setTab('seats')}>座位 Seats</button>
      </div>
      {tab === 'dice' && (
        <div className="card">
          <div className="felt" style={{ display: 'grid', placeItems: 'center', gap: 12 }}>
            <div className="row">
              {dice.map((face, i) => (
                <button key={i} className="die" style={{ transform: rolling ? 'rotateX(360deg) rotateY(360deg)' : rot(face) }} onClick={() => setDice(dice.map((n, j) => j === i ? (n % 6) + 1 : n))}>
                  <span>{face}</span>
                </button>
              ))}
            </div>
            <button className={`total ${triple ? 'triple' : ''} ${low ? 'low' : ''}`} onClick={() => roll(3)}>Roll · {total}</button>
          </div>
          <Wall total={total} />
          <p><b>Break {names[wall]}</b></p>
          <p className="muted">count {total} stacks clockwise · {18 - total} stay on that wall</p>
        </div>
      )}
      {tab === 'swap' && <Swap />}
      {tab === 'seats' && <Seats />}
    </section>
  )
}

function Wall({ total }: { total: number }) {
  const broken = (total - 1) % 4
  const places = ['dealer', 'right', 'across', 'left']
  return (
    <div className="walls" aria-label="Four walls">
      {places.map((place, wall) => (
        <div key={place} className={`wall wall-${place}`}>
          {Array.from({ length: 18 }, (_, stack) => (
            <span key={stack} className={`stack${wall === broken && stack < total ? ' counted' : ''}${wall === broken && stack === total ? ' gap' : ''}`}>
              <i /><i />
            </span>
          ))}
        </div>
      ))}
    </div>
  )
}

function Swap() {
  const [dice, setDice] = useState([1, 3])
  const total = dice[0] + dice[1]
  const round = ((total - 1) % 3) + 1
  const tiles = Math.floor(total / 3)
  return (
    <div className="card">
      <p className="muted">Two dice before the deal. Round is 1-3 from the total, Tiles is the total divided by 3 and rounded down. Both numbers and their product are shown. This is the resolution used when the house did not publish a second formula.</p>
      <div className="row">
        {dice.map((n, i) => <button key={i} onClick={() => setDice(dice.map((v, j) => j === i ? (v % 6) + 1 : v))}>{n}</button>)}
      </div>
      <p>Round {round}</p>
      <p>Tiles {tiles}</p>
      <p>Product {round * tiles}</p>
    </div>
  )
}

const STEPS = [
  'Provisional East throws 3 dice',
  'Total count picks the real East seat',
  'Real East throws',
  'Flip all 6 tiles',
  'Earlier 筒 moves left, the other end moves right',
  'Second total from real East picks the first player',
  'Read winds from the 二筒 end if the total is even, otherwise the 一筒 end',
  'Move to the assigned seats, East at the bottom',
]

const TILES = ['東', '南', '西', '北', '一筒', '二筒']

function Seats() {
  const [step, setStep] = useState(0)
  const [running, setRunning] = useState(false)
  const [names, setNames] = useState(['A', 'B', 'C', 'D'])
  const [ids, setIds] = useState(['a', 'b', 'c', 'd'])
  const [editing, setEditing] = useState<number | null>(null)
  const [provisional, setProvisional] = useState(0)
  const [firstThrow, setFirstThrow] = useState(9)
  const [secondThrow, setSecondThrow] = useState(7)
  const [order, setOrder] = useState<number[]>([0, 1, 2, 3, 4, 5])
  const [message, setMessage] = useState('')
  const realEast = (provisional + firstThrow - 1) % 4
  const reader = (realEast + secondThrow - 1) % 4
  const fromTwo = secondThrow % 2 === 0
  const windStart = fromTwo ? order.indexOf(5) : order.indexOf(4)
  const winds: string[] = []
  for (let n = 1; n <= 6 && winds.length < 4; n++) {
    const label = TILES[order[(windStart + n) % 6]]
    if (label === '一筒' || label === '二筒') continue
    winds.push(label)
  }
  useEffect(() => {
    if (!running) return
    const delay = step === 0 || step === 2 ? 1400 : 1000
    const timer = window.setTimeout(() => setStep((value) => Math.min(7, value + 1)), delay)
    return () => window.clearTimeout(timer)
  }, [running, step])
  useEffect(() => { if (step >= 7) setRunning(false) }, [step])
  useEffect(() => {
    const raw = localStorage.getItem('mjwaits.scores')
    if (!raw) return
    try {
      const store = JSON.parse(raw) as { events: LedgerEvent[]; cursor: number }
      const state = replayLedger(store.events.slice(0, store.cursor))
      if (state.seatOrder.length >= 4) {
        setIds(state.seatOrder.slice(0, 4))
        setNames(state.seatOrder.slice(0, 4).map((id) => state.roster.find((p) => p.id === id)?.name ?? id))
      }
    } catch { /* the ceremony still runs with the placeholder names */ }
  }, [])
  function apply() {
    const raw = localStorage.getItem('mjwaits.scores')
    if (!raw) { setMessage('Start a ledger game before applying seats.'); return }
    let store: { events: LedgerEvent[]; cursor: number }
    try { store = JSON.parse(raw) as { events: LedgerEvent[]; cursor: number } } catch { setMessage('The ledger store could not be read.'); return }
    const events = store.events.slice(0, store.cursor)
    const state = replayLedger(events)
    if (!state.players.length || !state.seatOrder.length) { setMessage('Start a ledger game before applying seats.'); return }
    const bottom = state.seatOrder[0]
    const windValue: Record<string, 1 | 2 | 3 | 4> = { '東': 1, '南': 2, '西': 3, '北': 4 }
    const assigned: Record<string, 1 | 2 | 3 | 4> = {}
    winds.forEach((label, n) => {
      const seat = ids[(reader + n) % 4]
      const value = windValue[label]
      if (seat && value) assigned[seat] = value
    })
    const ring = [1, 2, 3, 4].map((value) => Object.entries(assigned).find(([, wind]) => wind === value)?.[0]).filter((id): id is string => !!id)
    const at = ring.indexOf(bottom)
    const order = ring.length === 4 && at >= 0 ? [...ring.slice(at), ...ring.slice(0, at)] : state.seatOrder.slice()
    const eastPlayer = Object.entries(assigned).find(([, wind]) => wind === 1)?.[0] ?? ids[realEast] ?? bottom
    const next = [...events, { type: 'seats' as const, order, winds: assigned }, { type: 'dealer' as const, dealerId: eastPlayer, streak: 0 }]
    localStorage.setItem('mjwaits.scores', JSON.stringify({ events: next, cursor: next.length }))
    const eastName = state.roster.find((p) => p.id === eastPlayer)?.name ?? eastPlayer
    const bottomName = state.roster.find((p) => p.id === bottom)?.name ?? bottom
    setMessage(`East is ${eastName}. ${bottomName} stays at the bottom. Winds ${order.map((id) => `${state.roster.find((p) => p.id === id)?.name ?? id}${['', '東', '南', '西', '北'][assigned[id] ?? 0] ?? ''}`).join(' ')}.`)
  }
  return (
    <div className="card">
      <div className="row">
        {names.map((name, i) => (
          <button key={i} className={realEast === i ? 'on' : ''} onDoubleClick={() => { const swap = (i + 1) % 4; setNames(names.map((n, j) => j === i ? names[swap] : j === swap ? name : n)) }} onClick={() => { setProvisional(i); setEditing(i) }}>{name}{realEast === i ? ' 東' : ''}</button>
        ))}
      </div>
      {editing !== null && <input aria-label="Seat name" value={names[editing]} onChange={(e) => setNames(names.map((n, i) => i === editing ? e.target.value || n : n))} />}
      <div className="felt" style={{ minHeight: 160, position: 'relative', overflow: 'hidden' }}>
        {TILES.map((label, i) => {
          const slot = order.indexOf(i)
          const placed = step >= 3
          const split = step >= 4
          const seated = step >= 7
          const x = seated && i < 4 ? [50, 82, 50, 18][i] : split ? (slot < 3 ? 18 + slot * 14 : 58 + (slot - 3) * 14) : 12 + slot * 13
          const y = seated && i < 4 ? [78, 50, 16, 50][i] : seated ? 46 : 46
          return (
            <div key={label} style={{ position: 'absolute', left: `${x}%`, top: `${y}%`, transform: 'translate(-50%, -50%)', transition: 'left 0.8s ease, top 0.8s ease', width: 52, height: 72, borderRadius: 6, background: placed ? 'var(--tile)' : 'var(--tile-back)', borderBottom: '5px solid var(--tile-edge)', display: 'grid', placeItems: 'center', color: 'var(--ink)', fontWeight: 600 }}>
              {placed ? label : ''}
            </div>
          )
        })}
      </div>
      <p><b>{STEPS[step]}</b></p>
      <p className="muted">Step {step + 1} / 8. First total {firstThrow} from {names[provisional]} lands on {names[realEast]}. Second total {secondThrow} reads from {fromTwo ? '二筒' : '一筒'} toward {names[reader]}.</p>
      <div className="row">
        <button className={running ? 'on' : ''} onClick={() => { if (step >= 7) setStep(0); setRunning(!running) }}>{running ? 'Pause' : 'Run'}</button>
        <button onClick={() => { setRunning(false); setStep((value) => Math.min(7, value + 1)) }}>Next</button>
        <button onClick={() => { setFirstThrow(3 + Math.floor(Math.random() * 16)); setSecondThrow(2 + Math.floor(Math.random() * 11)); setOrder([...order].sort(() => Math.random() - 0.5)) }}>Throw</button>
        <button onClick={apply}>Apply to ledger</button>
      </div>
      <p className="muted">Winds {winds.join(' ')}. Long-press is a rename field; double-tap swaps a neighbor. East is counted {(firstThrow)} seats counterclockwise.</p>
      {message && <p>{message}</p>}
    </div>
  )
}
