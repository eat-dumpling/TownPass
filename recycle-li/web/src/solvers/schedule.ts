// 臺北收運日規則：週三、週日停收；回收分天：週一、五平面類，週二、四、六立體類。
// 資料沒有「星期幾」欄位，先以環保局公告推定（見 SPEC 待確認事項）。
import type { CategoryId } from '@/domain/types'

export const isCollectionDay = (d: Date) => d.getDay() !== 0 && d.getDay() !== 3
export function recycleOfDay(d: Date): CategoryId | null {
  const w = d.getDay()
  if (w === 1 || w === 5) return 'recycle_flat'
  if (w === 2 || w === 4 || w === 6) return 'recycle_3d'
  return null
}
/** 今晚任務能派的類別：只派孩子分對過、且安全的類別（不派廚餘、玻璃、電池、燈管） */
export function tonightCategories(d: Date, learnedCats: Set<CategoryId>): CategoryId[] {
  if (!isCollectionDay(d)) return []
  const out: CategoryId[] = []
  const r = recycleOfDay(d)
  if (r && learnedCats.has(r)) out.push(r)
  if (learnedCats.has('general')) out.push('general')
  return out
}
