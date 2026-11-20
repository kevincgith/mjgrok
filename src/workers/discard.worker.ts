import { analyzeDiscards, analyzeNextDraws, type Hand, type TwoStep } from '@mjwaits/shared'

interface Request {
  id: number
  hand: Hand
  meldsNeeded?: number
  discarded?: Record<string, number>
  drawsLeft?: number
}

let latest = 0

self.onmessage = (event: MessageEvent<Request>) => {
  latest = event.data.id
  const id = event.data.id
  const { hand, meldsNeeded, discarded, drawsLeft } = event.data
  setTimeout(() => {
    if (latest !== id) return
    const started = performance.now()
    const options = { meldsNeeded, discarded, drawsLeft, aborted: () => latest !== id }
    const ranked = analyzeDiscards(hand, options)
    if (latest !== id) return
    const nextDraws: TwoStep[] | null = analyzeNextDraws(hand, options)
    if (latest !== id) return
    const elapsedMs = Math.round((performance.now() - started) * 10) / 10
    self.postMessage({ id, ranked, nextDraws, elapsedMs })
  }, 0)
}
