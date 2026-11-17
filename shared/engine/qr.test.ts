import { describe, expect, it } from 'vitest'
import QRCode from 'qrcode'
import { PNG } from 'pngjs'
import jsQR from 'jsqr'
import { compile } from './rules.ts'

describe('rule link QR', () => {
  it('decodes to the same share URL and the imported set keeps its fingerprint', async () => {
    const diff = { name: 'Round trip', values: { base: 7, 'right-round': 2 } }
    const url = `https://example.test/mjgrok/#r=${encodeURIComponent(JSON.stringify(diff))}`
    const png = PNG.sync.read(await QRCode.toBuffer(url, { margin: 2, errorCorrectionLevel: 'M', width: 320 }))
    const decoded = jsQR(new Uint8ClampedArray(png.data), png.width, png.height)
    expect(decoded?.data).toBe(url)
    const parsed = JSON.parse(decodeURIComponent(new URL(decoded!.data).hash.slice(3))) as typeof diff
    expect(parsed.name).toBe('Round trip')
    expect(compile(parsed).fingerprint).toBe(compile(diff).fingerprint)
    expect(compile(parsed).fingerprint).not.toBe('house')
  })
})
