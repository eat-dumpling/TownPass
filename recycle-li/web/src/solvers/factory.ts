// OR②：回收工廠（整數規劃，分支定界）。
//   max Σ g_j x_j + Σ b y_j
//   s.t. Σ_j a_ij x_j ≤ R_i（每種資源）, Σ_j x_j ≤ N（空地）, x_j ≤ N y_j, x_j ∈ Z≥0, y_j ∈ {0,1}
import type { Building } from '@/domain/types'

// 資源種類用字串：遊戲現在只有「star」一種，但求解器保持一般的多資源整數規劃
type ResourceId = string

export interface FactoryInput {
  buildings: (Pick<Building, 'id' | 'green'> & { cost: Partial<Record<string, number>> })[]
  resources: Partial<Record<ResourceId, number>>
  slots: number
  diversityBonus: number
}
export type Counts = Record<string, number>
export interface FactoryResult { counts: Counts; value: number }

const resKeys = (input: FactoryInput) => {
  const s = new Set<ResourceId>()
  input.buildings.forEach((b) => Object.keys(b.cost).forEach((k) => s.add(k as ResourceId)))
  return [...s]
}

export function value(input: FactoryInput, counts: Counts): number {
  return input.buildings.reduce((v, b) => {
    const x = counts[b.id] ?? 0
    return v + b.green * x + (x > 0 ? input.diversityBonus : 0)
  }, 0)
}

export function used(input: FactoryInput, counts: Counts): Partial<Record<ResourceId, number>> {
  const u: Partial<Record<ResourceId, number>> = {}
  for (const b of input.buildings) {
    const x = counts[b.id] ?? 0
    for (const [r, a] of Object.entries(b.cost)) u[r as ResourceId] = (u[r as ResourceId] ?? 0) + (a ?? 0) * x
  }
  return u
}

export function feasible(input: FactoryInput, counts: Counts): boolean {
  const total = Object.values(counts).reduce((s, x) => s + x, 0)
  if (total > input.slots) return false
  const u = used(input, counts)
  return resKeys(input).every((r) => (u[r] ?? 0) <= (input.resources[r] ?? 0))
}

function maxCount(b: FactoryInput['buildings'][number], left: Partial<Record<ResourceId, number>>, slotsLeft: number) {
  let m = slotsLeft
  for (const [r, a] of Object.entries(b.cost)) if (a && a > 0) m = Math.min(m, Math.floor((left[r as ResourceId] ?? 0) / a))
  return Math.max(0, m)
}

/** 分支定界求最佳解；規模是 5–8 種建築、十幾個空地，手機上即時完成 */
export function solve(input: FactoryInput): FactoryResult {
  const bs = [...input.buildings].sort((a, b) => b.green - a.green)
  let best: FactoryResult = { counts: {}, value: 0 }
  const counts: Counts = {}
  const left: Partial<Record<ResourceId, number>> = { ...input.resources }

  const bound = (j: number, slotsLeft: number) => {
    // 上界：剩下每種建築各自最多能蓋幾個（忽略彼此搶資源），再被空地數截斷
    let byType = 0
    let maxG = 0
    for (let k = j; k < bs.length; k++) {
      const m = maxCount(bs[k], left, slotsLeft)
      if (m > 0) { byType += bs[k].green * m + input.diversityBonus; maxG = Math.max(maxG, bs[k].green) }
    }
    const bySlots = slotsLeft * maxG + input.diversityBonus * (bs.length - j)
    return Math.min(byType, bySlots)
  }

  const dfs = (j: number, slotsLeft: number, cur: number) => {
    if (cur > best.value) best = { counts: { ...counts }, value: cur }
    if (j === bs.length || slotsLeft === 0) return
    if (cur + bound(j, slotsLeft) <= best.value) return
    const b = bs[j]
    for (let x = maxCount(b, left, slotsLeft); x >= 0; x--) {
      for (const [r, a] of Object.entries(b.cost)) left[r as ResourceId] = (left[r as ResourceId] ?? 0) - (a ?? 0) * x
      if (x > 0) counts[b.id] = x
      else delete counts[b.id]
      dfs(j + 1, slotsLeft - x, cur + b.green * x + (x > 0 ? input.diversityBonus : 0))
      for (const [r, a] of Object.entries(b.cost)) left[r as ResourceId] = (left[r as ResourceId] ?? 0) + (a ?? 0) * x
    }
    delete counts[b.id]
  }
  dfs(0, input.slots, 0)
  return best
}

/** 測試用：暴力列舉 */
export function bruteForce(input: FactoryInput): FactoryResult {
  let best: FactoryResult = { counts: {}, value: 0 }
  const bs = input.buildings
  const counts: Counts = {}
  const rec = (j: number) => {
    if (j === bs.length) {
      if (feasible(input, counts)) {
        const v = value(input, counts)
        if (v > best.value) best = { counts: { ...counts }, value: v }
      }
      return
    }
    for (let x = 0; x <= input.slots; x++) {
      if (x > 0) counts[bs[j].id] = x
      else delete counts[bs[j].id]
      rec(j + 1)
    }
    delete counts[bs[j].id]
  }
  rec(0)
  return best
}

/** 星等：孩子的綠意值 ÷ 最佳綠意值（門檻是遊戲設定） */
export function stars(mine: number, best: number): 0 | 1 | 2 | 3 {
  if (best <= 0) return 3
  const r = mine / best
  if (r >= 0.95) return 3
  if (r >= 0.75) return 2
  if (r > 0) return 1
  return 0
}

/** 第一段提示：不直接給答案，只說還有哪種資源可以再用 */
export function hint(input: FactoryInput, counts: Counts): ResourceId | null {
  const u = used(input, counts)
  const total = Object.values(counts).reduce((s, x) => s + x, 0)
  if (total >= input.slots) return null
  for (const b of input.buildings) {
    const ok = Object.entries(b.cost).every(([r, a]) => (input.resources[r as ResourceId] ?? 0) - (u[r as ResourceId] ?? 0) >= (a ?? 0))
    if (ok) {
      const r = Object.keys(b.cost)[0] as ResourceId
      return r
    }
  }
  return null
}
