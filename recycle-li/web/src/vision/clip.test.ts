import { describe, expect, it } from 'vitest'
import { allItems } from '@/domain/catalog'
import embedsFile from '../../public/data/text_embeds.json'
import { decide, score, type Embeds, type Scored } from './clip'

const embeds = embedsFile as unknown as Embeds
const DIM = embeds.dim // CLIP 512、SigLIP 768（params.json 的 MODEL）
const item = (id: string) => allItems.find((i) => i.id === id)!

describe('text_embeds.json', () => {
  it('has a vector of the model dimension for every item', () => {
    for (const i of allItems) {
      expect(embeds.items[i.id], i.id).toBeDefined()
      expect(embeds.items[i.id].length).toBe(DIM)
    }
    expect(Object.keys(embeds.negatives ?? {}).length).toBeGreaterThan(0)
  })
  it('each item vector ranks itself first (prompts are separable)', () => {
    for (const i of allItems) {
      const s = score(embeds.items[i.id], embeds, allItems)
      expect(s.top[0].item.id, i.id).toBe(i.id)
    }
  })
  it('a negative vector is rejected as "nothing"', () => {
    const s = score(embeds.negatives!._neg_face, embeds, allItems)
    expect(decide(s).kind).toBe('nothing')
  })
})

describe('decide()', () => {
  const mk = (top: [string, number][], neg: number | null = null): Scored => ({
    top: top.map(([id, p]) => ({ item: item(id), p })),
    byCategory: [],
    negative: neg == null ? null : { id: '_neg_room', p: neg },
  })
  it('reveals when candidates share category and steps', () => {
    expect(decide(mk([['pet_bottle', 0.5], ['aluminum_can', 0.3], ['tissue', 0.01]])).kind).toBe('reveal')
  })
  it('asks a clue when categories differ', () => {
    const d = decide(mk([['paper_lunchbox', 0.4], ['tissue', 0.3], ['leftovers', 0.1]]))
    expect(d.kind).toBe('clue')
    if (d.kind === 'clue') expect(d.cands.length).toBe(3)
  })
  it('falls back to picture cards when unsure', () => {
    expect(decide(mk([['pet_bottle', 0.08], ['tissue', 0.07]])).kind).toBe('picker')
  })
  it('says "nothing" when background wins', () => {
    expect(decide(mk([['pet_bottle', 0.2]], 0.6)).kind).toBe('nothing')
  })
})

describe('Smoother and example vectors', () => {
  it('a saved example vector pulls a confused image to the right item', async () => {
    // 模擬：影像向量介於寶特瓶與鋁罐的文字向量中間，原本第一名可能是任一個
    const a = embeds.items.pet_bottle, b = embeds.items.aluminum_can
    const mid = a.map((x, k) => x + b[k])
    const before = score(mid, embeds, allItems)
    const after = score(mid, embeds, allItems, 100, { aluminum_can: [mid.map((x) => x / Math.hypot(...mid))] })
    expect(after.top[0].item.id).toBe('aluminum_can')
    expect(after.top[0].p).toBeGreaterThan(before.top.find((t) => t.item.id === 'aluminum_can')?.p ?? 0)
  })
  it('smoother becomes stable only after the same top twice', async () => {
    const { Smoother } = await import('./clip')
    const sm = new Smoother()
    const s1 = score(embeds.items.pet_bottle, embeds, allItems)
    sm.push(s1)
    expect(sm.current().stable).toBe(false)
    sm.push(s1)
    expect(sm.current().stable).toBe(true)
    expect(sm.current().top?.item.id).toBe('pet_bottle')
    sm.reset()
    expect(sm.current().top).toBeNull()
  })
})

describe('example vector codec (image_protos.json)', () => {
  // 與 scripts/proto-codec.mjs 的 encodeProto 相同
  const encode = (v: number[]) => {
    const m = Math.max(...v.map(Math.abs)) || 1
    const q = new Int8Array(v.map((x) => Math.max(-127, Math.min(127, Math.round((x / m) * 127)))))
    let bin = ''
    for (const b of new Uint8Array(q.buffer)) bin += String.fromCharCode(b)
    return `${m.toFixed(6)}:${btoa(bin)}`
  }
  it('int8 round trip keeps the direction (cos > 0.999)', async () => {
    const { decodeProto } = await import('./clip')
    const v = embeds.items.pet_bottle
    const d = decodeProto(encode(v))
    let dotp = 0
    for (let k = 0; k < v.length; k++) dotp += v[k] * d[k]
    expect(d.length).toBe(DIM)
    expect(dotp).toBeGreaterThan(0.999)
  })
  it('plain arrays still work (old format)', async () => {
    const { decodeProto } = await import('./clip')
    const d = decodeProto([3, 4])
    expect(d[0]).toBeCloseTo(0.6)
    expect(d[1]).toBeCloseTo(0.8)
  })
  it('shipped image_protos.json decodes to unit vectors of the model dimension for known items', async () => {
    const { decodeProtos } = await import('./clip')
    const { existsSync, readFileSync } = await import('node:fs')
    const f = new URL('../../public/data/image_protos.json', import.meta.url)
    if (!existsSync(f)) return
    const protos = decodeProtos(JSON.parse(readFileSync(f, 'utf8')).items)
    const ids = new Set(allItems.map((i) => i.id))
    expect(Object.keys(protos).length).toBeGreaterThan(0)
    for (const [id, list] of Object.entries(protos)) {
      expect(ids.has(id), id).toBe(true)
      expect(list.length).toBeLessThanOrEqual(8)
      for (const v of list) {
        expect(v.length).toBe(DIM)
        expect(Math.hypot(...v)).toBeCloseTo(1, 4)
      }
    }
  })
})

describe('learned class weights (class_weights.json)', () => {
  it('decode to model-dimension vectors near the text vectors, for every item', async () => {
    const { decodeClassWeights } = await import('./clip')
    const { existsSync, readFileSync } = await import('node:fs')
    const f = new URL('../../public/data/class_weights.json', import.meta.url)
    if (!existsSync(f)) return
    const w = decodeClassWeights(JSON.parse(readFileSync(f, 'utf8')).items)
    for (const i of allItems) {
      const v = w[i.id]
      expect(v, i.id).toBeDefined()
      expect(v.length).toBe(DIM)
      // 有正則化拉回文字向量：方向應該還很接近（cos > 0.6）
      const t = embeds.items[i.id]
      let d = 0
      for (let k = 0; k < DIM; k++) d += v[k] * t[k]
      expect(d / Math.hypot(...v), i.id).toBeGreaterThan(0.6)
    }
  })
})
