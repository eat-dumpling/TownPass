import { describe, expect, it } from 'vitest'
import { allItems } from '@/domain/catalog'
import embedsFile from '../../public/data/text_embeds.json'
import { answerLevel, observe, rankedOf, Tracker, TRACKER } from './tracker'
import { logPrior } from './prior'
import { score, type Embeds } from './clip'

const item = (id: string) => allItems.find((i) => i.id === id)!
const det = (x: number, label = 'bottle', score = 0.8) => ({ x, y: 100, w: 100, h: 200, label, score })

describe('Tracker', () => {
  it('keeps the same id across frames and smooths the box', () => {
    const tr = new Tracker()
    tr.update([det(100)])
    tr.update([det(110)])
    const [t] = tr.visible()
    expect(t.id).toBe(1)
    expect(t.x).toBeGreaterThan(100)
    expect(t.x).toBeLessThan(110) // 平滑：不會直接跳到新位置
  })
  it('survives short misses and drops after MAX_MISSES', () => {
    const tr = new Tracker()
    tr.update([det(100)]); tr.update([det(100)])
    for (let k = 0; k < TRACKER.MAX_MISSES; k++) tr.update([])
    expect(tr.tracks.length).toBe(1)
    tr.update([])
    expect(tr.tracks.length).toBe(0)
  })
  it('tracks two objects separately', () => {
    const tr = new Tracker()
    tr.update([det(0), det(400, 'cup')]); tr.update([det(5), det(405, 'cup')])
    expect(tr.visible().map((t) => t.coco).sort()).toEqual(['bottle', 'cup'])
  })
  it('needs two hits before showing a box', () => {
    const tr = new Tracker()
    tr.update([det(100)])
    expect(tr.visible().length).toBe(0)
  })
})

describe('label hysteresis', () => {
  // 門檻固定在測試裡，不受 tune.mjs 寫回的 params.json 影響
  Object.assign(TRACKER, { SHOW_P: 0.3, SHOW_P_MIN: 0.12, SHOW_RATIO: 1.6, KIND_P: 0.6, MAYBE_P: 0.3, FAST_P: 1.01, FAST_P_COMMON: 1.01, FAST_P_AGREE: 1.01 })
  const tr = new Tracker()
  tr.update([det(100)]); tr.update([det(100)])
  const t = tr.visible()[0]
  it('shows a label only after two consistent observations', () => {
    observe(t, [{ item: item('pet_bottle'), p: 0.6 }, { item: item('glass_bottle'), p: 0.2 }], 0)
    expect(t.label).toBeNull()
    observe(t, [{ item: item('pet_bottle'), p: 0.55 }, { item: item('glass_bottle'), p: 0.25 }], 0)
    expect(t.label?.id).toBe('pet_bottle')
  })
  it('does not flip on a single contrary frame', () => {
    observe(t, [{ item: item('glass_bottle'), p: 0.9 }, { item: item('pet_bottle'), p: 0.05 }], 0)
    expect(t.label?.id).toBe('pet_bottle')
  })
  it('switches after the challenger wins repeatedly', () => {
    for (let k = 0; k < 4; k++) observe(t, [{ item: item('glass_bottle'), p: 0.9 }, { item: item('pet_bottle'), p: 0.05 }], 0)
    expect(t.label?.id).toBe('glass_bottle')
    expect(rankedOf(t)[0].item.id).toBe('glass_bottle')
  })
})

describe('detector prior', () => {
  const embeds = embedsFile as unknown as Embeds
  it('a "bottle" box favours bottle items over a look-alike cup', () => {
    // 介於寶特瓶與手搖杯中間的影像向量
    const a = embeds.items.pet_bottle, b = embeds.items.bubble_tea_cup
    const mid = a.map((x, k) => x + b[k])
    const withPrior = score(mid, embeds, allItems, 100, {}, logPrior('bottle'))
    const withCup = score(mid, embeds, allItems, 100, {}, logPrior('cup'))
    expect(withPrior.top[0].item.id).toBe('pet_bottle')
    expect(withCup.top[0].item.id).toBe('bubble_tea_cup')
  })
  it('unknown detector classes add no prior', () => {
    expect(logPrior('airplane')).toBeNull()
    expect(logPrior(null)).toBeNull()
  })
})

describe('answer levels (abstain when unsure)', () => {
  Object.assign(TRACKER, { SHOW_P: 0.5, SHOW_P_MIN: 0.1, SHOW_RATIO: 4, KIND_P: 0.6, MAYBE_P: 0.3, FAST_P: 1.01, FAST_P_COMMON: 1.01, FAST_P_AGREE: 1.01 })
  const mk = () => { const tr = new Tracker(); tr.update([det(100)]); tr.update([det(100)]); return tr.visible()[0] }
  it('names the item when one item clearly wins', () => {
    const t = mk()
    for (let k = 0; k < 2; k++) observe(t, [{ item: item('pet_bottle'), p: 0.7 }, { item: item('glass_bottle'), p: 0.1 }], 0)
    expect(answerLevel(t)).toBe('item')
  })
  it('says only the bin when items are split but the bin is clear', () => {
    const t = mk()
    // 寶特瓶、布丁杯、塑膠製品都是塑膠類，各 0.25 左右
    for (let k = 0; k < 2; k++) observe(t, [{ item: item('pet_bottle'), p: 0.26 }, { item: item('pudding_cup'), p: 0.24 }, { item: item('plastic_misc'), p: 0.22 }, { item: item('tissue'), p: 0.05 }], 0)
    expect(answerLevel(t)).toBe('kind')
    expect(t.kind).toBe('plastic')
  })
  it('says "maybe X?" when the top guess is medium', () => {
    const t = mk()
    for (let k = 0; k < 2; k++) observe(t, [{ item: item('paper_cup'), p: 0.4 }, { item: item('tissue'), p: 0.2 }, { item: item('leftovers'), p: 0.15 }], 0)
    expect(answerLevel(t)).toBe('maybe')
    expect(t.guess?.id).toBe('paper_cup')
  })
  it('does not answer when everything is unclear', () => {
    const t = mk()
    for (let k = 0; k < 2; k++) observe(t, [{ item: item('pet_bottle'), p: 0.2 }, { item: item('tissue'), p: 0.18 }, { item: item('leftovers'), p: 0.15 }], 0)
    expect(answerLevel(t)).toBe('unsure')
  })
})

describe('fast answer (first look)', () => {
  const fresh = (label: string) => { const tr = new Tracker(); tr.update([det(100, label)]); tr.update([det(100, label)]); return tr.visible()[0] }
  it('names a paper cup on the first look when the detector also says cup', () => {
    Object.assign(TRACKER, { SHOW_P: 0.6, SHOW_P_MIN: 0.25, SHOW_RATIO: 4, FAST_P: 0.9, FAST_P_COMMON: 0.9, FAST_P_AGREE: 0.6 })
    const t = fresh('cup')
    observe(t, [{ item: item('paper_cup'), p: 0.7 }, { item: item('pudding_cup'), p: 0.1 }], 0)
    expect(t.label?.id).toBe('paper_cup')
    expect(t.fast).toBe(true)
    expect(answerLevel(t)).toBe('item')
  })
  it('waits for a second look when the detector disagrees and the model is only fairly sure', () => {
    const t = fresh('cell phone')
    observe(t, [{ item: item('paper_cup'), p: 0.7 }, { item: item('pudding_cup'), p: 0.1 }], 0)
    expect(t.label).toBeNull()
    expect(answerLevel(t)).toBe('unsure')
  })
  it('answers on the first look without the detector only when very sure', () => {
    const t = fresh('cell phone')
    observe(t, [{ item: item('paper_cup'), p: 0.93 }, { item: item('pudding_cup'), p: 0.02 }], 0)
    expect(t.label?.id).toBe('paper_cup')
  })
  it('never answers fast when it looks more like background', () => {
    const t = fresh('cup')
    observe(t, [{ item: item('paper_cup'), p: 0.7 }], 0.8)
    expect(t.label).toBeNull()
  })
})

describe('stable text (hysteresis)', () => {
  const fresh = () => { const tr = new Tracker(); tr.update([det(100, 'cell phone')]); tr.update([det(100, 'cell phone')]); return tr.visible()[0] }
  const P = (id: string, p: number) => ({ item: item(id), p })
  it('keeps "maybe X?" when the probability dips just under the threshold', () => {
    Object.assign(TRACKER, { SHOW_P: 0.9, SHOW_P_MIN: 0.8, SHOW_RATIO: 9, KIND_P: 0.95, MAYBE_P: 0.4, FAST_P: 1.01, FAST_P_COMMON: 1.01, FAST_P_AGREE: 1.01, STICKY: 0.8 })
    const t = fresh()
    for (let k = 0; k < 2; k++) observe(t, [P('paper_cup', 0.45), P('tissue', 0.2)], 0)
    expect(answerLevel(t)).toBe('maybe')
    observe(t, [P('paper_cup', 0.25), P('tissue', 0.2)], 0) // 平均 0.383：低於 0.4，但還在 0.32（0.4 × 0.8）以上
    expect(answerLevel(t)).toBe('maybe')
    expect(t.guess?.id).toBe('paper_cup')
    for (let k = 0; k < 4; k++) observe(t, [P('paper_cup', 0.1), P('tissue', 0.1)], 0)
    expect(answerLevel(t)).toBe('unsure')
  })
  it('does not swap "maybe A?" for "maybe B?" when B is only slightly higher', () => {
    const t = fresh()
    for (let k = 0; k < 2; k++) observe(t, [P('paper_cup', 0.45), P('pudding_cup', 0.3)], 0)
    expect(t.guess?.id).toBe('paper_cup')
    observe(t, [P('pudding_cup', 0.62), P('paper_cup', 0.3)], 0) // B 平均 0.41 vs A 0.4：差距太小
    expect(t.guess?.id).toBe('paper_cup')
  })
})

describe('re-identification after a short detection gap', () => {
  it('a box that reappears in the same place keeps its name', () => {
    Object.assign(TRACKER, { SHOW_P: 0.3, SHOW_P_MIN: 0.12, SHOW_RATIO: 1.6, FAST_P: 1.01, FAST_P_COMMON: 1.01, FAST_P_AGREE: 1.01 })
    const tr = new Tracker()
    tr.update([det(100)]); tr.update([det(100)])
    const t = tr.visible()[0]
    for (let k = 0; k < 2; k++) observe(t, [{ item: item('pet_bottle'), p: 0.7 }, { item: item('glass_bottle'), p: 0.1 }], 0)
    expect(t.label?.id).toBe('pet_bottle')
    for (let k = 0; k <= TRACKER.MAX_MISSES; k++) tr.update([]) // 偵測器漏框太久 → 被刪掉
    expect(tr.tracks.length).toBe(0)
    tr.update([det(110)]) // 同一個位置又出現
    const back = tr.visible()[0]
    expect(back?.label?.id).toBe('pet_bottle')
    expect(back.id).toBe(t.id)
    expect(answerLevel(back)).toBe('item')
  })
  it('does not revive after a long time or in a different place', () => {
    const tr = new Tracker()
    tr.update([det(100)]); tr.update([det(100)])
    observe(tr.visible()[0], [{ item: item('pet_bottle'), p: 0.7 }], 0)
    for (let k = 0; k <= TRACKER.MAX_MISSES + TRACKER.REVIVE_FRAMES + 1; k++) tr.update([])
    tr.update([det(100)])
    expect(tr.tracks[0].obs).toBe(0)
    const tr2 = new Tracker()
    tr2.update([det(100)]); tr2.update([det(100)])
    observe(tr2.visible()[0], [{ item: item('pet_bottle'), p: 0.7 }], 0)
    for (let k = 0; k <= TRACKER.MAX_MISSES; k++) tr2.update([])
    tr2.update([det(700)])
    expect(tr2.tracks[0].obs).toBe(0)
  })
})

describe('content change and common items', () => {
  const fresh = (label = 'cell phone') => { const tr = new Tracker(); tr.update([det(100, label)]); tr.update([det(100, label)]); return tr.visible()[0] }
  const unit = (i: number) => { const v = new Array(8).fill(0); v[i] = 1; return v }
  it('starts over when the thing inside the box changes', () => {
    Object.assign(TRACKER, { SHOW_P: 0.3, SHOW_P_MIN: 0.12, SHOW_RATIO: 1.6, FAST_P: 1.01, FAST_P_COMMON: 1.01, FAST_P_AGREE: 1.01, RESET_COS: 0.7 })
    const t = fresh()
    for (let k = 0; k < 2; k++) observe(t, [{ item: item('pet_bottle'), p: 0.8 }], 0, unit(0))
    expect(t.label?.id).toBe('pet_bottle')
    observe(t, [{ item: item('paper_cup'), p: 0.8 }], 0, unit(1)) // 換成紙杯：向量完全不同
    expect(t.label).toBeNull()
    expect(t.obs).toBe(1)
    observe(t, [{ item: item('paper_cup'), p: 0.8 }], 0, unit(1))
    expect(t.label?.id).toBe('paper_cup')
  })
  it('keeps averaging while it is the same thing', () => {
    const t = fresh()
    const a = unit(0), b = unit(0); b[1] = 0.3 // cosine ≈ 0.96
    observe(t, [{ item: item('pet_bottle'), p: 0.8 }], 0, a)
    observe(t, [{ item: item('pet_bottle'), p: 0.8 }], 0, b)
    expect(t.obs).toBe(2)
  })
  it('common items (cups, bottles) get a lower first-look threshold', () => {
    Object.assign(TRACKER, { FAST_P: 0.9, FAST_P_COMMON: 0.75, FAST_P_AGREE: 1.01 })
    const cup = fresh()
    observe(cup, [{ item: item('paper_cup'), p: 0.8 }, { item: item('tissue'), p: 0.05 }], 0)
    expect(cup.label?.id).toBe('paper_cup')
    const rare = fresh()
    observe(rare, [{ item: item('thermometer'), p: 0.8 }, { item: item('needle'), p: 0.05 }], 0)
    expect(rare.label).toBeNull()
  })
})
