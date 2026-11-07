// OR③：帶時間窗的路線最佳化（Held–Karp 動態規劃，加上 (距離, 時間) 的柏拉圖標籤）。
//   min Σ d_ij x_ij  s.t.  e_i ≤ t_i ≤ l_i（提早到可以等），每個點只去一次
// 點數最多 10–12 個，手機上可精確求解。
import { haversine } from './geo'
import type { LatLng } from '@/domain/types'

export interface TwStop extends LatLng { id: string; e: number; l: number; s: number }
export interface TwInput { start: LatLng; t0: number; stops: TwStop[]; speed: number /* 公尺／分鐘 */ }
export interface RouteEval {
  order: number[]
  arrivals: number[] // 實際開始服務時間（含等待）
  onTime: boolean[]
  distance: number
  feasible: boolean
  finish: number
}

export function evaluate(input: TwInput, order: number[]): RouteEval {
  let pos: LatLng = input.start
  let t = input.t0
  let distance = 0
  const arrivals: number[] = []
  const onTime: boolean[] = []
  for (const i of order) {
    const s = input.stops[i]
    const d = haversine(pos, s)
    distance += d
    const raw = t + d / input.speed
    onTime.push(raw <= s.l + 1e-9)
    const start = Math.max(raw, s.e)
    arrivals.push(start)
    t = start + s.s
    pos = s
  }
  return { order, arrivals, onTime, distance, feasible: onTime.every(Boolean) && order.length === input.stops.length, finish: t }
}

interface Label { dist: number; time: number; prev: Label | null; node: number }

export function solve(input: TwInput): RouteEval | null {
  const n = input.stops.length
  if (n === 0) return evaluate(input, [])
  if (n > 14) throw new Error('too many stops for Held–Karp')
  const dist = (a: LatLng, b: LatLng) => haversine(a, b)
  // labels[mask][last] = 柏拉圖前緣（距離短或時間早，互不支配）
  const labels: Label[][][] = Array.from({ length: 1 << n }, () => Array.from({ length: n }, () => []))
  const push = (bucket: Label[], lab: Label) => {
    for (const o of bucket) if (o.dist <= lab.dist + 1e-9 && o.time <= lab.time + 1e-9) return // 被支配
    for (let k = bucket.length - 1; k >= 0; k--) {
      const o = bucket[k]
      if (lab.dist <= o.dist + 1e-9 && lab.time <= o.time + 1e-9) bucket.splice(k, 1)
    }
    bucket.push(lab)
  }
  for (let i = 0; i < n; i++) {
    const s = input.stops[i]
    const d = dist(input.start, s)
    const raw = input.t0 + d / input.speed
    if (raw > s.l) continue
    push(labels[1 << i][i], { dist: d, time: Math.max(raw, s.e) + s.s, prev: null, node: i })
  }
  for (let mask = 1; mask < 1 << n; mask++) {
    for (let last = 0; last < n; last++) {
      for (const lab of labels[mask][last]) {
        for (let j = 0; j < n; j++) {
          if (mask & (1 << j)) continue
          const s = input.stops[j]
          const d = dist(input.stops[last], s)
          const raw = lab.time + d / input.speed
          if (raw > s.l) continue
          push(labels[mask | (1 << j)][j], { dist: lab.dist + d, time: Math.max(raw, s.e) + s.s, prev: lab, node: j })
        }
      }
    }
  }
  let best: Label | null = null
  for (const lab of labels[(1 << n) - 1].flat()) if (!best || lab.dist < best.dist) best = lab
  if (!best) return null
  const order: number[] = []
  for (let l: Label | null = best; l; l = l.prev) order.unshift(l.node)
  return evaluate(input, order)
}
