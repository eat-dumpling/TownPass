import itemsJson from '@/data/items.json'
import questionsJson from '@/data/questions.json'
import groupsJson from '@/data/groups.json'
import buildingsJson from '@/data/buildings.json'
import missionsJson from '@/data/missions.json'
import achievementsJson from '@/data/achievements.json'
import factsJson from '@/data/facts.json'
import categoriesJson from '@/data/categories.json'
import ranksJson from '@/data/ranks.json'
import lisJson from '@/data/lis.json'
import type {
  Achievement, AgeBand, Building, CategoryId, Fact, Group, Item, KindId, LiArea, Mission, OfficialCategory, PrepId,
  Question, Rank, ResourceId, SafetyId, WhereId,
} from './types'

export const allItems = itemsJson as Item[]
export const questions = questionsJson as Question[]
export const groups = groupsJson as Group[]
export const buildings = buildingsJson as Building[]
export const missions = missionsJson as Mission[]
export const achievements = achievementsJson as Achievement[]
export const facts = factsJson as Fact[]
/** 臺北市環保局「資源回收分類方式」（scripts/build_categories.py 由官方 CSV 產生） */
export const officialCategories = categoriesJson as OfficialCategory[]
export const officialById = (id: string | null | undefined) => officialCategories.find((c) => c.id === id)

/** 正式版只顯示 verified 與 conflict（conflict 會顯示「請洽清潔隊」）；開發時用 VITE_SHOW_UNVERIFIED 顯示全部 */
export function visibleItems(showUnverified = import.meta.env?.VITE_SHOW_UNVERIFIED === 'true'): Item[] {
  return allItems.filter((i) => showUnverified || i.status !== 'unknown')
}

export const itemById = (id: string): Item | undefined => allItems.find((i) => i.id === id)

const WEEK = '日一二三四五六'
export const daysText = (days: number[]) => (days.length ? '星期' + days.map((d) => WEEK[d]).join('、') : '')

// ── 臺北大類：哪台車、週幾收（週幾來自官方 CSV） ───────────────────────────
export interface CategoryMeta { id: CategoryId; label: string; color: string; soft: string; icon: string; days: number[] }
const daysOf = (sub: string) => officialById(sub)?.days ?? []

export const categoryMeta: Record<CategoryId, CategoryMeta> = {
  recycle_3d: { id: 'recycle_3d', label: '立體類', color: '#1F7A4D', soft: '#E1F1E7', icon: 'Recycle', days: daysOf('r3d_general') },
  recycle_flat: { id: 'recycle_flat', label: '平面類', color: '#1B2A6B', soft: '#E2E6F4', icon: 'News', days: daysOf('rflat_paper') },
  other: { id: 'other', label: '其他類', color: '#5B3E99', soft: '#ECE6F7', icon: 'Battery2', days: daysOf('other_hazard') },
  food: { id: 'food', label: '廚餘', color: '#6E8B3D', soft: '#EDF3E2', icon: 'Leaf', days: daysOf('food') },
  general: { id: 'general', label: '一般垃圾', color: '#D2552A', soft: '#FBE7DE', icon: 'Trash', days: [1, 2, 4, 5, 6] },
  bulky: { id: 'bulky', label: '大型家具家電', color: '#475259', soft: '#E3E7E9', icon: 'Sofa', days: daysOf('bulky') },
  special: { id: 'special', label: '特殊處理', color: '#E6692C', soft: '#FBE7D9', icon: 'AlertTriangle', days: [] },
  unknown: { id: 'unknown', label: '請洽清潔隊', color: '#AD7B2B', soft: '#FCF2DF', icon: 'Phone', days: [] },
}

// ── 孩子的桶：參考回收標誌的分法與顏色 ──────────────────────────────────
export interface KindMeta { id: KindId; label: string; en: string; color: string; icon: string }
export const kindMeta: Record<KindId, KindMeta> = {
  general: { id: 'general', label: '一般垃圾', en: 'Other Trash', color: '#D2552A', icon: 'Trash' },
  food: { id: 'food', label: '廚餘', en: 'Food Waste', color: '#6E8B3D', icon: 'Leaf' },
  paper: { id: 'paper', label: '紙類', en: 'Paper', color: '#1B2A6B', icon: 'News' },
  plastic: { id: 'plastic', label: '塑膠類', en: 'Plastic', color: '#B5161E', icon: 'Bottle' },
  glass: { id: 'glass', label: '玻璃類', en: 'Glass', color: '#2E9D45', icon: 'Glass' },
  can: { id: 'can', label: '鐵鋁罐', en: 'Cans', color: '#6B2D26', icon: 'Beer' },
  tetra: { id: 'tetra', label: '鋁箔包・紙容器', en: 'Cartons', color: '#D6157A', icon: 'Milk' },
  metal: { id: 'metal', label: '金屬類', en: 'Metal', color: '#C99A26', icon: 'Scissors' },
  other: { id: 'other', label: '其他回收', en: 'Other Recycle', color: '#2F6F86', icon: 'Recycle' },
  hazard: { id: 'hazard', label: '電池・燈管・廢油', en: 'Hazardous', color: '#5B3E99', icon: 'Battery2' },
  bulky: { id: 'bulky', label: '大型家具家電', en: 'Bulky', color: '#475259', icon: 'Sofa' },
  special: { id: 'special', label: '特殊處理', en: 'Special', color: '#E6692C', icon: 'AlertTriangle' },
  unknown: { id: 'unknown', label: '請洽清潔隊', en: 'Ask', color: '#AD7B2B', icon: 'Phone' },
}

/** 桶子：5–8 歲三個（一般垃圾、資源回收、廚餘）；9–12 歲依回收標誌分九個 */
export type BinId = KindId | 'recycle'
export interface BinMeta { id: BinId; label: string; color: string; icon: string }
const RECYCLE_KINDS: KindId[] = ['paper', 'plastic', 'glass', 'can', 'tetra', 'metal', 'other']

export function binsFor(age: AgeBand): BinMeta[] {
  const k = (id: KindId): BinMeta => ({ id, label: kindMeta[id].label, color: kindMeta[id].color, icon: kindMeta[id].icon })
  if (age === 'young') {
    return [k('general'), { id: 'recycle', label: '資源回收', color: '#1F7A4D', icon: 'Recycle' }, k('food')]
  }
  return [...RECYCLE_KINDS.map(k), k('general'), k('food')]
}

/** 這個品項在該年齡段應該進哪個桶；危險、大型、特殊、待確認的品項不進桶子遊戲（回傳 null） */
export function correctBin(item: Item, age: AgeBand): BinId | null {
  if (!RECYCLE_KINDS.includes(item.kind) && item.kind !== 'general' && item.kind !== 'food') return null
  if (age === 'young' && RECYCLE_KINDS.includes(item.kind)) return 'recycle'
  return item.kind
}

/** 孩子看到的顏色與名稱跟著「這個等級要丟的桶」走（例如 3 個桶時寶特瓶是綠色的資源回收，不是紅色的塑膠類），不進桶的用類別本身 */
export function binMetaFor(item: Item, age: AgeBand): BinMeta {
  const b = correctBin(item, age)
  const k = kindMeta[item.kind]
  return binsFor(age).find((x) => x.id === b) ?? { id: item.kind, label: k.label, color: k.color, icon: k.icon }
}

/** 交給誰、星期幾：先看官方子類別，沒有的看大類 */
export function collectionOf(item: Item): { label: string; when: string; source?: string } {
  const off = officialById(item.sub)
  if (off && off.id !== 'non_recyclable') return { label: `${off.major}・${off.sub}`, when: off.when, source: off.source }
  if (item.category === 'general') return { label: '一般垃圾（不可回收）', when: '交垃圾車（週三、週日停收）', source: off?.source }
  if (item.category === 'special') return { label: '特殊處理', when: item.notes ?? '' }
  if (item.category === 'unknown') return { label: '官方說法不一致', when: '請大人問清潔隊' }
  const c = categoryMeta[item.category]
  return { label: c.label, when: daysText(c.days) }
}

/** Boss 怪：要大人幫忙或只能大人處理；no_touch 直接走「不要碰」 */
export const isBoss = (i: Item) => i.safety === 'help' || i.safety === 'adult'
export const isNoTouch = (i: Item) => i.safety === 'no_touch'

export const safetyLabel: Record<SafetyId, string> = {
  none: '',
  help: '要大人幫忙',
  adult: '只能大人處理',
  no_touch: '不要碰，請大人處理',
}

export const prepMeta: Record<PrepId, { label: string; icon: string }> = {
  empty: { label: '倒空', icon: 'GlassOff' },
  rinse: { label: '沖一下', icon: 'Droplets' },
  flatten: { label: '壓扁', icon: 'ArrowsMinimize' },
  remove_film: { label: '撕膜', icon: 'Scissors' },
  wrap: { label: '包好', icon: 'Package' },
  tape_terminals: { label: '貼膠帶', icon: 'Bandage' },
  label: { label: '寫標示', icon: 'Tag' },
  drain: { label: '瀝乾', icon: 'DropletHalf2' },
  vent_gas: { label: '排空氣', icon: 'Wind' },
  remove_tape: { label: '抽出磁帶', icon: 'Scissors' },
}

export const whereMeta: Record<WhereId, { label: string; icon: string }> = {
  garbage_truck: { label: '垃圾車', icon: 'Truck' },
  food_bin: { label: '廚餘桶', icon: 'Bucket' },
  recycle_truck: { label: '資源回收車', icon: 'Recycle' },
  retailer: { label: '商店回收', icon: 'BuildingStore' },
  appointment: { label: '預約清潔隊', icon: 'Phone' },
  clinic: { label: '醫院或藥局', icon: 'BuildingHospital' },
}

// ── 星星：唯一的獎勵。分對、讀分辨卡、答對題目、完成任務都拿星星；星星拿來蓋建築，累積的總數決定等級 ──
export const resourceMeta: Record<ResourceId, { label: string; icon: string; color: string }> = {
  star: { label: '星星', icon: 'Star', color: '#E7A43C' },
}
export const ranks = ranksJson as Rank[]
export const lis = lisJson as LiArea[]
/** 累積 total 顆星是第幾級，以及離下一級還差多少 */
export function rankFor(total: number) {
  const cur = [...ranks].reverse().find((r) => total >= r.need) ?? ranks[0]
  const next = ranks.find((r) => r.lv === cur.lv + 1)
  return { ...cur, next, into: total - cur.need, span: next ? next.need - cur.need : 0 }
}
/** 分對的星星：基本值看稀有度（1–3）；分錯後再對只拿一半。遊戲設定，不代表真實回收價值 */
export function catchReward(item: Item, retried: boolean): { resource: ResourceId; amount: number } {
  return { resource: 'star', amount: Math.max(1, Math.round(item.rarity * (retried ? 0.5 : 1))) }
}
export function factFor(cat: CategoryId): Fact | undefined {
  return facts.find((f) => f.category === cat)
}
