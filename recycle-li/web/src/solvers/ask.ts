// OR①：最少提問決策樹。
// 目標是用最少的期望題數確定「臺北類別＋處理步驟」，不需要確定是哪一個品項。
//   V(S) = 0                                   若 S 內品項的類別與步驟都相同
//   V(S) = min_q ( 1 + Σ_a P(a|S,q) · V(S_q,a) ) 其他
// 最多問 MAX_DEPTH 題；問完仍分不出來，改成從剩下的 2–3 張圖卡直接選（LEAF_COST）。
import type { AttrId, Item } from '@/domain/types'

export interface Candidate { item: Item; p: number }

export const MAX_DEPTH = 3
/** 問完還分不出來時改用圖卡直接選：2–3 張算一次互動，再多每張重罰（不希望出現） */
const leafCost = (classes: number) => (classes <= 1 ? 0 : classes <= 3 ? 1 : 1 + 4 * (classes - 3))

export const classKey = (i: Item) => `${i.category}|${i.steps.join(',')}`
export const attr = (i: Item, q: AttrId) => i.attrs[q] === true

export function classCount(cands: Candidate[]): number {
  return new Set(cands.map((c) => classKey(c.item))).size
}
export const isResolved = (cands: Candidate[]) => cands.length > 0 && classCount(cands) === 1

function split(cands: Candidate[], q: AttrId): [Candidate[], Candidate[]] {
  const yes: Candidate[] = []
  const no: Candidate[] = []
  for (const c of cands) (attr(c.item, q) ? yes : no).push(c)
  return [yes, no]
}

const mass = (cs: Candidate[]) => cs.reduce((s, c) => s + c.p, 0)

interface Plan { cost: number; q: AttrId | null }

/** 對候選集合求最佳下一題。cands 的 p 不需要先正規化。 */
export function solve(cands: Candidate[], questionIds: AttrId[], depthLeft = MAX_DEPTH): Plan {
  const memo = new Map<string, Plan>()
  const rec = (cs: Candidate[], d: number): Plan => {
    if (cs.length === 0 || isResolved(cs)) return { cost: 0, q: null }
    if (d === 0) return { cost: leafCost(classCount(cs)), q: null }
    const key = cs.map((c) => c.item.id).sort().join(',') + '#' + d
    const hit = memo.get(key)
    if (hit) return hit
    let best: Plan = { cost: leafCost(classCount(cs)) + 0.01, q: null } // 不問、直接選圖卡
    const total = mass(cs) || 1
    for (const q of questionIds) {
      const [yes, no] = split(cs, q)
      if (yes.length === 0 || no.length === 0) continue // 這題分不開
      const cost = 1 + (mass(yes) / total) * rec(yes, d - 1).cost + (mass(no) / total) * rec(no, d - 1).cost
      if (cost < best.cost - 1e-9) best = { cost, q }
    }
    memo.set(key, best)
    return best
  }
  return rec(cands, depthLeft)
}

export function nextQuestion(cands: Candidate[], questionIds: AttrId[], asked: AttrId[]): AttrId | null {
  if (asked.length >= MAX_DEPTH || isResolved(cands)) return null
  const remaining = questionIds.filter((q) => !asked.includes(q))
  return solve(cands, remaining, MAX_DEPTH - asked.length).q
}

export function answer(cands: Candidate[], q: AttrId, yes: boolean): Candidate[] {
  return cands.filter((c) => attr(c.item, q) === yes)
}

/** 每個類別留機率最高的代表，給「直接選圖卡」用 */
export function representatives(cands: Candidate[]): Candidate[] {
  const byClass = new Map<string, Candidate>()
  for (const c of [...cands].sort((a, b) => b.p - a.p)) {
    const k = classKey(c.item)
    if (!byClass.has(k)) byClass.set(k, c)
  }
  return [...byClass.values()]
}

/** 給評審看的數字：照最佳決策樹走，平均要問幾題（依 p 加權） */
export function expectedQuestions(cands: Candidate[], questionIds: AttrId[]): number {
  const walk = (cs: Candidate[], asked: AttrId[]): number => {
    const q = nextQuestion(cs, questionIds, asked)
    if (!q) return 0
    const [yes, no] = split(cs, q)
    const t = mass(cs) || 1
    return 1 + (mass(yes) / t) * walk(yes, [...asked, q]) + (mass(no) / t) * walk(no, [...asked, q])
  }
  return walk(cands, [])
}

/** 依路徑走完最多 3 題後，剩下需要用圖卡選的類別數（測試用：應該 ≤ 3） */
export function worstLeafClasses(cands: Candidate[], questionIds: AttrId[]): number {
  const walk = (cs: Candidate[], asked: AttrId[]): number => {
    const q = nextQuestion(cs, questionIds, asked)
    if (!q) return classCount(cs)
    const [yes, no] = split(cs, q)
    return Math.max(walk(yes, [...asked, q]), walk(no, [...asked, q]))
  }
  return walk(cands, [])
}
