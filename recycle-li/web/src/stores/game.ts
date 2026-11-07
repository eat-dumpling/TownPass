// 遊戲狀態：全部存在手機（IndexedDB），不上傳。
// 獎勵只有一種：星星。掃描分對、讀分辨卡、答對題目、完成任務、集滿圖鑑、拿到成就都拿星星。
//   stars       手上的星星，拿來蓋建築
//   starsTotal  一共拿過幾顆（蓋建築不會扣），決定等級；升級會解鎖新建築和新的里
// 所有任務與成就都由事件驅動：emit('item_learned') 之類的事件會更新每日、每週與累計計數。
import { defineStore } from 'pinia'
import { get, set } from 'idb-keyval'
import { achievements, buildings, catchReward, isBoss, itemById, kindMeta, lis, missions, rankFor, visibleItems } from '@/domain/catalog'
import { LEVELS, starsFor } from '@/solvers/quiz'
import type { AgeBand, GameEvent, Item, Lang } from '@/domain/types'

// ── 遊戲設定（可調） ───────────────────────────────────────────
export const LEARN_THRESHOLD = 3 // 不同天分對 3 次＝學會了
export const DAILY_CATCH_LIMIT = 10 // 掃描分對每天最多 10 次有星星
export const QUIZ_DAILY_REWARD = 10 // 考考你每天最多 10 題有星星（防亂刷）
export const LEARNED_BONUS = 2 // 學會一種東西多給的星星
export const COLLECTION_BONUS = 5 // 圖鑑一個分類集滿
export const TIER_BONUS = [0, 3, 5, 8] // 成就銅、銀、金
/** 學習進階：一開始三個桶（一般垃圾、資源回收、廚餘），升到這一級打開回收標誌的九個桶 */
export const NINE_BINS_LEVEL = 4
/** 同一種東西最多拿幾顆星（掃描分對＋讀分辨卡加起來）：常見 5、少見 7、稀有 9。拿完了就去找別種東西 */
export const speciesCap = (item: Item) => 3 + 2 * item.rarity

const KEY = 'recycle-li/v1'
const today = (d = new Date()) => d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' }) // YYYY-MM-DD
function weekKey(d = new Date()) {
  const t = new Date(d.toLocaleString('en-US', { timeZone: 'Asia/Taipei' }))
  const day = (t.getDay() + 6) % 7 // 週一＝0
  t.setDate(t.getDate() - day)
  return today(t)
}

export interface CodexEntry {
  correct: number; wrong: number; learned: boolean; lastSeen: number; lastCaughtDay?: string; lastQuizDay?: string
  /** 第一次掃到（或用選的找到）的日期：圖鑑「找到了」 */
  found?: string
  /** 從這種東西拿到的星星（上限 speciesCap） */
  fruit?: number
  /** 讀過分辨卡 */
  read?: boolean
}
interface Counter { key: string; counts: Partial<Record<GameEvent, number>>; claimed: string[]; catches: number; quiz?: number; seen?: number }
export interface Reward { stars: number }

const emptyCounter = (key: string): Counter => ({ key, counts: {}, claimed: [], catches: 0 })
const emptyLi = (id: string) => {
  const a = lis.find((l) => l.id === id)!
  return Array<string | null>(a.cols * a.rows).fill(null)
}

export const useGame = defineStore('game', {
  state: () => ({
    loaded: false,
    settings: {
      age: 'young' as AgeBand,
      parentLang: 'zh' as Lang,
      nickname: '小里長',
      li: null as null | { district: string; name: string },
      voice: true,
      zhuyin: true, // 孩子介面的國字旁邊標注音
    },
    stars: 0,
    starsTotal: 0,
    codex: {} as Record<string, CodexEntry>,
    /** 每個里的空地（遊戲位置，不代表真實土地） */
    lis: { sprout: emptyLi('sprout') } as Record<string, (string | null)[]>,
    liId: 'sprout',
    collections: [] as string[], // 集滿的圖鑑分類（KindId）
    levels: {} as Record<number, { stars: number; plays: number }>, // 考考你破關地圖：每關最好的星數
    tiersPaid: {} as Record<string, number>, // 成就已經發過星星的等級
    totals: {} as Partial<Record<GameEvent, number>>,
    daily: emptyCounter(today()),
    weekly: emptyCounter(weekKey()),
    toast: null as null | { icon: string; text: string },
  }),
  getters: {
    rank: (s) => rankFor(s.starsTotal),
    level(): number { return this.rank.lv },
    /** 用幾個桶：跟著等級長大，不用家長設定 */
    age(): AgeBand { return this.rank.lv >= NINE_BINS_LEVEL ? 'older' : 'young' },
    /** 現在這個里的空地 */
    slots: (s) => s.lis[s.liId] ?? [],
    li: (s) => lis.find((l) => l.id === s.liId)!,
    learnedIds: (s) => Object.entries(s.codex).filter(([, e]) => e.learned).map(([id]) => id),
    /** 全部的里加起來的綠意 */
    green: (s) => Object.values(s.lis).flat().reduce((g, id) => g + (buildings.find((b) => b.id === id)?.green ?? 0), 0),
  },
  actions: {
    async load() {
      try {
        const saved = await get(KEY)
        if (saved) {
          // 舊版存檔：五種資源→星星、只有一塊地→多個里
          if (saved.resources && saved.stars === undefined) {
            const sum = Object.values(saved.resources as Record<string, number>).reduce((a, b) => a + b, 0)
            saved.stars = sum
            saved.starsTotal = sum
          }
          if (saved.slots && !saved.lis) saved.lis = { sprout: saved.slots }
          // 舊版的里是 4×3 固定格子：搬到新的大地圖上（每隔一格放一個，位置大致不變）
          for (const [id, arr] of Object.entries((saved.lis ?? {}) as Record<string, (string | null)[]>)) {
            const a = lis.find((l) => l.id === id)
            if (!a || arr.length === a.cols * a.rows) continue
            const next = emptyLi(id)
            arr.forEach((b, i) => { if (b) next[Math.min(a.rows - 1, 1 + Math.floor(i / 4) * 2) * a.cols + Math.min(a.cols - 1, 1 + (i % 4) * 2)] = b })
            saved.lis[id] = next
          }
          delete saved.resources; delete saved.slots; delete saved.xp
          this.$patch({ ...saved, toast: null })
        }
      } catch (e) { console.warn('IndexedDB 無法使用，進度只存在這次開啟', e) }
      for (const a of lis) if (this.liOpen(a.id) && !this.lis[a.id]) this.lis[a.id] = emptyLi(a.id)
      this.rollover()
      this.loaded = true
      this.$subscribe(() => this.save(), { detached: true })
    },
    save() {
      const { loaded: _l, toast: _t, ...rest } = this.$state
      set(KEY, JSON.parse(JSON.stringify(rest))).catch(() => {})
    },
    rollover() {
      if (this.daily.key !== today()) this.daily = emptyCounter(today())
      if (this.weekly.key !== weekKey()) this.weekly = emptyCounter(weekKey())
    },
    say(icon: string, text: string) {
      this.toast = { icon, text }
      window.setTimeout(() => { if (this.toast?.text === text) this.toast = null }, 2400)
    },
    /** 拿到星星：手上的和累積的都加；升級就解鎖新的里並告訴孩子 */
    earn(n: number): Reward | null {
      if (n <= 0) return null
      const before = this.rank.lv
      this.stars += n
      this.starsTotal += n
      if (this.rank.lv > before) {
        for (const a of lis) if (a.unlock <= this.rank.lv && !this.lis[a.id]) this.lis[a.id] = emptyLi(a.id)
        if (before < NINE_BINS_LEVEL && this.rank.lv >= NINE_BINS_LEVEL) this.say('Recycle', '九個分類桶打開了！分得更細')
        else this.say(this.rank.icon, `升到 Lv.${this.rank.lv}：${this.rank.title}`)
      }
      return { stars: n }
    },
    emit(ev: GameEvent, n = 1) {
      this.rollover()
      this.totals[ev] = (this.totals[ev] ?? 0) + n
      this.daily.counts[ev] = (this.daily.counts[ev] ?? 0) + n
      this.weekly.counts[ev] = (this.weekly.counts[ev] ?? 0) + n
      this.checkMissions()
      this.checkAchievements()
    },
    /** 任務完成就發星星 */
    checkMissions() {
      for (const m of missions) {
        if (m.verify !== 'auto') continue
        const bucket = m.type.startsWith('weekly') ? this.weekly : this.daily
        if (bucket.claimed.includes(m.id)) continue
        if ((bucket.counts[m.goal.event] ?? 0) >= m.goal.count) {
          bucket.claimed.push(m.id)
          this.earn(m.reward.stars)
          this.say(m.icon, `任務完成：${m.title}`)
        }
      }
    },
    /** 成就升到銅、銀、金就發星星（每一級只發一次） */
    checkAchievements() {
      for (const a of achievements) {
        const t = this.achievementTier(a.id).tier
        const paid = this.tiersPaid[a.id] ?? 0
        if (t > paid) {
          let n = 0
          for (let k = paid + 1; k <= t; k++) n += TIER_BONUS[k] ?? 0
          this.tiersPaid[a.id] = t
          this.earn(n)
        }
      }
    },
    missionProgress(id: string) {
      const m = missions.find((x) => x.id === id)!
      const bucket = m.type.startsWith('weekly') ? this.weekly : this.daily
      return { done: bucket.claimed.includes(id), count: Math.min(m.goal.count, bucket.counts[m.goal.event] ?? 0), goal: m.goal.count }
    },
    achievementTier(id: string) {
      const a = achievements.find((x) => x.id === id)!
      // 破關成就算「過了幾個不同的關」；探索成就算「找到幾種」
      const n = id === 'explorer' ? Object.values(this.levels).filter((l) => l.stars > 0).length
        : id === 'finder' ? Object.keys(this.codex).filter((k) => this.isFound(k)).length
        : this.totals[a.event] ?? 0
      return { tier: a.tiers.filter((t) => n >= t).length, n, next: a.tiers.find((t) => n < t) }
    },
    /** 這種東西還能拿幾顆星（上限 speciesCap） */
    room(item: Item) {
      return Math.max(0, speciesCap(item) - (this.codex[item.id]?.fruit ?? 0))
    },
    /** 從某種東西拿星星，不超過這種東西的上限 */
    earnFrom(item: Item, n: number) {
      const e = this.codex[item.id]
      const amount = Math.min(n, this.room(item))
      if (amount <= 0) return null
      e.fruit = (e.fruit ?? 0) + amount
      return this.earn(amount)
    },

    /**
     * 掃描後分對（拖進對的桶）。第一次找到這種東西多 1 顆。
     * 防亂刷：同一種東西一天只給一次、一種東西有上限、每天上限 DAILY_CATCH_LIMIT 次。
     * 不同天分對 LEARN_THRESHOLD 次＝學會了（多 LEARNED_BONUS 顆，不算在上限裡）。
     */
    catchItem(item: Item, retried: boolean) {
      this.rollover()
      const e = (this.codex[item.id] ??= { correct: 0, wrong: 0, learned: false, lastSeen: 0 })
      e.lastSeen = Date.now()
      const d = today()
      if (e.lastCaughtDay === d) return { reward: null, justLearned: false, already: e.learned, todayDone: true }
      if (this.daily.catches >= DAILY_CATCH_LIMIT) return { reward: null, justLearned: false, already: e.learned, limit: true }
      e.lastCaughtDay = d
      this.daily.catches += 1
      const wasLearned = e.learned
      let n = wasLearned ? 1 : catchReward(item, retried).amount
      if (!e.fruit) n += 1 // 第一次找到
      const capped = this.room(item) === 0
      const reward = this.earnFrom(item, n)
      this.emit('item_caught')
      if (item.rarity === 3) this.emit('rare_caught')
      if (!wasLearned) {
        e.correct += 1
        if (e.correct >= LEARN_THRESHOLD) { e.learned = true; this.earn(LEARNED_BONUS); this.emit('item_learned') }
      }
      return { reward, justLearned: !wasLearned && e.learned, already: wasLearned, ...(capped ? { capped: true } : {}) }
    },
    /** 看到掃描結果（或用選的）＝找到這種東西；集滿一個分類多 COLLECTION_BONUS 顆 */
    discover(item: Item) {
      const e = (this.codex[item.id] ??= { correct: 0, wrong: 0, learned: false, lastSeen: 0 })
      e.lastSeen = Date.now()
      if (e.found) return false
      e.found = today()
      this.emit('item_found')
      const kind = item.kind
      const all = visibleItems().filter((i) => i.kind === kind && i.status !== 'conflict')
      if (!this.collections.includes(kind) && all.length && all.every((i) => this.isFound(i.id))) {
        this.collections.push(kind)
        this.earn(COLLECTION_BONUS)
        this.say(kindMeta[kind].icon, `集滿了：${kindMeta[kind].label}`)
      }
      return true
    },
    isFound(id: string) {
      const e = this.codex[id]
      return !!(e?.found || e?.lastCaughtDay)
    },
    /** 讀完分辨卡：每種東西第一次讀給 1 顆星（算在這種東西的上限裡） */
    readCard(item: Item) {
      const e = (this.codex[item.id] ??= { correct: 0, wrong: 0, learned: false, lastSeen: 0 })
      if (e.read) return null
      e.read = true
      this.emit('card_read')
      return this.earnFrom(item, 1)
    },
    /** 拖錯桶：記一次，不扣星星 */
    markWrong(item: Item) {
      const e = (this.codex[item.id] ??= { correct: 0, wrong: 0, learned: false, lastSeen: 0 })
      e.wrong += 1
    },
    /** Boss 怪（要大人幫忙）：認出來、大人確認 → 2 顆星（一天一次，算在上限裡） */
    bossConfirmed(item: Item) {
      const e = (this.codex[item.id] ??= { correct: 0, wrong: 0, learned: false, lastSeen: 0 })
      e.lastSeen = Date.now()
      if (!e.learned) { e.correct = LEARN_THRESHOLD; e.learned = true; this.emit('item_learned') }
      if (isBoss(item)) this.emit('boss_recognized')
      const d = today()
      if (e.lastCaughtDay === d) return null
      e.lastCaughtDay = d
      return this.earnFrom(item, 2)
    },
    /**
     * 考考你答一題。答對：1 顆星（每天 QUIZ_DAILY_REWARD 題），還在學的東西一天算一次練習。
     * 答錯：學會的東西移回還在學，不扣星星。
     */
    quizAnswer(itemId: string, correct: boolean) {
      this.rollover()
      const e = (this.codex[itemId] ??= { correct: 0, wrong: 0, learned: false, lastSeen: 0 })
      e.lastSeen = Date.now()
      if (!correct) {
        e.wrong += 1
        if (e.learned) { e.learned = false; e.correct = LEARN_THRESHOLD - 1 }
        return { reward: null, justLearned: false }
      }
      this.emit('quiz_correct')
      let justLearned = false
      const d = today()
      if (!e.learned && e.lastQuizDay !== d) {
        e.lastQuizDay = d
        e.correct += 1
        if (e.correct >= LEARN_THRESHOLD) { e.learned = true; justLearned = true; this.earn(LEARNED_BONUS); this.emit('item_learned') }
      }
      if ((this.daily.quiz ?? 0) >= QUIZ_DAILY_REWARD) return { reward: null, justLearned, limit: true }
      this.daily.quiz = (this.daily.quiz ?? 0) + 1
      return { reward: this.earn(1), justLearned }
    },
    /** 一關結束：關卡的 1–3 顆星就是真的星星——比以前多拿到的那幾顆會加進來；過關解鎖下一關 */
    levelFinished(levelId: number, score: number, total: number) {
      this.rollover()
      const stars = starsFor(score, total)
      const prev = this.levels[levelId] ?? { stars: 0, plays: 0 }
      const firstClear = stars > 0 && prev.stars === 0
      this.levels[levelId] = { stars: Math.max(prev.stars, stars), plays: prev.plays + 1 }
      if (stars > 0) this.emit('level_cleared')
      const bonus = this.earn(Math.max(0, stars - prev.stars))
      return { stars, firstClear, bonus }
    },
    /** 第 n 關打開了沒：第一關一定開，之後要前一關至少 1 顆星 */
    levelOpen(levelId: number) {
      return levelId === LEVELS[0].id || (this.levels[levelId - 1]?.stars ?? 0) > 0
    },
    liOpen(id: string) {
      return (lis.find((l) => l.id === id)?.unlock ?? 99) <= this.rank.lv
    },
    /** 這一格能不能蓋（水、石頭、路不能蓋） */
    buildable(liId: string, slot: number) {
      const t = lis.find((l) => l.id === liId)?.terrain ?? {}
      return ![...(t.water ?? []), ...(t.rock ?? []), ...(t.road ?? [])].includes(slot)
    },
    /** 拆掉：星星全部還給孩子（蓋錯不會怕） */
    remove(slot: number, liArg?: string) {
      const area = this.lis[liArg ?? this.liId]
      const b = buildings.find((x) => x.id === area?.[slot])
      if (!area || !b) return false
      area[slot] = null
      this.stars += b.cost.star ?? 0
      return true
    },
    /** 搬家：移到另一塊可以蓋的空地，不花星星 */
    move(from: number, to: number, liArg?: string) {
      const liId = liArg ?? this.liId
      const area = this.lis[liId]
      if (!area || !area[from] || area[to] || !this.buildable(liId, to)) return false
      area[to] = area[from]
      area[from] = null
      return true
    },
    build(buildingId: string, slot: number, liArg?: string) {
      const liId = liArg ?? this.liId
      const b = buildings.find((x) => x.id === buildingId)
      const area = this.lis[liId]
      const cost = b?.cost.star ?? 0
      if (!b || !area || area[slot] || !this.buildable(liId, slot) || b.unlock > this.rank.lv || this.stars < cost) return false
      this.stars -= cost
      area[slot] = buildingId
      this.emit('building_built')
      return true
    },
  },
})

export { today, weekKey }
