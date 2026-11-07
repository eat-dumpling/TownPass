// 追車：從這班車接下來的停靠點中，挑「走過去還來得及」且步行最短的那一站。
//   k* = argmin_k w_k  s.t.  t_now + w_k ≤ l_k
import { haversine } from './geo'
import type { LatLng, Stop } from '@/domain/types'

export interface ChaseOptions { detour?: number; walkSpeed?: number /* 公尺／分鐘 */ }
export interface ChaseResult { stop: Stop; walkMin: number; dist: number }

export function chase(stops: Stop[], pos: LatLng, nowMin: number, opts: ChaseOptions = {}): ChaseResult | null {
  const detour = opts.detour ?? 1.3 // 繞路係數（可調的假設）
  const speed = opts.walkSpeed ?? 70 // 約 4.2 km/h
  let best: ChaseResult | null = null
  for (const stop of stops) {
    const dist = haversine(pos, stop) * detour
    const walkMin = dist / speed
    if (nowMin + walkMin > stop.leave) continue
    if (!best || walkMin < best.walkMin) best = { stop, walkMin, dist }
  }
  return best
}
