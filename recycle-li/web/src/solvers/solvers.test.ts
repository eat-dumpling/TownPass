import { describe, expect, it } from 'vitest'
import { allItems, groups, questions } from '@/domain/catalog'
import type { AttrId, Stop } from '@/domain/types'
import { answer, expectedQuestions, isResolved, MAX_DEPTH, nextQuestion, worstLeafClasses, type Candidate } from './ask'
import { bruteForce, feasible, solve as solveFactory, stars, value, type FactoryInput } from './factory'
import { evaluate, solve as solveRoute, type TwInput } from './tsptw'
import { chase } from './chase'
import { findMyTrip, haversine, hhmm, toMin, tripStops } from './geo'
import { isCollectionDay, recycleOfDay, tonightCategories } from './schedule'
import stopsFile from '../../public/data/stops/士林區.json'

const qids = questions.map((q) => q.id as AttrId)

describe('OR① ask', () => {
  for (const g of groups) {
    it(`group ${g.id}: ≤${MAX_DEPTH} questions, ≤3 cards left`, () => {
      const cands: Candidate[] = allItems.filter((i) => i.group === g.id).map((item) => ({ item, p: item.freq }))
      expect(cands.length).toBeGreaterThan(0)
      expect(worstLeafClasses(cands, qids)).toBeLessThanOrEqual(3)
      expect(expectedQuestions(cands, qids)).toBeLessThanOrEqual(MAX_DEPTH)
    })
  }
  it('every item is reachable by answering truthfully', () => {
    for (const target of allItems) {
      let cands: Candidate[] = allItems.filter((i) => i.group === target.group).map((item) => ({ item, p: item.freq }))
      const asked: AttrId[] = []
      for (;;) {
        const q = nextQuestion(cands, qids, asked)
        if (!q) break
        asked.push(q)
        cands = answer(cands, q, target.attrs[q] === true)
      }
      expect(asked.length).toBeLessThanOrEqual(MAX_DEPTH)
      expect(cands.some((c) => c.item.id === target.id)).toBe(true)
    }
  })
  it('resolved set needs no question', () => {
    const cup = allItems.find((i) => i.id === 'pet_bottle')!
    const can = allItems.find((i) => i.id === 'aluminum_can')!
    const cands = [{ item: cup, p: 0.6 }, { item: can, p: 0.4 }] // 同類別同步驟
    expect(isResolved(cands)).toBe(true)
    expect(nextQuestion(cands, qids, [])).toBeNull()
  })
})

describe('OR② factory', () => {
  const bs = [
    { id: 'bench', cost: { plastic: 3, metal: 1 }, green: 4 },
    { id: 'tree', cost: { compost: 3 }, green: 5 },
    { id: 'library', cost: { paper: 4, metal: 1 }, green: 6 },
    { id: 'playground', cost: { plastic: 4, metal: 2 }, green: 8 },
    { id: 'garden', cost: { compost: 2, paper: 1 }, green: 4 },
  ]
  const cases: FactoryInput[] = [
    { buildings: bs, resources: { plastic: 10, metal: 4, compost: 7, paper: 6 }, slots: 6, diversityBonus: 2 },
    { buildings: bs, resources: { plastic: 3, metal: 1, compost: 3, paper: 0 }, slots: 3, diversityBonus: 1 },
    { buildings: bs, resources: { plastic: 12, metal: 6, compost: 0, paper: 9 }, slots: 4, diversityBonus: 0 },
    { buildings: bs, resources: {}, slots: 5, diversityBonus: 2 },
    // 遊戲實際用的：只有星星一種資源（背包問題＋多樣性加分）
    { buildings: [{ id: 'bench', cost: { star: 3 }, green: 4 }, { id: 'tree', cost: { star: 3 }, green: 5 }, { id: 'library', cost: { star: 6 }, green: 7 }, { id: 'playground', cost: { star: 8 }, green: 9 }], resources: { star: 17 }, slots: 5, diversityBonus: 2 },
  ]
  cases.forEach((c, k) =>
    it(`branch & bound == brute force (case ${k})`, () => {
      const a = solveFactory(c)
      const b = bruteForce(c)
      expect(feasible(c, a.counts)).toBe(true)
      expect(a.value).toBe(b.value)
      expect(value(c, a.counts)).toBe(a.value)
    }),
  )
  it('stars', () => {
    expect(stars(19, 20)).toBe(3)
    expect(stars(15, 20)).toBe(2)
    expect(stars(1, 20)).toBe(1)
  })
})

describe('OR③ TSPTW + chase', () => {
  const stops = (stopsFile as { stops: Stop[] }).stops
  const trip = tripStops(stops, '士林-A01', '1').slice(2, 11) // 9 個點
  const input: TwInput = {
    start: { lat: trip[0].lat - 0.001, lng: trip[0].lng - 0.001 },
    t0: trip[0].arrive - 5,
    speed: 300,
    stops: trip.map((s) => ({ id: s.id, lat: s.lat, lng: s.lng, e: s.arrive - 2, l: s.leave + 4, s: 1 })),
  }
  it('real schedule order is feasible', () => {
    expect(evaluate(input, trip.map((_, i) => i)).feasible).toBe(true)
  })
  it('optimal is feasible and not longer than the real schedule', () => {
    const best = solveRoute(input)!
    const real = evaluate(input, trip.map((_, i) => i))
    expect(best.feasible).toBe(true)
    expect(best.distance).toBeLessThanOrEqual(real.distance + 1e-6)
  })
  it('detects late stops', () => {
    const rev = evaluate(input, trip.map((_, i) => trip.length - 1 - i))
    expect(rev.feasible).toBe(false)
  })
  it('chase picks a reachable stop with the shortest walk', () => {
    const pos = { lat: trip[3].lat, lng: trip[3].lng }
    const r = chase(trip, pos, trip[3].leave + 1)!
    expect(r).not.toBeNull()
    expect(r.stop.leave).toBeGreaterThanOrEqual(trip[3].leave + 1 + r.walkMin)
    expect(chase(trip, pos, 24 * 60)).toBeNull()
  })
  it('findMyTrip returns nearest stop', () => {
    const t = findMyTrip(stops, { lat: trip[0].lat, lng: trip[0].lng })!
    expect(t.route).toBe('士林-A01')
    expect(haversine({ lat: 25, lng: 121.5 }, { lat: 25.001, lng: 121.5 })).toBeCloseTo(111.2, 0)
    expect(toMin('1630')).toBe(990)
    expect(hhmm(990)).toBe('16:30')
  })
})

describe('schedule rules', () => {
  it('Wednesday and Sunday have no collection', () => {
    expect(isCollectionDay(new Date('2026-11-11T12:00:00+08:00'))).toBe(false) // 週三
    expect(isCollectionDay(new Date('2026-11-08T12:00:00+08:00'))).toBe(false) // 週日
    expect(recycleOfDay(new Date('2026-11-09T12:00:00+08:00'))).toBe('recycle_flat') // 週一
    expect(recycleOfDay(new Date('2026-11-07T12:00:00+08:00'))).toBe('recycle_3d') // 週六
  })
  it('only assigns categories the child has learned', () => {
    const sat = new Date('2026-11-07T12:00:00+08:00')
    expect(tonightCategories(sat, new Set(['recycle_3d']))).toEqual(['recycle_3d'])
    expect(tonightCategories(sat, new Set())).toEqual([])
  })
})
