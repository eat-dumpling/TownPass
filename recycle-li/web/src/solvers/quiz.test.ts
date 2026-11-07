import { describe, expect, it } from 'vitest'
import { allItems, correctBin, isBoss, isNoTouch, itemById } from '@/domain/catalog'
import { LEVELS, eligible, makeRound, quizPool, starsFor } from './quiz'

// 固定亂數（mulberry32），讓測試每次一樣
function rng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

describe('quiz rounds', () => {
  it('every level makes 5 questions whose answer is one of the options', () => {
    for (const age of ['young', 'older'] as const) {
      for (const lv of LEVELS) {
        for (let s = 1; s <= 20; s++) {
          const qs = makeRound(lv, allItems, {}, age, rng(s * 31 + lv.id))
          expect(qs).toHaveLength(5)
          for (const q of qs) {
            expect(q.options.map((o) => o.key)).toContain(q.answer)
            expect(new Set(q.options.map((o) => o.key)).size).toBe(q.options.length)
          }
        }
      }
    }
  })

  it('answers come from the rule table', () => {
    for (let s = 1; s <= 30; s++) {
      for (const q of makeRound(LEVELS[7], allItems, {}, 'older', rng(s))) {
        const it = itemById(q.itemId)!
        if (q.kind === 'bin') expect(q.answer).toBe(correctBin(it, 'older'))
        if (q.kind === 'prep') expect(q.answer).toBe(it.steps[0])
        if (q.kind === 'pick') {
          expect(q.answer).toBe(it.id)
          for (const o of q.options) if (o.key !== q.answer) expect(correctBin(itemById(o.key)!, 'older')).not.toBe(q.bin!.id)
        }
        if (q.kind === 'safety') {
          expect(isBoss(it) || isNoTouch(it)).toBe(true)
          for (const o of q.options) if (o.key !== q.answer) expect(eligible('bin', itemById(o.key)!, 'older')).toBe(true)
        }
      }
    }
  })

  it('never asks about conflicting or unknown rules, and items do not repeat within a round', () => {
    const pool = new Set(quizPool(allItems).map((i) => i.id))
    for (let s = 1; s <= 30; s++) {
      const qs = makeRound(LEVELS[0], allItems, {}, 'young', rng(s))
      for (const q of qs) expect(pool.has(q.itemId)).toBe(true)
      expect(new Set(qs.map((q) => q.itemId)).size).toBe(qs.length)
    }
  })

  it('items still being learned come up more often', () => {
    const target = quizPool(allItems).find((i) => i.kind === 'paper')!
    const codex = { [target.id]: { correct: 1, wrong: 2, learned: false, lastSeen: 0 } }
    let withCodex = 0, without = 0
    for (let s = 1; s <= 200; s++) {
      if (makeRound(LEVELS[0], allItems, codex, 'young', rng(s)).some((q) => q.itemId === target.id)) withCodex++
      if (makeRound(LEVELS[0], allItems, {}, 'young', rng(s)).some((q) => q.itemId === target.id)) without++
    }
    expect(withCodex).toBeGreaterThan(without)
  })

  it('stars: 5→3, 4→2, 3→1, less fails', () => {
    expect([5, 4, 3, 2, 0].map((n) => starsFor(n))).toEqual([3, 2, 1, 0, 0])
  })
})
