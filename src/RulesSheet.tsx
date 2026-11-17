import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { CATALOG, PATTERN_EXAMPLES, parseNotation, type RuleDiff } from '@mjwaits/shared'
import { TileFace } from './ui'

const KEY = 'mjwaits.taiRuleSets'

export function loadRules(): RuleDiff {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { name: 'House' }
    const parsed = JSON.parse(raw) as RuleDiff
    return parsed.name ? parsed : { name: 'House' }
  } catch {
    return { name: 'House' }
  }
}

export function RulesSheet({ onClose, onChange }: { onClose: () => void; onChange: (rules: RuleDiff) => void }) {
  const [rules, setRules] = useState<RuleDiff>(loadRules)
  const [query, setQuery] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const [edge, setEdge] = useState('base')
  const [qr, setQr] = useState('')
  useEffect(() => { localStorage.setItem(KEY, JSON.stringify(rules)); onChange(rules) }, [rules, onChange])
  const shown = CATALOG.filter((p) => `${p.zh}${p.en}${p.aliases.join('')}`.toLowerCase().includes(query.toLowerCase()))
  return (
    <div className="sheet-back" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <h2>設定 <span>Tai rules</span></h2>
        <p className="muted">The house list is the default. A saved set stores only values you change. 0 turns a pattern off. Ladder families keep only the highest tier unless you stack them.</p>
        <input value={rules.name} aria-label="Rule set name" onChange={(e) => setRules({ ...rules, name: e.target.value || 'House' })} />
        <input value={query} placeholder="Search" aria-label="Search patterns" onChange={(e) => setQuery(e.target.value)} />
        <div className="row">
          <button className={rules.ladders?.dragons === 'stack' ? 'on' : ''} onClick={() => setRules({ ...rules, ladders: { ...rules.ladders, dragons: rules.ladders?.dragons === 'stack' ? 'highest' : 'stack' } })}>三元 stack</button>
          <button className={rules.ladders?.concealed === 'stack' ? 'on' : ''} onClick={() => setRules({ ...rules, ladders: { ...rules.ladders, concealed: rules.ladders?.concealed === 'stack' ? 'highest' : 'stack' } })}>暗刻 stack</button>
          <button className={rules.ladders?.flush === 'stack' ? 'on' : ''} onClick={() => setRules({ ...rules, ladders: { ...rules.ladders, flush: rules.ladders?.flush === 'stack' ? 'highest' : 'stack' } })}>一色 stack</button>
          <button onClick={() => setRules({ name: 'House' })}>House</button>
          <button onClick={() => { const blob = new Blob([JSON.stringify(rules, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `${rules.name || 'rules'}.json`; a.click(); URL.revokeObjectURL(url) }}>Export</button>
          <button onClick={() => { const hash = `r=${encodeURIComponent(JSON.stringify(rules))}`; const url = `${location.origin}${location.pathname}#${hash}`; navigator.clipboard?.writeText(url); QRCode.toDataURL(url, { margin: 1, width: 220 }).then(setQr).catch(() => setQr('')) }}>Copy link + QR</button>
          <button onClick={() => window.print()}>Print</button>
        </div>
        <input type="file" accept="application/json" aria-label="Import rules" onChange={(e) => {
          const file = e.target.files?.[0]
          if (!file) return
          file.text().then((text) => {
            const parsed = JSON.parse(text) as RuleDiff
            if (!parsed || typeof parsed !== 'object' || !parsed.name) throw new Error('Rule file needs a name')
            const current = loadRules()
            if (current.name === parsed.name && JSON.stringify(current) !== JSON.stringify(parsed)) parsed.name = `${parsed.name} 2`
            setRules(parsed)
          }).catch(() => setQuery('Import failed'))
        }} />
        {shown.slice(0, 40).map((pattern) => {
          const shapes = rules.shapes?.[pattern.id] ?? pattern.shapes
          const chicken = rules.chicken?.[pattern.id] ?? pattern.blocksChicken
          const removed = new Set((rules.removeExclusions ?? []).filter(([from]) => from === pattern.id).map(([, to]) => to))
          const added = (rules.addExclusions ?? []).filter(([from]) => from === pattern.id).map(([, to]) => to)
          const edges = [...pattern.excludes.filter((id) => !removed.has(id)), ...added]
          return (
            <div key={pattern.id}>
              <label className="row" style={{ justifyContent: 'space-between' }}>
                <button type="button" onClick={() => setOpenId(openId === pattern.id ? null : pattern.id)}>{pattern.zh} <span className="muted">{pattern.en}</span></button>
                <input style={{ width: 72 }} type="number" aria-label={`${pattern.zh} value`} value={rules.values?.[pattern.id] as number ?? pattern.value} onChange={(e) => setRules({ ...rules, values: { ...rules.values, [pattern.id]: Number(e.target.value) } })} />
              </label>
              {openId === pattern.id && (
                <div className="card">
                  <div className="row">
                    {(['normal', 'orphans', 'unrelated', 'eight'] as const).map((shape) => (
                      <button key={shape} className={shapes.includes(shape) ? 'on' : ''} onClick={() => {
                        const next = shapes.includes(shape) ? shapes.filter((item) => item !== shape) : [...shapes, shape]
                        setRules({ ...rules, shapes: { ...rules.shapes, [pattern.id]: next } })
                      }}>{shape}</button>
                    ))}
                    <button className={chicken ? 'on' : ''} onClick={() => setRules({ ...rules, chicken: { ...rules.chicken, [pattern.id]: !chicken } })}>{chicken ? 'Blocks chicken' : 'Chicken allowed'}</button>
                  </div>
                  <p className="muted">Replaces {edges.join(', ') || 'nothing'}</p>
                  <div className="row">
                    <select aria-label="Exclusion target" value={edge} onChange={(e) => setEdge(e.target.value)}>
                      {CATALOG.map((item) => <option key={item.id} value={item.id}>{item.zh}</option>)}
                    </select>
                    <button onClick={() => setRules({ ...rules, addExclusions: [...(rules.addExclusions ?? []), [pattern.id, edge]] })}>Add edge</button>
                    {edges.map((target) => <button key={target} onClick={() => setRules({ ...rules, removeExclusions: [...(rules.removeExclusions ?? []), [pattern.id, target]] })}>Drop {target}</button>)}
                  </div>
                </div>
              )}
            </div>
          )
        })}
        {qr && <img src={qr} alt="Rule link QR" width={220} height={220} />}
        <article className="rules-print">
          <h1>{rules.name} reference</h1>
          <p>Page one is the value list. The next page is how a score is chosen. Each family after that shows the example tiles, the value, and what the pattern replaces.</p>
          <section>
            <h2>How a score is chosen</h2>
            <p>The total is the best decomposition. When eight pairs and an ordinary reading both exist, both are added. A bigger pattern drops the smaller ones it lists. Open and concealed versions are separate rows. A value of 0 turns that pattern off and stops it from suppressing anything. 封頂 limits the farn typed into the ledger. It does not limit the payment.</p>
            <p>Changes in this set: {rules.values ? Object.entries(rules.values).map(([id, value]) => `${id} ${value}`).join(', ') : 'none'}.</p>
          </section>
          {Array.from(new Set(CATALOG.map((p) => p.family))).map((family) => (
            <section key={family}>
              <h2>{family}</h2>
              {CATALOG.filter((p) => p.family === family).map((p) => {
                const example = PATTERN_EXAMPLES[p.id] ?? ''
                let kinds: string[] = []
                try { kinds = parseNotation(example).map((tile) => tile.suit === 'j' ? 'j' : `${tile.rank}${tile.suit}`) } catch { kinds = [] }
                return (
                  <div key={p.id} className="card">
                    <p><b>{p.zh}</b> {p.en}</p>
                    <p>{p.shapes.join(', ')} · value {String(rules.values?.[p.id] ?? p.value)} · replaces {p.excludes.join(', ') || 'nothing'}</p>
                    <p className="muted">{example}</p>
                    <div className="tiles">{kinds.slice(0, 17).map((kind, index) => <TileFace key={`${kind}${index}`} kind={kind} className="small" />)}</div>
                  </div>
                )
              })}
            </section>
          ))}
        </article>
        {shown.length > 40 && <p className="muted">Showing 40 of {shown.length}. Search to narrow.</p>}
      </div>
    </div>
  )
}
