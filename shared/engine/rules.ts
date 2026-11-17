import { CATALOG, CATALOG_BY_ID, type CatalogPattern, type LadderMode } from './taiCatalog.ts'
import type { HandShape } from './tiles.ts'

export interface RuleDiff {
  name: string
  values?: Record<string, number | number[]>
  ladders?: Record<string, LadderMode>
  addExclusions?: [string, string][]
  removeExclusions?: [string, string][]
  shapes?: Record<string, HandShape[]>
  chicken?: Record<string, boolean>
}

export interface EffectiveRules {
  name: string
  fingerprint: string
  ladderMode: Record<string, LadderMode>
  pattern: (id: string) => CatalogPattern
  excludes: (id: string) => string[]
  tai: (id: string, count: number) => number
  allows: (id: string, shape: HandShape) => boolean
  blocksChicken: (id: string) => boolean
}

export function houseRules(): EffectiveRules {
  return compile({ name: 'House' })
}

export function compile(diff: RuleDiff): EffectiveRules {
  const patterns = new Map<string, CatalogPattern>()
  for (const pattern of CATALOG) {
    const copy: CatalogPattern = { ...pattern, excludes: pattern.excludes.slice(), shapes: pattern.shapes.slice(), aliases: pattern.aliases.slice() }
    const value = diff.values?.[pattern.id]
    if (typeof value === 'number' && pattern.kind !== 'table') {
      if (pattern.kind === 'streak') copy.streak = [value, copy.streak?.[1] ?? 2]
      else copy.value = value
    } else if (Array.isArray(value)) {
      if (pattern.kind === 'streak') copy.streak = [value[0] ?? 1, value[1] ?? 2]
      else copy.table = value.slice()
    }
    if (diff.shapes?.[pattern.id]) copy.shapes = diff.shapes[pattern.id].slice()
    if (diff.chicken && pattern.id in diff.chicken) copy.blocksChicken = diff.chicken[pattern.id]
    patterns.set(pattern.id, copy)
  }
  const removed = new Set((diff.removeExclusions ?? []).map(([a, b]) => `${a}>${b}`))
  const added = diff.addExclusions ?? []
  const ladderMode: Record<string, LadderMode> = { dragons: 'highest', concealed: 'highest', flush: 'highest', ...(diff.ladders ?? {}) }
  const excludes = (id: string): string[] => {
    const pattern = patterns.get(id)
    if (!pattern) return []
    const list = pattern.excludes.filter((target) => !removed.has(`${id}>${target}`))
    if (pattern.ladder && ladderMode[pattern.ladder] !== 'stack') {
      for (const other of patterns.values()) {
        if (other.ladder === pattern.ladder && (other.tier ?? 0) < (pattern.tier ?? 0) && !removed.has(`${id}>${other.id}`)) {
          list.push(other.id)
        }
      }
    }
    for (const [from, to] of added) if (from === id && !list.includes(to)) list.push(to)
    return list
  }
  const tai = (id: string, count: number): number => {
    const pattern = patterns.get(id)
    if (!pattern || count <= 0) return 0
    if (pattern.kind === 'per') return pattern.value * count
    if (pattern.kind === 'flat') return pattern.value > 0 ? pattern.value : 0
    if (pattern.kind === 'table') {
      const table = pattern.table ?? [0]
      const index = Math.min(count, table.length - 1)
      return table[index] ?? 0
    }
    const [first, each] = pattern.streak ?? [1, 2]
    if (first <= 0 && each <= 0) return 0
    return first + (count - 1) * each
  }
  const fingerprint = diff.name === 'House' && !diff.values && !diff.ladders && !diff.addExclusions && !diff.removeExclusions && !diff.shapes && !diff.chicken
    ? 'house'
    : hash(JSON.stringify(diff))
  return {
    name: diff.name,
    fingerprint,
    ladderMode,
    pattern: (id) => patterns.get(id) ?? CATALOG_BY_ID.get(id)!,
    excludes,
    tai,
    allows: (id, shape) => patterns.get(id)?.shapes.includes(shape) ?? false,
    blocksChicken: (id) => patterns.get(id)?.blocksChicken ?? true,
  }
}

function hash(text: string): string {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0).toString(36)
}
