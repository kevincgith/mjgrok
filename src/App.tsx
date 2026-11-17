import { useEffect, useMemo, useState } from 'react'
import { Icon } from './ui'
import { ScoringPage } from './ScoringPage'
import { WaitsPage } from './WaitsPage'
import { DrillsPage } from './DrillsPage'
import { LedgerPage } from './LedgerPage'
import { DicePage } from './DicePage'
import { CreditsPage } from './CreditsPage'

export type Tab = 'scoring' | 'ledger' | 'waits' | 'drills' | 'dice' | 'credits' | 'more'

const wide: { id: Tab; label: string; icon: string }[] = [
  { id: 'scoring', label: 'Scoring', icon: 'scoring' },
  { id: 'ledger', label: 'Ledger', icon: 'ledger' },
  { id: 'drills', label: 'Drills', icon: 'drills' },
  { id: 'waits', label: 'Waits', icon: 'waits' },
  { id: 'dice', label: 'Dice', icon: 'dice' },
]

export function App() {
  const [tab, setTab] = useState<Tab>('scoring')
  useEffect(() => {
    const apply = () => {
      const params = new URLSearchParams(location.hash.replace(/^#/, ''))
      if (location.hash === '#ledger') setTab('ledger')
      else if (params.get('w')) setTab('waits')
      else if (params.get('t') || params.get('r')) setTab('scoring')
    }
    apply()
    window.addEventListener('hashchange', apply)
    return () => window.removeEventListener('hashchange', apply)
  }, [])
  const [more, setMore] = useState(false)
  const [wideScreen, setWide] = useState(false)
  useEffect(() => {
    const query = window.matchMedia('(min-width: 701px)')
    const apply = () => setWide(query.matches)
    apply()
    query.addEventListener('change', apply)
    return () => query.removeEventListener('change', apply)
  }, [])
  const page = useMemo(() => {
    if (tab === 'ledger') return <LedgerPage />
    if (tab === 'waits') return <WaitsPage />
    if (tab === 'drills') return <DrillsPage />
    if (tab === 'dice') return <DicePage />
    if (tab === 'credits') return <CreditsPage />
    return <ScoringPage />
  }, [tab])
  return (
    <>
      <div className="page">
        <header className="head">
          <div className="logo" aria-hidden="true">
            <svg className="logo-mark" viewBox="0 0 44 44" aria-hidden="true">
              <rect x="7" y="8" width="16" height="22" rx="2.5" fill="rgba(255,255,255,0.28)" stroke="#fff" strokeWidth="1.4" />
              <rect x="18" y="14" width="16" height="22" rx="2.5" fill="rgba(255,255,255,0.72)" stroke="#fff" strokeWidth="1.4" />
            </svg>
          </div>
          <div>
            <h1>MJWaits</h1>
            <p>HKTW mahjong scoring, waits & trainer</p>
          </div>
        </header>
        <nav className="wide-nav seg" aria-label="Sections">
          {wide.map((item) => (
            <button key={item.id} className={tab === item.id ? 'on' : ''} onClick={() => setTab(item.id)}>
              <Icon name={item.icon} size={20} /> {item.label}
            </button>
          ))}
        </nav>
        {page}
        <footer className="footer">
          <Icon name="github" size={16} />
          <a href="https://github.com/kevincgith/mjgrok">Made by Kevin Chan</a>
          <button onClick={() => setTab('credits')}>Credits</button>
        </footer>
      </div>
      <nav className="phone-nav" aria-label="Primary">
        <button className={tab === 'scoring' ? 'on' : ''} onClick={() => setTab('scoring')}><Icon name="scoring" /><span>Scoring</span></button>
        <button className={tab === 'ledger' ? 'on' : ''} onClick={() => setTab('ledger')}><Icon name="ledger" /><span>Ledger</span></button>
        <button className={tab === 'waits' ? 'on' : ''} onClick={() => setTab('waits')}><Icon name="waits" /><span>Waits</span></button>
        <button className={more ? 'on' : ''} onClick={() => setMore(true)}><Icon name="more" /><span>More</span></button>
      </nav>
      {more && !wideScreen && (
        <div className="sheet-back" onClick={() => setMore(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <h2>More</h2>
            <div className="row">
              <button onClick={() => { setTab('drills'); setMore(false) }}>Drills</button>
              <button onClick={() => { setTab('dice'); setMore(false) }}>Dice</button>
              <button onClick={() => { setTab('credits'); setMore(false) }}>Credits</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
