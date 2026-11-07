// 地理計算：全部在手機上做；座標用完就丟，只存停靠點編號。
import type { LatLng, Stop } from '@/domain/types'

const R = 6371000
const rad = (d: number) => (d * Math.PI) / 180

/** 半正矢公式（公尺） */
export function haversine(a: LatLng, b: LatLng): number {
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

export function nearestStops(stops: Stop[], pos: LatLng, radiusM = 500): { stop: Stop; dist: number }[] {
  return stops
    .map((stop) => ({ stop, dist: haversine(pos, stop) }))
    .filter((s) => s.dist <= radiusM)
    .sort((a, b) => a.dist - b.dist)
}

export function tripStops(stops: Stop[], route: string, trip: string): Stop[] {
  return stops.filter((s) => s.route === route && s.trip === trip).sort((a, b) => a.seq - b.seq)
}

export interface MyTrip { route: string; trip: string; stopId: string }

/**
 * 決定「我家的那班車」：步行範圍內，距離最近；距離差不多（50 公尺內）時選傍晚 18:00 後的班次。
 */
export function findMyTrip(stops: Stop[], pos: LatLng, radiusM = 500): MyTrip | null {
  const near = nearestStops(stops, pos, radiusM)
  if (near.length === 0) return null
  const d0 = near[0].dist
  const close = near.filter((n) => n.dist <= d0 + 50)
  const pick = close.find((n) => n.stop.arrive >= 18 * 60) ?? close[0]
  return { route: pick.stop.route, trip: pick.stop.trip, stopId: pick.stop.id }
}

export const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(Math.round(min % 60)).padStart(2, '0')}`
/** 「1630」或「16:30」→ 990 */
export const toMin = (s: string) => {
  const t = s.replace(':', '').padStart(4, '0')
  return Number(t.slice(0, 2)) * 60 + Number(t.slice(2, 4))
}
