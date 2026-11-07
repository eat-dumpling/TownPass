// 考考你（破關）：每一關 5 題，題目全部由規則表 items.json 產生（模型不參與，不用生成式 AI）。
// 題型：
//   bin     看圖選桶：「我要去哪個桶？」
//   prep    丟之前先做什麼：答案是規則表 steps 的第一步
//   pick    看桶選物：「哪一個要丟進○○？」
//   safety  找出要大人幫忙的（Boss 怪、不要碰）
// 出題順序：還在學、答錯過的品項比較常出；學會的品項隔越久越常出（間隔重複）。
// 每關有主題（某一種桶或某一種題型），主題品項約佔 3／5，其他從全部品項補。
import { binsFor, correctBin, isBoss, isNoTouch, kindMeta, prepMeta, type BinId } from '@/domain/catalog'
import type { AgeBand, Item, KindId, PrepId } from '@/domain/types'

export type QuizKind = 'bin' | 'prep' | 'pick' | 'safety'
export interface QuizOption { key: string; label: string; icon: string; color?: string; itemId?: string }
export interface QuizQuestion {
  kind: QuizKind
  /** 這題要學的品項（答對算練習、答錯回到還在學） */
  itemId: string
  /** pick 題的目標桶 */
  bin?: { id: BinId; label: string; color: string; icon: string }
  options: QuizOption[]
  answer: string
}
export interface QuizLevel { id: number; title: string; icon: string; theme: KindId | 'recycle' | QuizKind | 'mix'; kinds: QuizKind[] }
export interface CodexLike { correct: number; wrong: number; learned: boolean; lastSeen: number }

/** 破關地圖：一關一站，從常見的回收物開始，後面才有先做什麼、找大人與大挑戰 */
export const LEVELS: QuizLevel[] = [
  { id: 1, title: '紙類小站', icon: 'News', theme: 'paper', kinds: ['bin', 'bin', 'bin', 'pick', 'bin'] },
  { id: 2, title: '塑膠工廠', icon: 'Bottle', theme: 'plastic', kinds: ['bin', 'bin', 'pick', 'bin', 'prep'] },
  { id: 3, title: '廚餘菜園', icon: 'Leaf', theme: 'food', kinds: ['bin', 'pick', 'bin', 'bin', 'pick'] },
  { id: 4, title: '一般垃圾車', icon: 'Trash', theme: 'general', kinds: ['bin', 'bin', 'pick', 'bin', 'pick'] },
  { id: 5, title: '先做什麼', icon: 'Droplets', theme: 'prep', kinds: ['prep', 'prep', 'bin', 'prep', 'prep'] },
  { id: 6, title: '罐子與玻璃', icon: 'Beer', theme: 'recycle', kinds: ['bin', 'pick', 'bin', 'prep', 'bin'] },
  { id: 7, title: '找大人', icon: 'UserShield', theme: 'safety', kinds: ['safety', 'bin', 'safety', 'safety', 'bin'] },
  { id: 8, title: '大挑戰', icon: 'Trophy', theme: 'mix', kinds: ['bin', 'prep', 'pick', 'safety', 'bin'] },
]

/** 答對幾題拿幾顆星：5→3、4→2、3→1，少於 3 題沒過關 */
export const starsFor = (score: number, total = 5) => (score >= total ? 3 : score >= total - 1 ? 2 : score >= total - 2 ? 1 : 0)

const DISTRACT_PREPS: PrepId[] = ['flatten', 'rinse', 'empty', 'remove_film', 'wrap', 'drain']

/** 可以出題的品項：正式版看得到、官方說法不衝突、類別確定 */
export function quizPool(items: Item[]): Item[] {
  return items.filter((i) => i.status !== 'conflict' && i.category !== 'unknown' && i.kind !== 'unknown')
}

function weight(it: Item, codex: Record<string, CodexLike>, now: number): number {
  const e = codex[it.id]
  const common = it.freq === 3 ? 1.5 : 1
  if (!e) return 1 * common
  if (!e.learned) return (4 + Math.min(2, e.wrong)) * common
  const days = (now - e.lastSeen) / 86_400_000
  return 1 + Math.min(3, days / 2)
}

function pickWeighted<T>(xs: T[], w: (x: T) => number, rand: () => number): T | undefined {
  const total = xs.reduce((s, x) => s + w(x), 0)
  let r = rand() * total
  for (const x of xs) { r -= w(x); if (r <= 0) return x }
  return xs[xs.length - 1]
}
function shuffle<T>(xs: T[], rand: () => number): T[] {
  const a = [...xs]
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] }
  return a
}
const sample = <T,>(xs: T[], n: number, rand: () => number) => shuffle(xs, rand).slice(0, n)

const itemOpt = (i: Item): QuizOption => ({ key: i.id, label: i.name.zh, icon: i.icon, itemId: i.id })
const binOpt = (b: { id: BinId; label: string; color: string; icon: string }): QuizOption => ({ key: b.id, label: b.label, icon: b.icon, color: b.color })

export function eligible(kind: QuizKind, it: Item, age: AgeBand): boolean {
  if (kind === 'safety') return isBoss(it) || isNoTouch(it)
  if (correctBin(it, age) === null || isBoss(it) || isNoTouch(it)) return false
  if (kind === 'prep') return it.steps.length > 0 && DISTRACT_PREPS.filter((p) => !it.steps.includes(p)).length >= 2
  return true
}

function inTheme(level: QuizLevel, it: Item, age: AgeBand): boolean {
  const t = level.theme
  if (t === 'mix' || t === 'bin' || t === 'pick') return true
  if (t === 'prep' || t === 'safety') return eligible(t, it, age)
  if (t === 'recycle') return ['can', 'glass', 'metal', 'tetra', 'other'].includes(it.kind)
  return it.kind === t
}

function makeQuestion(kind: QuizKind, subject: Item, pool: Item[], age: AgeBand, rand: () => number): QuizQuestion | null {
  const bins = binsFor(age)
  if (kind === 'bin') {
    const right = bins.find((b) => b.id === correctBin(subject, age))!
    const others = sample(bins.filter((b) => b.id !== right.id), 2, rand)
    return { kind, itemId: subject.id, options: shuffle([right, ...others], rand).map(binOpt), answer: right.id }
  }
  if (kind === 'prep') {
    const right = subject.steps[0]
    const wrong = sample(DISTRACT_PREPS.filter((p) => !subject.steps.includes(p)), 2, rand)
    const opts = shuffle([right, ...wrong], rand).map((p) => ({ key: p, label: prepMeta[p].label, icon: prepMeta[p].icon }))
    return { kind, itemId: subject.id, options: opts, answer: right }
  }
  if (kind === 'pick') {
    const binId = correctBin(subject, age)!
    const bin = bins.find((b) => b.id === binId)!
    const wrongs = sample(pool.filter((i) => eligible('bin', i, age) && correctBin(i, age) !== binId), 2, rand)
    if (wrongs.length < 2) return null
    return { kind, itemId: subject.id, bin, options: shuffle([subject, ...wrongs], rand).map(itemOpt), answer: subject.id }
  }
  const wrongs = sample(pool.filter((i) => eligible('bin', i, age) && i.freq >= 2), 2, rand)
  if (wrongs.length < 2) return null
  return { kind, itemId: subject.id, options: shuffle([subject, ...wrongs], rand).map(itemOpt), answer: subject.id }
}

/** 出一關的題目。rand 可以注入（測試用固定亂數） */
export function makeRound(
  level: QuizLevel, items: Item[], codex: Record<string, CodexLike>, age: AgeBand,
  rand: () => number = Math.random, now = Date.now(),
): QuizQuestion[] {
  const pool = quizPool(items)
  const used = new Set<string>()
  const out: QuizQuestion[] = []
  level.kinds.forEach((kind, k) => {
    const themed = k % 5 !== 4 && k !== 2 // 第 3、5 題從全部品項補，其餘主題
    const cands = pool.filter((i) => !used.has(i.id) && eligible(kind, i, age) && (!themed || inTheme(level, i, age)))
    const fallback = pool.filter((i) => !used.has(i.id) && eligible(kind, i, age))
    const subject = pickWeighted(cands.length ? cands : fallback, (i) => weight(i, codex, now), rand)
    if (!subject) return
    const q = makeQuestion(kind, subject, pool, age, rand) ?? makeQuestion('bin', subject, pool, age, rand)
    if (!q) return
    used.add(subject.id)
    q.options.forEach((o) => o.itemId && used.add(o.itemId))
    out.push(q)
  })
  return out
}

/** 答錯時給孩子看的一句話（只用規則表的資料） */
export function explain(q: QuizQuestion, item: Item, age: AgeBand): string {
  if (q.kind === 'prep') return `${item.name.zh}要先「${prepMeta[q.answer as PrepId].label}」`
  if (q.kind === 'safety') return `${item.name.zh}要找大人幫忙`
  const bin = binsFor(age).find((b) => b.id === correctBin(item, age))
  return `${item.name.zh}要丟「${bin?.label ?? kindMeta[item.kind].label}」`
}
