import { useEffect, useMemo, useState } from 'react'
import { defaultLedgerSettings, fewestPayments, replayLedger, roundLabel, type LedgerEvent, type LedgerPlayer, type LedgerSettings } from '@mjwaits/shared'
import { Icon } from './ui'

const KEY = 'mjwaits.scores'
interface Store { events: LedgerEvent[]; cursor: number }

function load(): Store {
  try { return JSON.parse(localStorage.getItem(KEY) || '') as Store } catch { return { events: [], cursor: 0 } }
}

export function LedgerPage() {
  const [store, setStore] = useState<Store>(load)
  const [sheet, setSheet] = useState<string | null>(null)
  const [farn, setFarn] = useState('8')
  const [selfDraw, setSelfDraw] = useState(false)
  const [discarder, setDiscarder] = useState('')
  const [toast, setToast] = useState('')
  useEffect(() => { localStorage.setItem(KEY, JSON.stringify(store)) }, [store])
  const state = useMemo(() => replayLedger(store.events.slice(0, store.cursor)), [store])
  function push(event: LedgerEvent) {
    const events = [...store.events.slice(0, store.cursor), event]
    setStore({ events, cursor: events.length })
    setToast('Recorded')
  }
  function setup() {
    const players: LedgerPlayer[] = [
      { id: 'a', name: 'A' },
      { id: 'b', name: 'B' },
      { id: 'c', name: 'C' },
      { id: 'd', name: 'D' },
    ]
    push({ type: 'setup', players, dealerId: 'a', settings: defaultLedgerSettings() })
  }
  const seats = state.seatOrder
  const colors = ['var(--seat-a)', 'var(--seat-b)', 'var(--seat-c)', 'var(--seat-d)']
  const positions = [seats[2], seats[3], seats[1], seats[0]]
  return (
    <section>
      <div className="sticky">
        <button onClick={() => setStore({ ...store, cursor: Math.max(1, store.cursor - 1) })}><Icon name="undo" size={18} /> 還原</button>
        <button onClick={() => setStore({ ...store, cursor: Math.min(store.events.length, store.cursor + 1) })}><Icon name="redo" size={18} /> 重做</button>
        <button onClick={() => setSheet('settings')}><Icon name="settings" size={18} /> 設定</button>
      </div>
      {!state.players.length || store.cursor === 0 ? <button className="primary" onClick={setup}>Start four-player game</button> : (
        <div className="card">
          <p>{state.label} · 局 {state.handNumber} · 連莊 {state.streak} · pot {state.pot}</p>
          <div className="board">
            <div />
            <Seat id={positions[0]} state={state} color={colors[0]} onClick={() => { setSheet(positions[0]); setDiscarder(positions[1] ?? '') }} />
            <div />
            <Seat id={positions[2]} state={state} color={colors[2]} onClick={() => setSheet(positions[2])} />
            <div className="seat" style={{ textAlign: 'center' }}>流局 / {state.pot}</div>
            <Seat id={positions[1]} state={state} color={colors[1]} onClick={() => setSheet(positions[1])} />
            <div />
            <Seat id={positions[3]} state={state} color={colors[3]} onClick={() => setSheet(positions[3])} />
            <div />
          </div>
        </div>
      )}
      <div className="card">
        <h2>最近</h2>
        {store.events.slice(0, store.cursor).slice(-8).map((event, i, list) => {
          const index = store.cursor - list.length + i
          return <button key={index} onClick={() => setStore({ ...store, cursor: index + 1 })}>{event.type}</button>
        })}
        <button onClick={() => push({ type: 'draw' })}>流局</button>
        <button onClick={() => { const id = state.players[0]?.id; if (id) push({ type: 'surrender', playerId: id }) }}>投降</button>
        <button onClick={() => { const ids = state.players.map((p) => p.id); if (ids.length >= 3) push({ type: 'multi', discarderId: ids[0], winners: [{ id: ids[1], farn: Number(farn) || 0 }, { id: ids[2], farn: Number(farn) || 0 }] }) }}>一炮多響</button>
        <button onClick={() => { const id = state.players[0]?.id; if (id) push({ type: 'bonus', label: '花', mode: 'reward', playerId: id, amount: 5 }) }}>花獎</button>
        <button onClick={() => setSheet('settle')}>新局</button>
      </div>
      <Chart store={store} />
      {state.players.length > 1 && (
        <div className="card">
          <h2>對戰</h2>
          {state.players.map((player) => (
            <p key={player.id}>{player.name} {state.nets[player.id] ?? 0} · 投降 {state.surrenderCounts[player.id] ?? 0} · 拉 {state.claims.filter((c) => c.holderId === player.id).reduce((n, c) => n + c.value, 0)}</p>
          ))}
        </div>
      )}
      {sheet && sheet !== 'settings' && sheet !== 'settle' && (
        <div className="sheet-back" onClick={() => setSheet(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <h2>食胡 {state.players.find((p) => p.id === sheet)?.name}</h2>
            <div className="row">
              <button className={selfDraw ? 'on' : ''} onClick={() => setSelfDraw(!selfDraw)}>自摸</button>
              {!selfDraw && state.players.filter((p) => p.id !== sheet).map((p) => <button key={p.id} className={discarder === p.id ? 'on' : ''} onClick={() => setDiscarder(p.id)}>{p.name}</button>)}
            </div>
            <input value={farn} onChange={(e) => setFarn(e.target.value.replace(/[^\d]/g, ''))} aria-label="farn" style={{ fontSize: 22, width: '100%', margin: '0.5rem 0' }} />
            <p>底 {state.settings.base} · 番 {farn} · 高分 {Number(farn) >= state.settings.highScore ? 'yes' : 'no'}</p>
            <button className="primary" onClick={() => { push({ type: 'win', winnerId: sheet, selfDraw, discarderId: selfDraw ? undefined : discarder, farn: Number(farn) || 0, takeJackpot: state.pot > 0 }); setSheet(null) }}>Record</button>
          </div>
        </div>
      )}
      {sheet === 'settle' && (
        <div className="sheet-back" onClick={() => setSheet(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <h2>新局</h2>
            {fewestPayments(state.nets).map((p, i) => <p key={i}>{p.from} → {p.to} {p.amount} × ${state.settings.dollarPerFarn}</p>)}
            <button onClick={() => { const text = fewestPayments(state.nets).map((p) => `${nameOf(state, p.from)} to ${nameOf(state, p.to)} ${p.amount}`).join('\n'); navigator.clipboard?.writeText(text); setToast('Settlement copied') }}>Share text</button>
            <button onClick={() => shareSettlement(state)}>Share image</button>
          </div>
        </div>
      )}
      {sheet === 'settings' && <Settings settings={state.settings} onSave={(settings) => { push({ type: 'settings', settings }); setSheet(null) }} onClose={() => setSheet(null)} />}
      {toast && <div className="toast" onClick={() => setToast('')}>{toast}</div>}
      {state.seatPrompt && <p className="card">執位提示 · the north round is finished.</p>}
    </section>
  )
}

function Seat({ id, state, color, onClick }: { id?: string; state: ReturnType<typeof replayLedger>; color: string; onClick: () => void }) {
  if (!id) return <div />
  const player = state.players.find((p) => p.id === id)
  const net = state.nets[id] ?? 0
  const claim = state.claims.find((c) => c.holderId === id)
  return (
    <button className="seat" style={{ background: color, textAlign: 'left' }} onClick={onClick}>
      <b>{player?.name}</b> {state.dealerId === id ? '莊' : ''}
      <div className={net > 0 ? 'good' : net < 0 ? 'bad' : 'zero'}>{net}</div>
      <small>{state.lastDeltas[id] ? `last ${state.lastDeltas[id]}` : ''}</small>
      {claim && <small> 拉 {claim.value}</small>}
    </button>
  )
}

function nameOf(state: ReturnType<typeof replayLedger>, id: string) {
  return state.players.find((p) => p.id === id)?.name ?? id
}

function shareSettlement(state: ReturnType<typeof replayLedger>) {
  const canvas = document.createElement('canvas')
  canvas.width = 640
  canvas.height = 360
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.fillStyle = '#f2f2f7'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = '#1c1c1e'
  ctx.font = '600 22px sans-serif'
  ctx.fillText(state.label || 'Settlement', 24, 40)
  fewestPayments(state.nets).forEach((payment, i) => {
    ctx.font = '18px sans-serif'
    ctx.fillText(`${nameOf(state, payment.from)} → ${nameOf(state, payment.to)}  ${payment.amount}`, 24, 84 + i * 32)
  })
  canvas.toBlob((blob) => {
    if (!blob) return
    const file = new File([blob], 'settlement.png', { type: 'image/png' })
    if (navigator.share && navigator.canShare?.({ files: [file] })) navigator.share({ files: [file], title: 'Settlement' }).catch(() => {})
    else {
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'settlement.png'
      a.click()
      URL.revokeObjectURL(url)
    }
  })
}

function Chart({ store }: { store: Store }) {
  const series = useMemo(() => {
    const points: number[][] = []
    const names: string[] = []
    for (let i = 1; i <= store.cursor; i++) {
      const snap = replayLedger(store.events.slice(0, i))
      if (!names.length) names.push(...snap.players.map((p) => p.name))
      points.push(snap.players.map((p) => snap.nets[p.id] ?? 0))
    }
    return { points, names }
  }, [store])
  if (!series.points.length) return null
  const flat = series.points.flat()
  const max = Math.max(1, ...flat.map(Math.abs))
  const w = 320
  const h = 140
  const colors = ['var(--seat-a)', 'var(--seat-b)', 'var(--seat-c)', 'var(--seat-d)']
  return (
    <div className="card">
      <h2>走勢</h2>
      <svg className="chart" viewBox={`0 0 ${w} ${h}`}>
        <line x1="0" y1={h / 2} x2={w} y2={h / 2} stroke="var(--separator)" />
        {series.names.map((name, player) => {
          const pts = series.points.map((row, i) => `${(i / Math.max(1, series.points.length - 1)) * (w - 20) + 10},${h / 2 - ((row[player] ?? 0) / max) * (h / 2 - 10)}`).join(' ')
          return <polyline key={name} fill="none" stroke={colors[player % colors.length]} strokeWidth="2" points={pts} />
        })}
      </svg>
      <p className="muted">{series.names.join(' · ')}</p>
    </div>
  )
}

function Settings({ settings, onSave, onClose }: { settings: LedgerSettings; onSave: (s: Partial<LedgerSettings>) => void; onClose: () => void }) {
  const [draft, setDraft] = useState(settings)
  return (
    <div className="sheet-back" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <h2>設定</h2>
        <label>封頂 input <input type="number" min={0} max={999} value={draft.limitInput} onChange={(e) => setDraft({ ...draft, limitInput: Math.max(0, Math.min(999, Number(e.target.value) || 0)) })} /></label>
        <p className="muted">封頂 is an input only. It never caps a payment.</p>
        <label>底 <input type="number" value={draft.base} onChange={(e) => setDraft({ ...draft, base: Number(e.target.value) })} /></label>
        <label>莊 <input type="number" value={draft.dealerTai} onChange={(e) => setDraft({ ...draft, dealerTai: Number(e.target.value) })} /></label>
        <label>連莊 <input type="number" value={draft.streakTai} onChange={(e) => setDraft({ ...draft, streakTai: Number(e.target.value) })} /></label>
        <label>反雪 雙響 <input type="number" value={draft.counterSnowDouble} onChange={(e) => setDraft({ ...draft, counterSnowDouble: Number(e.target.value) })} /></label>
        <label>反雪 三響 <input type="number" value={draft.counterSnowTriple} onChange={(e) => setDraft({ ...draft, counterSnowTriple: Number(e.target.value) })} /></label>
        <label>Jackpot <input type="number" value={draft.jackpotPerDraw} onChange={(e) => setDraft({ ...draft, jackpotPerDraw: Number(e.target.value), jackpotEnabled: Number(e.target.value) > 0 })} /></label>
        <button className="primary" onClick={() => onSave(draft)}>Save</button>
        <p className="muted">{roundLabel(1, 0)} is the opening label. 詐胡 preset {draft.falseWinPenalty}.</p>
      </div>
    </div>
  )
}
