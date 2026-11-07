// 回收小里長的核心型別。分類只來自規則表（items.json），模型只負責認出是哪個品項。

/** 臺北的大類（決定哪台車、週幾收）：立體類、平面類、其他類（燈管電池廢油、椰子殼）、廚餘、一般垃圾、大型家具、
 *  特殊（官方分類表沒有、要另外處理：針頭、藥品、陶瓷）、unknown（官方說法衝突，請洽清潔隊） */
export type CategoryId = 'general' | 'food' | 'recycle_flat' | 'recycle_3d' | 'other' | 'bulky' | 'special' | 'unknown'
/** 孩子拖進去的桶（參考回收標誌的分法）：紙類、塑膠類、玻璃類、鐵鋁罐、鋁箔包・紙容器、金屬類、其他回收、一般垃圾、廚餘；
 *  hazard／bulky／special／unknown 不進桶子遊戲（Boss 怪、不要碰、請洽清潔隊） */
export type KindId =
  | 'paper' | 'plastic' | 'glass' | 'can' | 'tetra' | 'metal' | 'other' | 'general' | 'food'
  | 'hazard' | 'bulky' | 'special' | 'unknown'
export type WhereId = 'garbage_truck' | 'food_bin' | 'recycle_truck' | 'retailer' | 'appointment' | 'clinic'
export type PrepId =
  | 'empty' | 'rinse' | 'flatten' | 'remove_film' | 'wrap' | 'tape_terminals' | 'label' | 'drain' | 'vent_gas' | 'remove_tape'
export type HazardId = 'none' | 'sharp' | 'fire' | 'pressure' | 'medical'
/** App 的兒童安全設計（不是環保局規則）：help＝要大人幫忙、adult＝只能大人處理、no_touch＝孩子不要碰 */
export type SafetyId = 'none' | 'help' | 'adult' | 'no_touch'
export type MaterialId = 'plastic' | 'paper' | 'metal' | 'compost' | 'glass' | 'textile' | 'none'
/** 獎勵只有一種：星星（拿來蓋建築；累積的總數決定等級） */
export type ResourceId = 'star'
export type GroupId = 'drink' | 'food' | 'paper' | 'bag' | 'home' | 'device' | 'big' | 'danger'
export type AttrId =
  | 'has_food' | 'paper' | 'soft' | 'bag' | 'has_film' | 'styrofoam' | 'bottle' | 'can' | 'glass'
  | 'battery' | 'clothes' | 'clean' | 'shell'
export type Lang = 'zh' | 'en' | 'vi' | 'id'
export type AgeBand = 'young' | 'older' // young＝約 5–8 歲（三個桶）；older＝約 9–12 歲（臺北實際類別）

export interface Item {
  id: string
  icon: string // Tabler Icons 名稱（不含 Icon 前綴）；M6 換成 monster_{id}.webp 插圖
  name: Record<Lang, string>
  prompts: string[]
  group: GroupId
  attrs: Partial<Record<AttrId, boolean>>
  category: CategoryId
  /** 臺北市環保局「資源回收分類方式」的子類別 id（categories.json）；官方表沒有的為 null */
  sub: string | null
  kind: KindId
  where: WhereId[]
  steps: PrepId[]
  material: MaterialId
  rarity: 1 | 2 | 3
  freq: 1 | 2 | 3
  hazard: HazardId
  adult_only: boolean
  safety: SafetyId
  notes?: string
  source: string
  /** 只有 verified 會在正式版上線；conflict＝官方說法衝突，顯示「請洽清潔隊」 */
  status: 'verified' | 'conflict' | 'unknown'
}

export interface Question {
  id: AttrId
  text: string
  yes: { label: string; icon: string }
  no: { label: string; icon: string }
}

export interface Group { id: GroupId; label: string; icon: string }

export interface OfficialCategory { id: string; major: string; sub: string; days: number[]; when: string; examples: string[]; source: string }

export interface Building {
  id: string
  name: string
  icon: string
  cost: Partial<Record<ResourceId, number>>
  green: number
  fact: string
  /** 幾級才能蓋 */
  unlock: number
  special?: boolean
}

/** 里：一塊可以蓋建築的地；升到 unlock 級解鎖。terrain 是不能蓋的格子（水、石頭、路） */
export interface LiArea {
  id: string; name: string; unlock: number; cols: number; rows: number; ground: string; icon: string
  terrain: { water?: number[]; rock?: number[]; road?: number[] }
}

/** 等級：累積星星到 need 就升級 */
export interface Rank { lv: number; need: number; title: string; icon: string }

export type GameEvent =
  | 'item_learned' | 'item_caught' | 'item_found' | 'card_read' | 'item_logged' | 'quiz_correct' | 'level_cleared' | 'disposal_confirmed' | 'building_built'
  | 'route_cleared' | 'route_three_star' | 'own_cup' | 'streak_day' | 'rare_caught' | 'boss_recognized' | 'teach_correct'

export interface Mission {
  id: string
  type: 'daily_learning' | 'daily_action' | 'daily_explore' | 'weekly_reduce' | 'story'
  title: string
  icon: string
  goal: { event: GameEvent; count: number }
  reward: { stars: number }
  verify: 'auto' | 'parent'
  collection_day_only?: boolean
}

export interface Achievement { id: string; title: string; icon: string; event: GameEvent; tiers: number[] }

export interface Fact { category: CategoryId; text: string; source: string; status: string }

/** 垃圾車停靠點（建置後的格式；時間都是「當天第幾分鐘」） */
export interface Stop {
  id: string
  route: string // 路線
  trip: string // 車次
  seq: number // 這班車的第幾站
  arrive: number // 分鐘數，例如 19:30 → 1170
  leave: number
  name: string
  lat: number
  lng: number
  district: string
  li: string
}

export interface LatLng { lat: number; lng: number }
