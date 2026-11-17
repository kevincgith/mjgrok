import { useRef, type ButtonHTMLAttributes, type ReactNode } from 'react'

const base = import.meta.env.BASE_URL

export function tileFile(kind: string): string {
  if (kind === 'j') return 'joker'
  const suit = kind.slice(-1)
  const rank = kind.slice(0, -1)
  if (suit === 'f') return `flower${rank}`
  if (suit === 's') return `season${rank}`
  return `${suit}${rank}`
}

export function TileFace({ kind, className = '', win = false, onClick, onHold, label }: {
  kind: string
  className?: string
  win?: boolean
  onClick?: () => void
  onHold?: () => void
  label?: string
}) {
  const timer = useRef<number | null>(null)
  const props: ButtonHTMLAttributes<HTMLButtonElement> = {
    className: `tile ${className} ${win ? 'win' : ''} ${kind === 'j' ? 'joker' : ''}`,
    type: 'button',
    'aria-label': label ?? kind,
    onClick,
    onPointerDown: () => {
      if (!onHold) return
      timer.current = window.setTimeout(() => onHold(), 460)
    },
    onPointerUp: () => { if (timer.current) window.clearTimeout(timer.current) },
    onPointerLeave: () => { if (timer.current) window.clearTimeout(timer.current) },
  }
  return (
    <button {...props}>
      <img src={`${base}tiles/${tileFile(kind)}.svg`} alt="" />
    </button>
  )
}

const paths: Record<string, ReactNode> = {
  scoring: <path d="M4 7h16M4 12h16M4 17h10" />,
  ledger: <path d="M5 4h14v16H5zM8 8h8M8 12h8M8 16h5" />,
  waits: <path d="M12 4v16M5 8h14M7 16h10" />,
  drills: <path d="M5 19l4-8 3 5 3-9 4 12" />,
  dice: <path d="M5 5h6v6H5zM13 5h6v6h-6zM5 13h6v6H5zM15 15h.1M15 18h.1M18 15h.1" />,
  more: <path d="M6 12h.1M12 12h.1M18 12h.1" />,
  reset: <path d="M4 12a8 8 0 1 0 2.5-5.8M4 4v5h5" />,
  share: <path d="M12 4v10M8 8l4-4 4 4M6 14v4h12v-4" />,
  undo: <path d="M8 8H4v4M4 8l6 6a6 6 0 1 0 1.5-8.5" />,
  redo: <path d="M16 8h4v4M20 8l-6 6a6 6 0 1 1-1.5-8.5" />,
  settings: <path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM4 12h2M18 12h2M12 4v2M12 18v2" />,
  best: <path d="M7 11V6h2v5M15 11V6h2v5M8 14c1 2 7 2 8 0M6 11h12v2a6 6 0 0 1-12 0z" />,
  worst: <path d="M7 10V5h2v5M15 10V5h2v5M8 16c1-2 7-2 8 0M6 10h12v2a6 6 0 0 1-12 0z" />,
  github: <path d="M9 18c-4 1-4-2-6-2m12 4v-3a3 3 0 0 0-.8-2.3c2.7-.3 5.5-1.3 5.5-6A4.7 4.7 0 0 0 18 5.3 4.4 4.4 0 0 0 17.9 2S16.7 1.7 14 3.5a12 12 0 0 0-8 0C3.3 1.7 2.1 2 2.1 2A4.4 4.4 0 0 0 2 5.3 4.7 4.7 0 0 0 .3 8.7c0 4.6 2.8 5.6 5.5 6A3 3 0 0 0 5 17.2V21" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
}

export function Icon({ name, size = 22 }: { name: keyof typeof paths | string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name] ?? paths.more}
    </svg>
  )
}

export function seg(current: string, value: string) {
  return current === value ? 'on' : ''
}
