import { describe, expect, it } from 'vitest'
import { allItems } from '@/domain/catalog'
import { chooseBoxes, DISPLAY, drawMode, primaryOf, selectDetections } from './pipeline'
import { observe, Tracker, TRACKER } from './tracker'

const d = (x: number, score: number, label = 'bottle') => ({ x, y: 100, w: 120, h: 200, label, score })

describe('which boxes are drawn', () => {
  it('keeps only confident detections, at most MAX_BOXES', () => {
    const out = selectDetections([d(0, 0.8), d(200, 0.5), d(400, 0.2), d(600, 0.14), d(800, 0.4), d(1000, 0.35)])
    expect(out.length).toBe(DISPLAY.MAX_BOXES)
    expect(out.every((x) => x.score >= DISPLAY.MIN_SCORE)).toBe(true)
  })
  it('furniture behind a clear cup is background', () => {
    const out = selectDetections([d(0, 0.7, 'dining table'), d(200, 0.4, 'cup')])
    expect(out.map((x) => x.label)).toEqual(['cup'])
  })
  it('boxes a chair or fridge when nothing smaller is in view', () => {
    expect(selectDetections([d(0, 0.55, 'chair'), d(300, 0.5, 'couch')]).map((x) => x.label)).toEqual(['chair'])
    expect(selectDetections([d(0, 0.8, 'refrigerator'), d(300, 0.18, 'cell phone')]).map((x) => x.label)).toEqual(['refrigerator'])
  })
  it('a weak cup still wins over an unsure table', () => {
    expect(selectDetections([d(0, 0.5, 'dining table'), d(200, 0.2, 'cup')]).map((x) => x.label)).toEqual(['cup'])
  })
  it('ignores very weak furniture boxes', () => {
    expect(selectDetections([d(0, 0.3, 'chair')])).toEqual([])
  })
  it('falls back to the single best weak box when nothing is confident', () => {
    const out = selectDetections([d(0, 0.2), d(200, 0.17), d(400, 0.13)])
    expect(out.map((x) => x.score)).toEqual([0.2])
  })
  it('unsure boxes: only the primary one is drawn, without text', () => {
    Object.assign(TRACKER, { SHOW_P: 0.5, SHOW_P_MIN: 0.1, SHOW_RATIO: 4, KIND_P: 0.8, MAYBE_P: 0.3, FAST_P: 1.01, FAST_P_COMMON: 1.01, FAST_P_AGREE: 1.01 })
    const tr = new Tracker()
    const big = { x: 300, y: 100, w: 400, h: 500, label: 'bottle', score: 0.7 }
    const small = { x: 0, y: 0, w: 80, h: 80, label: 'cup', score: 0.4 }
    tr.update([big, small]); tr.update([big, small])
    const [t1, t2] = tr.visible()
    const weak = [{ item: allItems[0], p: 0.1 }, { item: allItems[5], p: 0.09 }]
    for (const t of [t1, t2]) for (let k = 0; k < 2; k++) observe(t, weak, 0)
    const primary = primaryOf(tr.visible(), 1000, 800)
    expect(primary?.w).toBe(400)
    expect(drawMode(primary!, true)).toBe('silent')
    expect(drawMode(tr.visible().find((t) => t !== primary)!, false)).toBe('hide')
  })
})

describe('main box does not flip between two similar boxes', () => {
  it('keeps the previous main box unless another is clearly better', () => {
    const tr = new Tracker()
    const a = { x: 100, y: 100, w: 300, h: 400, label: 'bottle', score: 0.7 }
    const b = { x: 520, y: 100, w: 310, h: 400, label: 'cup', score: 0.7 }
    tr.update([a, b]); tr.update([a, b])
    const [ta, tb] = tr.visible()
    expect(primaryOf([ta, tb], 1000, 800, ta)).toBe(ta) // b 只大一點點
    expect(primaryOf([ta, tb], 1000, 800, null)).not.toBeNull()
    const big = { x: 300, y: 150, w: 500, h: 550, label: 'cup', score: 0.8 }
    const tr2 = new Tracker(); tr2.update([a, big]); tr2.update([a, big])
    const [ta2, tbig] = tr2.visible()
    expect(primaryOf([ta2, tbig], 1000, 800, ta2)).toBe(tbig) // 明顯比較好才換
  })
})

describe('something filling the frame (center fallback)', () => {
  it('uses the middle of the frame when nothing else is boxed', () => {
    const out = chooseBoxes([], () => null, 1000, 800)
    expect(out).toHaveLength(1)
    expect(out[0].center).toBe(true)
    expect(out[0].w).toBeGreaterThan(700)
  })
  it('prefers real detections and salient boxes', () => {
    expect(chooseBoxes([d(0, 0.6)], () => null, 1000, 800)[0].center).toBeUndefined()
    const sb = { x: 300, y: 200, w: 200, h: 300, label: '', score: 0.5 }
    expect(chooseBoxes([], () => sb, 1000, 800)[0]).toBe(sb)
  })
  it('draws nothing for the center box until it recognises something', () => {
    Object.assign(TRACKER, { SHOW_P: 0.5, SHOW_P_MIN: 0.1, SHOW_RATIO: 4, KIND_P: 0.9, MAYBE_P: 0.4, FAST_P: 1.01, FAST_P_COMMON: 1.01, FAST_P_AGREE: 1.01 })
    const tr = new Tracker()
    const [c] = chooseBoxes([], () => null, 1000, 800)
    tr.update([c]); tr.update([c])
    const t = tr.visible()[0]
    for (let k = 0; k < 2; k++) observe(t, [{ item: allItems[0], p: 0.1 }, { item: allItems[5], p: 0.09 }], 0.6)
    expect(drawMode(t, true)).toBe('hide')
    for (let k = 0; k < 4; k++) observe(t, [{ item: allItems[0], p: 0.9 }], 0)
    expect(drawMode(t, true)).toBe('item')
  })
})
