import { analyzeDiscards, type Hand } from '@mjwaits/shared'

interface Request {
  id: number
  hand: Hand
  meldsNeeded?: number
}

let latest = 0

self.onmessage = (event: MessageEvent<Request>) => {
  latest = event.data.id
  const id = event.data.id
  const hand = event.data.hand
  const meldsNeeded = event.data.meldsNeeded
  setTimeout(() => {
    if (latest !== id) return
    const started = performance.now()
    const ranked = analyzeDiscards(hand, { meldsNeeded, aborted: () => latest !== id })
    if (latest !== id) return
    const elapsedMs = Math.round((performance.now() - started) * 10) / 10
    self.postMessage({ id, ranked: ranked.slice(0, 8), elapsedMs })
  }, 0)
}
