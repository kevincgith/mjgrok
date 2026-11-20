import { useEffect, useState } from 'react'
import type { DiscardAnalysis, Hand, TwoStep } from '@mjwaits/shared'

interface Answer {
  rows: DiscardAnalysis[]
  nextDraws: TwoStep[] | null
  elapsedMs: number
  pending: boolean
  error: string
}

let worker: Worker | null = null
let seq = 0

function getWorker(): Worker | null {
  if (typeof Worker === 'undefined') return null
  if (!worker) worker = new Worker(new URL('../workers/discard.worker.ts', import.meta.url), { type: 'module' })
  return worker
}

export function useDiscards(hand: Hand, enabled: boolean, meldsNeeded?: number, discarded?: Record<string, number>): Answer {
  const [answer, setAnswer] = useState<Answer>({ rows: [], nextDraws: null, elapsedMs: 0, pending: false, error: '' })
  const key = JSON.stringify({ hand, meldsNeeded, discarded, enabled })
  useEffect(() => {
    if (!enabled) {
      setAnswer({ rows: [], nextDraws: null, elapsedMs: 0, pending: false, error: '' })
      return
    }
    const id = ++seq
    setAnswer((prev) => ({ ...prev, pending: true, error: '' }))
    const current = getWorker()
    if (!current) {
      setAnswer({ rows: [], nextDraws: null, elapsedMs: 0, pending: false, error: 'Discard worker is unavailable in this browser.' })
      return
    }
    const onMessage = (event: MessageEvent<{ id: number; ranked: DiscardAnalysis[]; nextDraws: TwoStep[] | null; elapsedMs: number }>) => {
      if (event.data.id !== id) return
      setAnswer({ rows: event.data.ranked, nextDraws: event.data.nextDraws, elapsedMs: event.data.elapsedMs, pending: false, error: '' })
    }
    const onError = () => {
      if (seq !== id) return
      setAnswer({ rows: [], nextDraws: null, elapsedMs: 0, pending: false, error: 'Discard analysis failed.' })
    }
    current.addEventListener('message', onMessage)
    current.addEventListener('error', onError)
    current.postMessage({ id, hand, meldsNeeded, discarded })
    return () => {
      current.removeEventListener('message', onMessage)
      current.removeEventListener('error', onError)
    }
  }, [key])
  return answer
}
