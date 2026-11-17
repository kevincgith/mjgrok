import { useEffect, useState } from 'react'
import { CATALOG, type RuleDiff } from '@mjwaits/shared'

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
        </div>
        {shown.slice(0, 40).map((pattern) => (
          <label key={pattern.id} className="row" style={{ justifyContent: 'space-between' }}>
            <span>{pattern.zh} <span className="muted">{pattern.en}</span></span>
            <input style={{ width: 72 }} type="number" value={rules.values?.[pattern.id] as number ?? pattern.value} onChange={(e) => setRules({ ...rules, values: { ...rules.values, [pattern.id]: Number(e.target.value) } })} />
          </label>
        ))}
        {shown.length > 40 && <p className="muted">Showing 40 of {shown.length}. Search to narrow.</p>}
      </div>
    </div>
  )
}
