import { describe, expect, it } from 'vitest'
import { allItems } from '@/domain/catalog'
import { DISPLAY, drawMode, primaryOf, selectDetections } from './pipeline'
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
    Object.assign(TRACKER, { SHOW_P: 0.5, SHOW_P_MIN: 0.1, SHOW_RATIO: 4, KIND_P: 0.8, MAYBE_P: 0.3 })
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
