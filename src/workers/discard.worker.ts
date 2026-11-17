import { analyzeDiscards, type Hand } from '@mjwaits/shared'

interface Request {
  id: number
  hand: Hand
  meldsNeeded?: number
}

self.onmessage = (event: MessageEvent<Request>) => {
  const started = performance.now()
  const ranked = analyzeDiscards(event.data.hand, event.data.meldsNeeded ? { meldsNeeded: event.data.meldsNeeded } : undefined).slice(0, 8)
  const elapsedMs = Math.round((performance.now() - started) * 10) / 10
  self.postMessage({ id: event.data.id, ranked, elapsedMs })
}
