// 垃圾車停靠點：依行政區切成小檔，只下載使用者需要的那一區（public/data/stops/{行政區}.json）。
import type { Stop } from './types'

export const DISTRICTS = ['士林區', '北投區', '內湖區', '南港區', '松山區', '信義區', '中山區', '大同區', '中正區', '萬華區', '大安區', '文山區']
const cache = new Map<string, { stops: Stop[]; mock: boolean }>()

export async function loadStops(district = '士林區'): Promise<{ stops: Stop[]; mock: boolean }> {
  const hit = cache.get(district)
  if (hit) return hit
  const res = await fetch(new URL(`data/stops/${encodeURIComponent(district)}.json`, document.baseURI))
  if (!res.ok) throw new Error(`沒有 ${district} 的停靠點資料`)
  const j = (await res.json()) as { stops: Stop[]; mock?: boolean }
  const v = { stops: j.stops, mock: !!j.mock }
  cache.set(district, v)
  return v
}
