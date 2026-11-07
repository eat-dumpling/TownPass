// 把共用的分類規則（臺北市環保局資料）轉成這個 App 需要的回答：叫什麼、用什麼裝、什麼時候丟。
import { allItems, officialById, visibleItems } from '@/domain/catalog'
import type { Item, KindId } from '@/domain/types'
import { notes } from '~/i18n/notes'
import type { LangId } from '~/i18n'

export const items = (): Item[] => visibleItems()
export const itemById = (id: string) => allItems.find((i) => i.id === id)

/** 品項名稱：中文或英文（越南文、印尼文還沒有，退回英文） */
export function itemName(it: Item, lang: LangId): string {
  if (lang === 'zh') return it.name.zh
  return it.name.en
}
export function itemNote(it: Item, lang: LangId): string | undefined {
  const n = notes[it.id]
  if (!n) return lang === 'zh' ? it.notes : undefined
  return lang === 'zh' ? n.zh : n.en
}

const RECYCLE: KindId[] = ['paper', 'plastic', 'glass', 'can', 'tetra', 'metal', 'other']
/** 用什麼裝（對應 i18n 的 bag.*） */
export function bagKey(it: Item): 'general' | 'food' | 'recycle' | 'hazard' | 'bulky' | 'special' | 'unknown' {
  if (it.status === 'conflict' || it.category === 'unknown') return 'unknown'
  if (it.kind === 'general') return 'general'
  if (it.kind === 'food') return 'food'
  if (RECYCLE.includes(it.kind)) return 'recycle'
  if (it.kind === 'hazard') return 'hazard'
  if (it.kind === 'bulky') return 'bulky'
  return 'special'
}

export type When = { mode: 'days'; days: number[] } | { mode: 'book' } | { mode: 'clinic' } | { mode: 'ask' }

// 一般垃圾與廚餘：垃圾車週一、二、四、五、六收（週三、週日停收）
export const GARBAGE_DAYS = [1, 2, 4, 5, 6]

/** 什麼時候能丟：回收類依官方 CSV 的回收時間；一般垃圾依垃圾車；大型家具要預約；特殊品交醫院藥局 */
export function whenOf(it: Item): When {
  if (it.status === 'conflict' || it.category === 'unknown') return { mode: 'ask' }
  if (it.category === 'bulky') return { mode: 'book' }
  if (it.category === 'special') return it.where.includes('clinic') ? { mode: 'clinic' } : { mode: 'days', days: GARBAGE_DAYS }
  if (it.category === 'general') return { mode: 'days', days: GARBAGE_DAYS }
  const off = officialById(it.sub)
  return { mode: 'days', days: off?.days.length ? off.days : GARBAGE_DAYS }
}

/** 今天是星期幾（臺北時間，0＝週日） */
export function taipeiDow(d = new Date()): number {
  const w = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Taipei', weekday: 'short' }).format(d)
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(w)
}

/** 從今天起算，下一個可以丟的日子（今天可以就回傳今天） */
export function nextDay(days: number[], today: number): { dow: number; inDays: number } | null {
  for (let k = 0; k < 7; k++) {
    const dow = (today + k) % 7
    if (days.includes(dow)) return { dow, inDays: k }
  }
  return null
}

/** 「今天能不能丟」頁面的類別（每一類拿官方子類的回收時間） */
export const TODAY_GROUPS: { key: string; kind: KindId; days: number[] }[] = [
  { key: 'general', kind: 'general', days: GARBAGE_DAYS },
  { key: 'food', kind: 'food', days: officialById('food')?.days ?? GARBAGE_DAYS },
  { key: 'r3d', kind: 'plastic', days: officialById('r3d_general')?.days ?? [2, 4, 6] },
  { key: 'rflat', kind: 'paper', days: officialById('rflat_paper')?.days ?? [1, 5] },
  { key: 'other', kind: 'hazard', days: officialById('other_hazard')?.days ?? GARBAGE_DAYS },
]
