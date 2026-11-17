import { useEffect, useMemo, useState } from 'react'
import { findWaits, formatNotation, parseNotation, scoreHand, shanten, type Tile } from '@mjwaits/shared'
import { Icon, TileFace } from './ui'
import { useDiscards } from './lib/useDiscards'

export function WaitsPage() {
  const [tiles, setTiles] = useState<Tile[]>([])
  const [text, setText] = useState('')
  const [sort, setSort] = useState(false)
  const [breakDown, setBreakDown] = useState(false)
  const [toast, setToast] = useState('')
  useEffect(() => {
    const params = new URLSearchParams(location.hash.replace(/^#/, ''))
    const raw = params.get('w')
    if (!raw) return
    try { sync(parseNotation(raw)) } catch { setToast('This wait link could not be read.') }
  }, [])
  const hand = { concealed: tiles, declared: [], flowers: [] }
  const result = useMemo(() => findWaits(hand), [tiles])
  const needDiscards = tiles.length > 0 && result.shanten >= 0 && !(result.atCheckpoint && result.shanten <= 0)
  const discards = useDiscards(hand, needDiscards)
  const projected = useMemo(() => {
    if (!breakDown || result.shanten > 0) return new Map<string, number>()
    const map = new Map<string, number>()
    for (const wait of result.waits) {
      if (wait.kind === 'j') continue
      const tile = toTile(wait.kind)
      try {
        const scored = scoreHand({ concealed: [...tiles, tile], declared: [], flowers: [], winningTile: tile })[0]
        if (scored) map.set(wait.kind, scored.total)
      } catch {
        map.set(wait.kind, -1)
      }
    }
    return map
  }, [breakDown, result, tiles])
  function sync(next: Tile[]) {
    setTiles(next)
    setText(formatNotation(next))
  }
  return (
    <section>
      <div className="sticky">
        <strong>Shanten {shanten(hand)}</strong>
        <button onClick={() => { const url = `${location.origin}${location.pathname}#w=${encodeURIComponent(formatNotation(tiles))}`; navigator.clipboard?.writeText(url); setToast('Link copied') }}><Icon name="share" size={18} /> Share</button>
      </div>
      <div className="card">
        <div className="row">
          <input value={text} aria-label="Notation" onChange={(e) => { setText(e.target.value); try { sync(parseNotation(e.target.value)) } catch { /* keep typing */ } }} style={{ flex: 1, border: 0, background: 'var(--fill)', borderRadius: 10, padding: '0.5rem 0.7rem' }} />
          <button className={sort ? 'on' : ''} onClick={() => setSort(!sort)}>Sort</button>
        </div>
        <div className="tiles" style={{ marginTop: 8 }} onPointerDown={(e) => { if (e.target === e.currentTarget && tiles.length) { const t = window.setTimeout(() => sync([]), 500); (e.currentTarget as HTMLElement).dataset.timer = String(t) } }} onPointerUp={(e) => { const id = (e.currentTarget as HTMLElement).dataset.timer; if (id) window.clearTimeout(Number(id)) }}>
          {(sort ? tiles.map((tile, index) => ({ tile, index })).sort((a, b) => formatNotation([a.tile]).localeCompare(formatNotation([b.tile]))) : tiles.map((tile, index) => ({ tile, index }))).map(({ tile, index }) => (
            <TileFace key={`${tile.suit}${tile.rank}${index}`} kind={tile.suit === 'j' ? 'j' : `${tile.rank}${tile.suit}`} onClick={() => sync(tiles.filter((_, j) => j !== index))} />
          ))}
        </div>
        <p className="muted">Tap a tile to remove it. Long-press the empty row to clear.</p>
      </div>
      {result.atCheckpoint && result.shanten <= 0 && (
        <div className="card">
          <h2>Waits <span>{result.universal ? 'Universal' : `${result.total} tiles`}</span></h2>
          {result.universal && <p>All 34 kinds complete this hand.</p>}
          <div className="tiles">
            {result.waits.filter((w) => w.kind !== 'j').map((w) => (
              <span key={w.kind}><TileFace kind={w.kind} className="win" /><small>{w.remaining}</small></span>
            ))}
          </div>
          <button className={breakDown ? 'on' : ''} onClick={() => setBreakDown(!breakDown)}>Breakdown</button>
          {breakDown && result.waits.map((w) => (
            <div key={w.kind}>
              <b>{w.kind}</b>
              {projected.get(w.kind) !== undefined && <p>{projected.get(w.kind)! < 0 ? 'Projected score failed' : `Projected ${projected.get(w.kind)} 番`}</p>}
              {w.decompositions.map((d, i) => <p key={i} className="muted">{d.shape}: {d.melds.map((m) => m.tiles.join('')).join(' ')} + {d.pair.join('')}{d.jokerStandIns.length ? ` jokers ${d.jokerStandIns.join(' ')}` : ''}</p>)}
            </div>
          ))}
        </div>
      )}
      {result.shanten < 0 && <div className="card"><h2>Winning hand</h2><p>This hand is already complete.</p></div>}
      {needDiscards && (
        <div className="card">
          <h2>{result.atCheckpoint ? 'Discard efficiency' : 'Discard options'}</h2>
          <p className="muted">Percentages are an estimate over the next self-draws, not an exact probability. {discards.pending ? 'Working…' : discards.elapsedMs ? `Worker ${discards.elapsedMs} ms` : ''}</p>
          {discards.error && <p className="bad">{discards.error}</p>}
          {discards.rows.map((row) => (
            <p key={row.discard}><b>{row.discard}</b> tenpai {row.tenpaiPercent}% win {row.winPercent}% shanten {row.shanten}</p>
          ))}
        </div>
      )}
      {toast && <div className="toast" onClick={() => setToast('')}>{toast}</div>}
    </section>
  )
}

function toTile(kind: string): Tile {
  if (kind === 'j') return { suit: 'j', rank: 0 }
  return { suit: kind.slice(-1) as Tile['suit'], rank: Number(kind.slice(0, -1)) }
}
