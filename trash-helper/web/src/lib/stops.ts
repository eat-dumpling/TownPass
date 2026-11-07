// 臺北市垃圾車點位路線資訊（data.taipei，4,012 筆）：找附近的停靠點與表定時間。位置只在手機上算，不保存。
import { haversine } from '@/solvers/geo'

export interface StopRow { district: string; li: string; route: string; trip: string; arrive: number; leave: number; address: string; lat: number; lng: number }
let cache: Promise<{ stops: StopRow[]; imported: string; source: string }> | null = null

export function loadStops() {
  cache ??= fetch(new URL('data/stops.json', document.baseURI))
    .then((r) => r.json())
    .then((j: { stops: (string | number)[][]; imported: string; source: string }) => ({
      imported: j.imported,
      source: j.source,
      stops: j.stops.map(([district, li, route, trip, arrive, leave, address, lat, lng]) => ({
        district, li, route, trip, arrive, leave, address, lat, lng,
      }) as StopRow),
    }))
  return cache
}

export const WALK_M_PER_MIN = 70 // 約 4.2 km/h
export const DETOUR = 1.3 // 直線距離 × 繞路係數

/** 附近的停靠點（同一個地址只留一筆，依距離排序） */
export function nearby(stops: StopRow[], pos: { lat: number; lng: number }, radiusM = 600, max = 6) {
  const seen = new Set<string>()
  return stops
    .map((s) => ({ s, d: haversine(pos, s) }))
    .filter((x) => x.d <= radiusM)
    .sort((a, b) => a.d - b.d)
    .filter((x) => (seen.has(x.s.address + x.s.arrive) ? false : (seen.add(x.s.address + x.s.arrive), true)))
    .slice(0, max)
    .map((x) => ({ ...x.s, dist: x.d, walkMin: Math.max(1, Math.round((x.d * DETOUR) / WALK_M_PER_MIN)) }))
}

export const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`
