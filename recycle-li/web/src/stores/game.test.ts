import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { allItems, rankFor, ranks } from '@/domain/catalog'
import { COLLECTION_BONUS, DAILY_CATCH_LIMIT, LEARN_THRESHOLD, LEARNED_BONUS, QUIZ_DAILY_REWARD, speciesCap, useGame } from './game'

// game.say() 用 window.setTimeout；node 測試環境沒有 window
;(globalThis as unknown as { window: typeof globalThis }).window ??= globalThis
const item = (id: string) => allItems.find((i) => i.id === id)!

describe('stars: the only reward', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('a correct drop gives stars (+1 the first time), once per item per day', () => {
    const g = useGame()
    const it = item('pet_bottle')
    const r1 = g.catchItem(it, false)
    expect(r1.reward?.stars).toBe(it.rarity + 1)
    expect(g.stars).toBe(it.rarity + 1)
    expect(g.starsTotal).toBe(g.stars)
    const r2 = g.catchItem(it, false)
    expect(r2.reward).toBeNull()
    expect('todayDone' in r2).toBe(true)
  })

  it('each kind of thing has a star cap, so kids go find new things', () => {
    const g = useGame()
    const it = item('pet_bottle')
    g.codex[it.id] = { correct: 0, wrong: 0, learned: false, lastSeen: 0, fruit: speciesCap(it) }
    const r = g.catchItem(it, false)
    expect(r.reward).toBeNull()
    expect('capped' in r).toBe(true)
  })

  it('learning an item (correct on 3 different days) gives a bonus outside the cap', () => {
    const g = useGame()
    const it = item('pet_bottle')
    g.codex[it.id] = { correct: LEARN_THRESHOLD - 1, wrong: 0, learned: false, lastSeen: 0, lastCaughtDay: '2000-01-01', fruit: speciesCap(it) }
    const before = g.starsTotal
    const r = g.catchItem(it, false)
    expect(r.justLearned).toBe(true)
    expect(g.starsTotal - before).toBeGreaterThanOrEqual(LEARNED_BONUS)
  })

  it('reading a look-alike card gives one star, once', () => {
    const g = useGame()
    const it = item('pet_bottle')
    g.discover(it)
    expect(g.readCard(it)?.stars).toBe(1)
    expect(g.readCard(it)).toBeNull()
  })

  it('daily cap stops scan rewards', () => {
    const g = useGame()
    g.daily.catches = DAILY_CATCH_LIMIT
    expect('limit' in g.catchItem(item('aluminum_can'), false)).toBe(true)
  })

  it('finding every item of a kind gives a collection bonus', () => {
    vi.stubEnv('VITE_SHOW_UNVERIFIED', 'true') // 開發版：規則還沒核對完，全部品項都看得到
    const g = useGame()
    const papers = allItems.filter((i) => i.kind === 'paper' && i.status !== 'conflict')
    papers.slice(0, -1).forEach((i) => g.discover(i))
    const before = g.starsTotal
    g.discover(papers[papers.length - 1])
    expect(g.collections).toContain('paper')
    expect(g.starsTotal - before).toBeGreaterThanOrEqual(COLLECTION_BONUS)
    vi.unstubAllEnvs()
  })

  it('a Boss item recognised with an adult gives stars once per day', () => {
    const g = useGame()
    expect(g.bossConfirmed(item('battery'))?.stars).toBe(2)
    expect(g.bossConfirmed(item('battery'))).toBeNull()
  })
})

describe('levels and the 里', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('rank follows lifetime stars; spending stars never lowers the level', () => {
    const g = useGame()
    g.earn(ranks[2].need)
    expect(g.level).toBe(3)
    g.stars = 0 // 全部花掉
    expect(g.level).toBe(3)
    expect(rankFor(ranks[2].need - 1).lv).toBe(2)
  })

  it('levelling up unlocks new 里 and new buildings', () => {
    const g = useGame()
    expect(g.liOpen('river')).toBe(false)
    g.earn(ranks[2].need) // Lv.3
    expect(g.liOpen('river')).toBe(true)
    expect(g.lis.river).toBeDefined()
    g.liId = 'river'
    expect(g.buildable('river', 4)).toBe(false) // 河
    expect(g.build('windmill', 0)).toBe(false) // Lv.5 才能蓋
    expect(g.build('bench', 0)).toBe(true)
  })

  it('building spends stars and counts for missions and achievements', () => {
    const g = useGame()
    g.earn(5)
    expect(g.build('bench', 0)).toBe(true)
    expect(g.stars).toBeLessThan(g.starsTotal)
    expect(g.missionProgress('daily_build').done).toBe(true)
    expect(g.achievementTier('builder').tier).toBe(1)
    expect(g.green).toBeGreaterThan(0)
    expect(g.build('bench', 0)).toBe(false) // 已經有東西
  })

  it('anywhere on the map: build on any free cell, move for free, remove refunds stars', () => {
    const g = useGame()
    g.earn(20)
    const last = g.slots.length - 1
    expect(g.build('tree', last)).toBe(true)
    const left = g.stars
    expect(g.move(last, 10)).toBe(true)
    expect(g.slots[10]).toBe('tree')
    expect(g.slots[last]).toBeNull()
    expect(g.stars).toBe(left)
    expect(g.remove(10)).toBe(true)
    expect(g.stars).toBe(left + 3)
  })

  it('reaching an achievement tier pays stars once', () => {
    const g = useGame()
    for (let k = 0; k < 10; k++) g.emit('item_found')
    expect(g.tiersPaid.finder).toBe(undefined) // finder 算的是圖鑑裡找到的種類，不是事件次數
    for (const it of allItems.slice(0, 10)) g.discover(it)
    expect(g.tiersPaid.finder).toBe(1)
    const t = g.starsTotal
    g.emit('item_caught')
    expect(g.tiersPaid.finder).toBe(1)
    expect(g.starsTotal).toBeGreaterThanOrEqual(t)
  })
})

describe('quiz levels', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('a correct answer gives one star and counts as practice once a day', () => {
    const g = useGame()
    expect(g.quizAnswer('pet_bottle', true).reward?.stars).toBe(1)
    expect(g.codex.pet_bottle.correct).toBe(1)
    g.quizAnswer('pet_bottle', true)
    expect(g.codex.pet_bottle.correct).toBe(1)
    expect(g.missionProgress('daily_quiz5').count).toBe(2)
  })

  it('a wrong answer moves a learned item back to learning, without taking stars', () => {
    const g = useGame()
    g.codex.pet_bottle = { correct: LEARN_THRESHOLD, wrong: 0, learned: true, lastSeen: 0 }
    const before = g.stars
    expect(g.quizAnswer('pet_bottle', false).reward).toBeNull()
    expect(g.codex.pet_bottle.learned).toBe(false)
    expect(g.stars).toBe(before)
  })

  it('quiz rewards stop at the daily cap', () => {
    const g = useGame()
    g.daily.quiz = QUIZ_DAILY_REWARD
    expect(g.quizAnswer('newspaper', true)).toMatchObject({ reward: null, limit: true })
  })

  it('level stars are real stars: only the improvement is added; clearing unlocks the next level', () => {
    const g = useGame()
    expect(g.levelOpen(2)).toBe(false)
    expect(g.levelFinished(1, 2, 5).stars).toBe(0)
    expect(g.levelFinished(1, 4, 5).bonus?.stars).toBe(2)
    expect(g.levelOpen(2)).toBe(true)
    expect(g.levelFinished(1, 5, 5).bonus?.stars).toBe(1)
    expect(g.levelFinished(1, 5, 5).bonus).toBeNull()
    expect(g.achievementTier('explorer').n).toBe(1)
  })
})
