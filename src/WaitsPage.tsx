import { useMemo, useState } from 'react'
import { analyzeDiscards, findWaits, formatNotation, parseNotation, shanten, type Tile } from '@mjwaits/shared'
import { Icon, TileFace } from './ui'

export function WaitsPage() {
  const [tiles, setTiles] = useState<Tile[]>([])
  const [text, setText] = useState('')
  const [sort, setSort] = useState(false)
  const [breakDown, setBreakDown] = useState(false)
  const [toast, setToast] = useState('')
  const hand = { concealed: tiles, declared: [], flowers: [] }
  const result = useMemo(() => findWaits(hand), [tiles])
  const discards = useMemo(() => (tiles.length > 0 && !result.atCheckpoint ? analyzeDiscards(hand).slice(0, 8) : result.atCheckpoint && result.shanten > 0 ? analyzeDiscards(hand).slice(0, 8) : []), [tiles, result.atCheckpoint, result.shanten])
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
          {(sort ? [...tiles].sort((a, b) => formatNotation([a]).localeCompare(formatNotation([b]))) : tiles).map((tile, i) => (
            <TileFace key={`${tile.suit}${tile.rank}${i}`} kind={tile.suit === 'j' ? 'j' : `${tile.rank}${tile.suit}`} onClick={() => sync(tiles.filter((_, j) => j !== i))} />
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
              {w.decompositions.map((d, i) => <p key={i} className="muted">{d.shape}: {d.melds.map((m) => m.tiles.join('')).join(' ')} + {d.pair.join('')}</p>)}
            </div>
          ))}
        </div>
      )}
      {result.shanten < 0 && <div className="card"><h2>Winning hand</h2><p>This hand is already complete.</p></div>}
      {discards.length > 0 && (
        <div className="card">
          <h2>{result.atCheckpoint ? 'Discard efficiency' : 'Discard options'}</h2>
          <p className="muted">Percentages are an estimate over the next self-draws, not an exact probability.</p>
          {discards.map((row) => (
            <p key={row.discard}><b>{row.discard}</b> tenpai {row.tenpaiPercent}% win {row.winPercent}% shanten {row.shanten}</p>
          ))}
        </div>
      )}
      {toast && <div className="toast" onClick={() => setToast('')}>{toast}</div>}
    </section>
  )
}
