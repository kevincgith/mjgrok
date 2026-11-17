import { useEffect, useMemo, useState } from 'react'
import {
  defaultSituation,
  formatHand,
  kindOf,
  kongCount,
  parseHand,
  replayLedger,
  scoreHand,
  type PatternUse,
  type Situation,
} from '@mjwaits/shared'
import { bumpDealer, clampSituation, cycleSituation, parseSituationQuery, situationQuery, type SitKey } from './lib/situation'
import { Icon, TileFace } from './ui'
import { loadRules, RulesSheet } from './RulesSheet'
import type { RuleDiff } from '@mjwaits/shared'

type Mode = 'hand' | 'chow' | 'pung' | 'open-kong' | 'closed-kong'
interface Meld { type: Mode; tiles: string[] }
interface Recent { id: string; notation: string; query: string }

const SUITS = [
  ['m', '萬'],
  ['t', '筒'],
  ['b', '索'],
] as const
const HONORS = ['東', '南', '西', '北', '中', '發', '白']
const FLOWERS = ['梅', '蘭', '菊', '竹']
const SEASONS = ['春', '夏', '秋', '冬']

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) as T : fallback
  } catch {
    return fallback
  }
}

export function ScoringPage() {
  const [mode, setMode] = useState<Mode>('hand')
  const [layout, setLayout] = useState<'classic' | 'numpad'>(load('mjwaits.picker', 'classic'))
  const [group, setGroup] = useState<'花' | '字' | 'm' | 't' | 'b'>('m')
  const [concealed, setConcealed] = useState<string[]>([])
  const [declared, setDeclared] = useState<Meld[]>([])
  const [flowers, setFlowers] = useState<string[]>([])
  const [pending, setPending] = useState<string[]>([])
  const [winning, setWinning] = useState<string | null>(null)
  const [sit, setSit] = useState<Situation>(defaultSituation())
  const [recent, setRecent] = useState<Recent[]>(load('mjwaits.recentScoring', []))
  const [sort, setSort] = useState<'order' | 'down' | 'up'>('order')
  const [openId, setOpenId] = useState<string | null>(null)
  const [armed, setArmed] = useState(false)
  const [toast, setToast] = useState('')
  const [showRecent, setShowRecent] = useState(false)
  const [showRules, setShowRules] = useState(false)
  const [rules, setRules] = useState<RuleDiff>(loadRules)

  useEffect(() => { localStorage.setItem('mjwaits.picker', JSON.stringify(layout)) }, [layout])
  useEffect(() => { localStorage.setItem('mjwaits.recentScoring', JSON.stringify(recent)) }, [recent])
  useEffect(() => {
    const hash = location.hash.replace(/^#/, '')
    const params = new URLSearchParams(hash)
    const rule = params.get('r')
    if (rule) {
      try { setRules(JSON.parse(rule) as RuleDiff) } catch { setToast('This rule link could not be read.') }
    }
    if (!params.get('t')) return
    const hand = parseHand(params.get('t') ?? '')
    setConcealed(hand.concealed.map(kindOf))
    setFlowers(hand.flowers.map(kindOf))
    setDeclared(hand.declared.map((m) => ({ type: m.type === 'chow' ? 'chow' : m.type === 'pung' ? 'pung' : m.type === 'open-kong' ? 'open-kong' : 'closed-kong', tiles: m.tiles.map(kindOf) })))
    setWinning(hand.winningTile ? kindOf(hand.winningTile) : null)
    setSit({ ...defaultSituation(), ...parseSituationQuery(params.get('s') ?? '') })
  }, [])

  const caps = { flowers: flowers.length, kongs: declared.filter((m) => m.type === 'open-kong' || m.type === 'closed-kong').length }
  const live = clampSituation(sit, caps)
  const hand = useMemo(() => ({
    concealed: concealed.map(toTile),
    declared: declared.map((m) => ({
      type: m.type === 'chow' ? 'chow' as const : m.type === 'pung' ? 'pung' as const : m.type === 'open-kong' ? 'open-kong' as const : 'concealed-kong' as const,
      tiles: m.tiles.map(toTile),
      concealed: m.type === 'closed-kong',
    })),
    flowers: flowers.map(toTile),
    winningTile: winning ? toTile(winning) : null,
  }), [concealed, declared, flowers, winning])
  const scored = useMemo(() => {
    try {
      return { result: scoreHand(hand, live, rules.name === 'House' && !rules.values ? undefined : rules)[0], error: '' }
    } catch (err) {
      return { result: undefined, error: err instanceof Error && err.message ? err.message : 'Scoring failed. The total is not available for this hand.' }
    }
  }, [hand, live, rules])
  const result = scored.result
  const rows = [...(result?.matches ?? []), ...(result?.second?.matches ?? [])]
  if (sort === 'down') rows.sort((a, b) => b.tai - a.tai)
  if (sort === 'up') rows.sort((a, b) => a.tai - b.tai)

  function countKind(kind: string) {
    return concealed.filter((k) => k === kind).length + declared.reduce((n, m) => n + m.tiles.filter((t) => t === kind).length, 0) + pending.filter((k) => k === kind).length
  }
  function addKind(kind: string) {
    if (kind.endsWith('f') || kind.endsWith('s')) {
      if (!flowers.includes(kind)) setFlowers([...flowers, kind])
      return
    }
    if (kind !== 'j' && countKind(kind) >= 4) return
    if (mode === 'hand') {
      setConcealed([...concealed, kind])
      return
    }
    const need = mode === 'chow' || mode === 'pung' ? 3 : 4
    const next = [...pending, kind]
    if (next.length < need) { setPending(next); return }
    setPending([])
    setDeclared([...declared, { type: mode, tiles: next }])
  }
  function share() {
    const query = situationQuery(live)
    const hash = `t=${encodeURIComponent(formatHand(hand))}${query ? `&s=${query}` : ''}`
    const url = `${location.origin}${location.pathname}#${hash}`
    const entry: Recent = { id: hash, notation: formatHand(hand), query }
    setRecent([entry, ...recent.filter((r) => r.notation !== entry.notation)].slice(0, 10))
    navigator.clipboard?.writeText(url).then(() => setToast('Link copied')).catch(() => setToast(url))
    if (navigator.share) navigator.share({ title: 'MJWaits', url }).catch(() => {})
  }
  function record() {
    if (!result) { setToast(scored.error || 'Score a complete hand before recording it.'); return }
    let store: { events: { type: string }[]; cursor: number }
    try { store = JSON.parse(localStorage.getItem('mjwaits.scores') || '') } catch { store = { events: [], cursor: 0 } }
    const played = replayLedger((store.events ?? []).slice(0, store.cursor ?? 0) as never)
    if (!played.players.length || !(store.cursor > 0)) { setToast('Start a ledger game before recording a hand.'); return }
    const dealerTai = result.matches.find((m) => m.id === 'dealer')?.tai ?? 0
    const multiTai = [...result.matches, ...(result.second?.matches ?? [])].find((m) => m.id === 'double-win' || m.id === 'triple-win')?.tai ?? 0
    const farn = Math.max(0, result.total - dealerTai - multiTai)
    const wind = live.seatWind
    const at = played.seatOrder.indexOf(played.dealerId)
    const byWind = Object.entries(played.winds).find(([, value]) => value === wind)?.[0]
    const winnerId = byWind && played.seatOrder.includes(byWind)
      ? byWind
      : played.seatOrder[(at + wind - 1 + played.seatOrder.length) % played.seatOrder.length]
    const patterns: PatternUse[] = [...result.matches, ...(result.second?.matches ?? [])].map((m) => ({ id: m.id, nameZh: m.nameZh, tai: m.tai, count: m.count }))
    sessionStorage.setItem('mjwaits.pendingWin', JSON.stringify({
      winnerId,
      selfDraw: live.selfDraw,
      farn,
      multi: live.multiWin === 'triple' ? 'triple' : live.multiWin === 'double' ? 'double' : 'none',
      patterns,
    }))
    location.hash = 'ledger'
  }
  function press(key: SitKey) {
    setSit(clampSituation(cycleSituation(live, key, caps), caps))
  }

  const complete = concealed.length + declared.length * 3 >= 14
  return (
    <section>
      <div className="sticky">
        <button onClick={() => { if (!armed) { setArmed(true); return } setConcealed([]); setDeclared([]); setFlowers([]); setPending([]); setWinning(null); setArmed(false) }} className={armed ? 'danger-arm' : ''}>
          <Icon name="reset" size={18} /> Reset
        </button>
        <strong className="score">{result ? `${result.total} 番` : scored.error ? 'Error' : '—'}</strong>
        <button onClick={() => setShowRules(true)}><Icon name="settings" size={18} /> 設定</button>
        <button onClick={share}><Icon name="share" size={18} /> Share</button>
        <button className="primary" style={{ width: 'auto' }} onClick={record}>Record</button>
      </div>
      <div className="card">
        <div className="row">
          <div className="seg">
            {([['hand', '手牌'], ['chow', '上'], ['pung', '碰'], ['open-kong', '明槓'], ['closed-kong', '暗槓']] as const).map(([id, label]) => (
              <button key={id} className={mode === id ? 'on' : ''} onClick={() => { setMode(id); setPending([]) }}>{label}</button>
            ))}
          </div>
          <div className="seg">
            <button className={layout === 'classic' ? 'on' : ''} onClick={() => setLayout('classic')}>Classic</button>
            <button className={layout === 'numpad' ? 'on' : ''} onClick={() => setLayout('numpad')}>Numpad</button>
          </div>
        </div>
        {layout === 'numpad' && (
          <div className="seg" style={{ marginTop: 8 }}>
            {(['花', '字', 'm', 't', 'b'] as const).map((id) => (
              <button key={id} className={group === id ? 'on' : ''} onClick={() => setGroup(id)}>{id === 'm' ? '萬' : id === 't' ? '筒' : id === 'b' ? '索' : id}</button>
            ))}
          </div>
        )}
        <div className="picker-groups">
          {(layout === 'classic' || group === '花') && (
            <div className="suit-row eight">
              {FLOWERS.map((name, i) => <Picker key={name} kind={`${i + 1}f`} label={name} dead={flowers.includes(`${i + 1}f`)} onAdd={addKind} />)}
              {SEASONS.map((name, i) => <Picker key={name} kind={`${i + 1}s`} label={name} dead={flowers.includes(`${i + 1}s`)} onAdd={addKind} />)}
            </div>
          )}
          {(layout === 'classic' || group === '字') && (
            <div className="suit-row eight">
              {HONORS.map((name, i) => <Picker key={name} kind={`${i + 1}z`} label={name} dead={countKind(`${i + 1}z`) >= 4} onAdd={addKind} />)}
              <Picker kind="j" label="Joker" dead={false} onAdd={addKind} />
            </div>
          )}
          {(layout === 'classic' ? SUITS : SUITS.filter(([s]) => group === s)).map(([suit, label]) => (
            <div className="suit-row nine" key={suit}>
              {Array.from({ length: 9 }, (_, n) => <Picker key={`${suit}${n}`} kind={`${n + 1}${suit}`} label={`${n + 1}${label}`} dead={countKind(`${n + 1}${suit}`) >= 4} onAdd={addKind} />)}
            </div>
          ))}
        </div>
        {pending.length > 0 && <p className="muted">Building meld: {pending.join(' ')}</p>}
      </div>
      <div className="card">
        <h2>門前 <span>Declared</span></h2>
        <div className="tiles">
          {declared.map((meld, i) => (
            <span key={i} className="row" style={{ background: 'var(--fill)', borderRadius: 4, padding: 4 }}>
              {meld.tiles.map((kind, t) => <TileFace key={t} kind={kind} className="small" onClick={() => setDeclared(declared.filter((_, j) => j !== i))} />)}
            </span>
          ))}
          {flowers.map((kind) => <TileFace key={kind} kind={kind} className="small" onClick={() => setFlowers(flowers.filter((f) => f !== kind))} />)}
        </div>
        <h2 style={{ marginTop: 8 }}>手牌 <span>Concealed</span></h2>
        <div className="tiles">
          {concealed.map((kind, i) => (
            <TileFace key={`${kind}${i}`} kind={kind} className="hand" win={winning === kind && concealed.indexOf(kind) === i} onClick={() => setConcealed(concealed.filter((_, j) => j !== i))} onHold={() => setWinning(kind)} />
          ))}
        </div>
      </div>
      <div className="card">
        <h2>情況 <span>Situation</span></h2>
        <div className="row">
          {(['東', '南', '西', '北'] as const).map((wind, i) => <button key={wind} className={live.roundWind === i + 1 ? 'on' : ''} onClick={() => setSit({ ...live, roundWind: (i + 1) as Situation['roundWind'] })}>圈{wind}</button>)}
          {(['東', '南', '西', '北'] as const).map((wind, i) => <button key={`s${wind}`} className={live.seatWind === i + 1 ? 'on' : ''} onClick={() => setSit({ ...live, seatWind: (i + 1) as Situation['seatWind'] })}>門{wind}</button>)}
        </div>
        <div className="row" style={{ marginTop: 8 }}>
          <button className={live.dealerStreak > 0 ? 'on' : ''} onClick={() => press('dealer')}>{live.dealerStreak > 1 ? `莊連${live.dealerStreak - 1}` : '莊'}</button>
          <button onClick={() => setSit(bumpDealer(live, 1))}>+</button>
          <button onClick={() => setSit(bumpDealer(live, -1))}>-</button>
          <button className={live.selfDraw ? 'on' : ''} onClick={() => press('selfDraw')}>自摸</button>
          <button className={live.riichi !== 'none' ? 'on' : ''} onClick={() => press('riichi')}>{live.riichi === 'heavenly-riichi' ? '天叮' : live.riichi === 'earthly-riichi' ? '地叮' : '叮'}</button>
          <button className={live.instantWin ? 'on' : ''} disabled={live.riichi === 'none'} onClick={() => press('instant')}>一發</button>
          <button className={live.eatRiichi ? 'on' : ''} onClick={() => press('eat')}>食叮</button>
          <button className={live.earlyWin !== 'none' ? 'on' : ''} onClick={() => press('early')}>{live.earlyWin === 'four' ? '四子內' : live.earlyWin === 'seven' ? '七子內' : live.earlyWin === 'ten' ? '十子內' : '四子內'}</button>
          <button className={live.multiWin !== 'none' ? 'on' : ''} onClick={() => press('multi')}>{live.multiWin === 'triple' ? '三響' : '雙響'}</button>
          <button className={live.heavenlyWin !== 'none' ? 'on' : ''} onClick={() => press('heaven')}>{live.heavenlyWin === 'earth' ? '地胡' : live.heavenlyWin === 'man' ? '人胡' : '天胡'}</button>
          <button className={live.lastTileWin !== 'none' ? 'on' : ''} onClick={() => press('last')}>{live.lastTileWin === 'sea-bottom' ? '海底撈月' : '河底撈魚'}</button>
          <button className={live.flowerDraw ? 'on' : ''} onClick={() => press('flower')}>花摸 {live.flowerDraw}</button>
          <button className={live.kongDraw ? 'on' : ''} onClick={() => press('kongDraw')}>槓摸 {live.kongDraw}</button>
          <button className={live.robKong ? 'on' : ''} onClick={() => press('rob')}>搶槓</button>
          <button className={live.manualVisibleExhausted || live.manualVisibleTriple ? 'on' : ''} onClick={() => press('visible')}>{live.manualVisibleExhausted ? '絕絕' : '明絕'}</button>
        </div>
      </div>
      <div className="card">
        <div className="row">
          <h2>番 <span>{result?.total ?? 0}</span></h2>
          <button className={sort === 'order' ? 'on' : ''} onClick={() => setSort('order')}>Order</button>
          <button className={sort === 'down' ? 'on' : ''} onClick={() => setSort('down')}>番↓</button>
          <button className={sort === 'up' ? 'on' : ''} onClick={() => setSort('up')}>番↑</button>
        </div>
        {rows.map((row) => (
          <div key={row.id}>
            <button className="pattern" onClick={() => setOpenId(openId === row.id ? null : row.id)}>
              <span>{row.nameZh} <span className="muted">{row.nameEn}</span></span><b>{row.tai}</b>
            </button>
            {openId === row.id && row.instances.map((inst, i) => (
              <div key={i} className="tiles">{inst.flat().map((kind, n) => <TileFace key={n} kind={kind} className="small" />)}</div>
            ))}
          </div>
        ))}
        {scored.error && <p className="bad">{scored.error}</p>}
        {result?.second && <p className="muted">Eight pairs and the ordinary reading are both valid. The total adds them.</p>}
        {!rows.length && !scored.error && <p className="muted">{complete ? 'Not a complete hand yet.' : 'Add tiles to score.'}</p>}
        <button style={{ marginTop: 8 }} onClick={() => setShowRecent(true)}>Recent</button>
      </div>
      {showRecent && (
        <div className="sheet-back" onClick={() => setShowRecent(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <h2>Recent</h2>
            {recent.map((item) => <button key={item.id} onClick={() => {
              const next = parseHand(item.notation)
              setConcealed(next.concealed.map(kindOf))
              setFlowers(next.flowers.map(kindOf))
              setDeclared(next.declared.map((m) => ({ type: m.type === 'chow' ? 'chow' : m.type === 'pung' ? 'pung' : m.type === 'open-kong' ? 'open-kong' : 'closed-kong', tiles: m.tiles.map(kindOf) })))
              setWinning(next.winningTile ? kindOf(next.winningTile) : null)
              setSit({ ...defaultSituation(), ...parseSituationQuery(item.query) })
              setShowRecent(false)
            }}>{item.notation}</button>)}
            <button className={armed ? 'danger-arm' : ''} onClick={() => { if (!armed) { setArmed(true); return } setRecent([]); setArmed(false) }}>Clear</button>
          </div>
        </div>
      )}
      {showRules && <RulesSheet onClose={() => setShowRules(false)} onChange={setRules} />}
      {toast && <div className="toast" onClick={() => setToast('')}>{toast}</div>}
      <p className="muted">Kongs in this hand: {kongCount(hand)}. Long-press a concealed tile to mark 食胡.</p>
    </section>
  )
}

function toTile(kind: string) {
  if (kind === 'j') return { suit: 'j' as const, rank: 0 }
  return { suit: kind.slice(-1) as 'm' | 't' | 'b' | 'z' | 'f' | 's', rank: Number(kind.slice(0, -1)) }
}

function Picker({ kind, label, dead, onAdd }: { kind: string; label: string; dead: boolean; onAdd: (kind: string) => void }) {
  return <TileFace kind={kind} className={`picker ${dead ? 'dead' : ''}`} label={label} onClick={() => { if (!dead) onAdd(kind) }} />
}
