import { useMemo, useState } from 'react'

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
  const stacks = useMemo(() => Array.from({ length: 18 }, (_, i) => i), [])
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(18, 1fr)', gap: 2, marginTop: 8 }}>
      {stacks.map((i) => (
        <div key={i} style={{ height: 28, background: i < total ? 'var(--gold)' : 'var(--tile-back)', borderBottom: '4px solid var(--tile-edge)', borderRadius: 2 }} />
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

function Seats() {
  const [step, setStep] = useState(0)
  const [names, setNames] = useState(['A', 'B', 'C', 'D'])
  const [east, setEast] = useState(0)
  return (
    <div className="card">
      <div className="row">
        {names.map((name, i) => (
          <button key={i} className={east === i ? 'on' : ''} onClick={() => setEast(i)}>{name}{east === i ? ' East' : ''}</button>
        ))}
      </div>
      <p><b>{STEPS[step]}</b></p>
      <p className="muted">Step {step + 1} / 8. Count n seats counterclockwise: (seat + n - 1) mod 4.</p>
      <button onClick={() => setStep((step + 1) % 8)}>Next</button>
      <button onClick={() => setNames(names.map((n, i) => i === 0 ? n : n))}>Rename later from a long-press in a full session</button>
    </div>
  )
}
