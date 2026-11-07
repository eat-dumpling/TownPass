// 多物件追蹤（像 YOLO 的即時框選）：每個偵測框配一個追蹤 id，跨幀保留、平滑移動，各自累積自己的辨識結果。
//
// 為什麼要追蹤：單看每一幀，框會抖、偶爾漏框、CLIP 每次看到的裁切都不一樣 → 標籤一直跳。
// 追蹤後：框用指數平滑；漏幾幀不會消失；每個追蹤目標把多次辨識的機率平均起來（等於免費的多次取樣），
// 標籤換人需要連續兩次明顯勝出（遲滯），所以畫面上的名字很穩定。
import type { Item, KindId } from '@/domain/types'
import params from './params.json'
import { COCO_TO_ITEMS, PRIOR_MIN_SCORE } from './prior'

export interface Det { x: number; y: number; w: number; h: number; label: string; score: number; /** 什麼都框不到時的畫面中央框（pipeline.ts 的 centerBox） */ center?: boolean }

export interface Track {
  id: number
  x: number; y: number; w: number; h: number // 平滑後的框（影片座標）
  coco: string // 偵測器的類別（bottle、cup…），當 CLIP 的提示
  cocoScore: number
  hits: number // 被偵測到的次數
  misses: number // 連續沒被偵測到的幀數
  age: number
  // 辨識累積
  probs: Map<string, number[]> // 品項 id → 最近幾次的機率
  items: Map<string, Item>
  obs: number
  lastClassified: number // performance.now()
  label: Item | null // 目前顯示的品項（有遲滯）
  conf: number // 目前標籤的平均機率
  challenger: string | null
  challengerStreak: number
  nothing: number // 「不是垃圾」的平均機率
  /** 品項不確定時，最可能的桶與它的機率加總（「只顯示塑膠類」用） */
  kind: KindId | null
  kindConf: number
  /** 目前最可能的品項（不一定夠確定；「可能是 X？」用） */
  guess: Item | null
  guessConf: number
  /** 第一次看就說出名字（快速回答） */
  fast: boolean
  /** 畫面上目前的回答層級（有遲滯，避免字在兩種之間跳來跳去） */
  level: AnswerLevel
  /** 畫面中央框（什麼都框不到時）：沒把握時不畫、閒置時少辨識 */
  center: boolean
  /** 上一次辨識的影像向量：框裡換了東西（向量差很多）就重新開始認 */
  lastVec: number[] | null
}

export type AnswerLevel = 'item' | 'maybe' | 'kind' | 'unsure'

export const TRACKER = {
  MATCH_IOU: 0.25, // 偵測框和追蹤框重疊這麼多才算同一個
  MAX_MISSES: 10, // 連續漏框幀數超過就刪除（15 fps 約 0.7 秒）
  MIN_HITS: 2, // 出現兩次才畫出來（濾掉一閃即逝的誤判）
  BOX_ALPHA: 0.45, // 框的平滑程度（越小越平滑）
  WINDOW: 6, // 每個追蹤目標保留最近幾次辨識
  // 什麼時候回答：由 scripts/tune.mjs 用真實照片選（顯示出來的答案至少 85% 對），存在 params.json
  SHOW_P: (params as { SHOW_P?: number }).SHOW_P ?? 0.3, // 平均機率超過就顯示品項名稱…
  SHOW_P_MIN: (params as { SHOW_P_MIN?: number }).SHOW_P_MIN ?? 0.12, // …或者至少這麼高、而且比第二名高 SHOW_RATIO 倍
  SHOW_RATIO: (params as { SHOW_RATIO?: number }).SHOW_RATIO ?? 1.6,
  KIND_P: (params as { KIND_P?: number }).KIND_P ?? 0.6, // 品項不確定時，某個桶的機率加總超過這個值 → 只顯示桶
  MAYBE_P: (params as { MAYBE_P?: number }).MAYBE_P ?? 0.3, // 不夠確定但第一名至少這麼高 → 「可能是 X？」
  MIN_OBS: 2, // 至少看過幾次才回答（多次平均比單次穩）
  // 快速回答：第一次看就很有把握時不用等第二次（省一次辨識，約 0.65 秒）。
  // FAST_P 由 scripts/tune.mjs 選（看一次就說的品項至少 93% 對）；
  // FAST_P_AGREE：偵測器也同意時（例：偵測器說 cup、模型說紙杯）門檻較低——兩個模型各自看出來，錯的機會小很多。紙杯、寶特瓶、鋁罐這類常見的東西大多走這條。
  FAST_P: (params as { FAST_P?: number }).FAST_P ?? 0.95,
  FAST_P_AGREE: (params as { FAST_P_AGREE?: number }).FAST_P_AGREE ?? 0.6,
  SWITCH_MARGIN: 0.08, // 新品項要比目前標籤高這麼多…
  SWITCH_STREAK: 2, // …而且連續兩次，才換標籤
  // 遲滯：「可能是 X？」「塑膠類」已經顯示時，要掉到門檻的 STICKY 倍以下才拿掉；X 要被明顯超過（SWITCH_MARGIN）才換
  STICKY: 0.8,
  REVIVE_FRAMES: 20, // 消失後這麼多幀內（15 fps 約 1.3 秒）同一個位置又出現 → 接回原本的辨識結果
  REVIVE_IOU: 0.3,
  RESET_COS: (params as { RESET_COS?: number }).RESET_COS ?? 0.7, // 前後兩次影像向量的 cosine 低於這個值 → 框裡換了東西，重新認
  CENTER_IDLE_MS: 1500, // 畫面中央框沒認出東西時，每隔這麼久才再看一次（省電）
  FAST_P_COMMON: (params as { FAST_P_COMMON?: number }).FAST_P_COMMON ?? (params as { FAST_P?: number }).FAST_P ?? 0.95, // 常見品項（freq 3：杯子、瓶罐、袋子…）看一次就說的門檻
}

export function iou(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) {
  const x1 = Math.max(a.x, b.x), y1 = Math.max(a.y, b.y)
  const x2 = Math.min(a.x + a.w, b.x + b.w), y2 = Math.min(a.y + a.h, b.y + b.h)
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1)
  return inter / (a.w * a.h + b.w * b.h - inter || 1)
}

export class Tracker {
  tracks: Track[] = []
  private nextId = 1
  private frame = 0
  /** 剛消失的追蹤目標：偵測器漏框太久被刪掉後，同一個位置又框到時接回原本的辨識結果（不用從頭認） */
  private recent: { t: Track; at: number }[] = []

  /** 每次偵測後呼叫：貪婪 IoU 配對、平滑、建立與刪除追蹤 */
  update(dets: Det[]): Track[] {
    const pairs: { t: Track; d: Det; o: number }[] = []
    for (const t of this.tracks) for (const d of dets) {
      const o = iou(t, d)
      if (o >= TRACKER.MATCH_IOU) pairs.push({ t, d, o })
    }
    pairs.sort((a, b) => b.o - a.o)
    const usedT = new Set<Track>()
    const usedD = new Set<Det>()
    for (const { t, d } of pairs) {
      if (usedT.has(t) || usedD.has(d)) continue
      usedT.add(t); usedD.add(d)
      const a = TRACKER.BOX_ALPHA
      t.x += (d.x - t.x) * a; t.y += (d.y - t.y) * a; t.w += (d.w - t.w) * a; t.h += (d.h - t.h) * a
      if (d.score >= t.cocoScore * 0.8 || d.label === t.coco) { t.coco = d.label; t.cocoScore = d.score }
      if (!d.center) t.center = false
      t.hits++; t.misses = 0
    }
    this.frame++
    for (const t of this.tracks) { t.age++; if (!usedT.has(t)) t.misses++ }
    for (const t of this.tracks) if (t.misses > TRACKER.MAX_MISSES && t.obs) this.recent.push({ t, at: this.frame })
    this.tracks = this.tracks.filter((t) => t.misses <= TRACKER.MAX_MISSES)
    this.recent = this.recent.filter((r) => this.frame - r.at <= TRACKER.REVIVE_FRAMES)
    for (const d of dets) {
      if (usedD.has(d)) continue
      const nt = newTrack(this.nextId++, d)
      const old = this.recent.find((r) => iou(r.t, d) >= TRACKER.REVIVE_IOU)
      if (old) { inherit(nt, old.t); this.recent = this.recent.filter((r) => r !== old) }
      this.tracks.push(nt)
    }
    return this.visible()
  }

  visible(): Track[] {
    return this.tracks.filter((t) => t.hits >= TRACKER.MIN_HITS)
  }

  /** 下一個要給 CLIP 看的目標：還沒有標籤的優先，其次最久沒看的；大一點、靠中間的優先 */
  nextToClassify(vw: number, vh: number): Track | null {
    let best: Track | null = null
    let bestScore = -Infinity
    const now = performance.now()
    for (const t of this.visible()) {
      if (t.misses > 2) continue
      if (t.center && t.obs >= 2 && t.level === 'unsure' && now - t.lastClassified < TRACKER.CENTER_IDLE_MS) continue
      const cx = (t.x + t.w / 2) / vw - 0.5, cy = (t.y + t.h / 2) / vh - 0.5
      const center = 1 - Math.min(1, Math.hypot(cx, cy) * 1.5)
      const area = Math.min(1, (t.w * t.h) / (vw * vh) / 0.2)
      const wait = Math.min(3, (now - t.lastClassified) / 1000)
      const s = (t.label ? 0 : 2) + wait + center + area
      if (s > bestScore) { bestScore = s; best = t }
    }
    return best
  }

  clear() { this.tracks = []; this.recent = [] }
}

/** 新的追蹤目標接手剛消失那個的辨識結果（框用新的；辨識的平均、標籤、遲滯狀態用舊的） */
function inherit(nt: Track, old: Track) {
  nt.id = old.id // 同一個 id：畫面下方的卡片不會重畫，「不對」也找得到之前的影像向量
  nt.probs = old.probs; nt.items = old.items; nt.obs = old.obs; nt.lastClassified = old.lastClassified
  nt.label = old.label; nt.conf = old.conf; nt.nothing = old.nothing; nt.kind = old.kind; nt.kindConf = old.kindConf
  nt.guess = old.guess; nt.guessConf = old.guessConf; nt.fast = old.fast; nt.level = old.level
  nt.hits = Math.max(nt.hits, TRACKER.MIN_HITS) // 接回來的馬上畫（本來就已經確認過）
}

export function newTrack(id: number, d: Det): Track {
  return {
    id, x: d.x, y: d.y, w: d.w, h: d.h, coco: d.label, cocoScore: d.score, hits: 1, misses: 0, age: 0,
    probs: new Map(), items: new Map(), obs: 0, lastClassified: 0, label: null, conf: 0,
    challenger: null, challengerStreak: 0, nothing: 0, kind: null, kindConf: 0, guess: null, guessConf: 0, fast: false, level: 'unsure', center: !!d.center, lastVec: null,
  }
}

/** 把一次辨識結果（前幾名品項機率、背景機率）加進追蹤目標，更新有遲滯的標籤 */
export function observe(t: Track, top: { item: Item; p: number }[], nothingP: number, vec?: number[]) {
  if (vec) {
    if (t.lastVec && cosine(vec, t.lastVec) < TRACKER.RESET_COS) resetRecognition(t) // 框裡換了東西
    t.lastVec = vec
  }
  t.obs++
  t.lastClassified = performance.now()
  const W = TRACKER.WINDOW
  const seen = new Set<string>()
  for (const { item, p } of top) {
    t.items.set(item.id, item)
    const arr = t.probs.get(item.id) ?? []
    // 之前沒進前幾名的次數補 0，讓平均是公平的
    while (arr.length < Math.min(t.obs - 1, W - 1)) arr.unshift(0)
    arr.push(p)
    if (arr.length > W) arr.shift()
    t.probs.set(item.id, arr)
    seen.add(item.id)
  }
  for (const [id, arr] of t.probs) {
    if (seen.has(id)) continue
    arr.push(0)
    if (arr.length > W) arr.shift()
    if (arr.every((x) => x < 0.01)) t.probs.delete(id)
  }
  t.nothing = t.nothing * 0.5 + nothingP * 0.5

  const ranked = rankedOf(t)
  const best = ranked[0]
  if (!best) return
  // 依桶加總（只用有記錄的前幾名，夠用）
  const mass = new Map<KindId, number>()
  for (const [id, arr] of t.probs) {
    const k = t.items.get(id)!.kind
    mass.set(k, (mass.get(k) ?? 0) + arr.reduce((a, b) => a + b, 0) / arr.length)
  }
  const [bk, bm] = [...mass.entries()].sort((a, b) => b[1] - a[1])[0] ?? [null, 0]
  // 桶與「可能是」的品項：已經顯示的那個要被明顯超過、或自己掉很多才換（不會 A、B 來回跳）
  const prevKindMass = t.kind ? mass.get(t.kind) ?? 0 : 0
  if (!t.kind || bk === t.kind || bm > prevKindMass + TRACKER.SWITCH_MARGIN || prevKindMass < TRACKER.KIND_P * TRACKER.STICKY) { t.kind = bk; t.kindConf = bm }
  else t.kindConf = prevKindMass
  const prevGuessP = t.guess ? ranked.find((r) => r.item.id === t.guess!.id)?.p ?? 0 : 0
  if (!t.guess || best.item.id === t.guess.id || best.p > prevGuessP + TRACKER.SWITCH_MARGIN || prevGuessP < TRACKER.MAYBE_P * TRACKER.STICKY) { t.guess = best.item; t.guessConf = best.p }
  else t.guessConf = prevGuessP
  updateLabel(t, ranked, nothingP)
  t.level = stickyLevel(t)
}

function updateLabel(t: Track, ranked: { item: Item; p: number }[], nothingP: number) {
  const best = ranked[0]
  if (!t.label) {
    if (t.obs >= TRACKER.MIN_OBS && isClear(best.p, ranked[1]?.p ?? 0)) { t.label = best.item; t.conf = best.p }
    else if (t.obs === 1 && isFast(t, best.item, best.p, nothingP)) { t.label = best.item; t.conf = best.p; t.fast = true }
    return
  }
  const cur = ranked.find((r) => r.item.id === t.label!.id)?.p ?? 0
  t.conf = cur
  if (best.item.id !== t.label.id && best.p > cur + TRACKER.SWITCH_MARGIN) {
    t.challengerStreak = t.challenger === best.item.id ? t.challengerStreak + 1 : 1
    t.challenger = best.item.id
    if (t.challengerStreak >= TRACKER.SWITCH_STREAK) { t.label = best.item; t.conf = best.p; t.challenger = null; t.challengerStreak = 0 }
  } else {
    t.challenger = null
    t.challengerStreak = 0
  }
  if (cur < TRACKER.SHOW_P_MIN * 0.5) t.label = null // 很久沒被支持就拿掉
}

/** 偵測器的類別是否支持這個品項（例：cup → 紙杯） */
export const detectorAgrees = (t: Pick<Track, 'coco' | 'cocoScore'>, itemId: string) =>
  t.cocoScore >= PRIOR_MIN_SCORE && !!COCO_TO_ITEMS[t.coco]?.includes(itemId)

/** 第一次看就能回答嗎 */
export const isFast = (t: Pick<Track, 'coco' | 'cocoScore'>, item: Item, p: number, nothingP: number) =>
  nothingP < p && (p >= ((item.freq ?? 1) >= 3 ? TRACKER.FAST_P_COMMON : TRACKER.FAST_P) || (detectorAgrees(t, item.id) && p >= TRACKER.FAST_P_AGREE))

function cosine(a: number[], b: number[]) {
  let d = 0, na = 0, nb = 0
  for (let i = 0; i < a.length; i++) { d += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i] }
  return d / (Math.sqrt(na * nb) || 1)
}

/** 框裡換了東西：辨識結果從頭開始（框本身不動） */
function resetRecognition(t: Track) {
  t.probs = new Map(); t.items = new Map(); t.obs = 0; t.label = null; t.conf = 0; t.challenger = null; t.challengerStreak = 0
  t.nothing = 0; t.kind = null; t.kindConf = 0; t.guess = null; t.guessConf = 0; t.fast = false; t.level = 'unsure'
}

/** 品項夠不夠確定（和 scripts/tune.mjs 的 itemRule 相同） */
export const isClear = (p1: number, p2: number) =>
  p1 >= TRACKER.SHOW_P || (p1 >= TRACKER.SHOW_P_MIN && p1 >= TRACKER.SHOW_RATIO * p2)

/** 畫面要怎麼回答：品項名稱、「可能是 X？」、只說桶子、或不回答（每次辨識後更新，有遲滯） */
export function answerLevel(t: Track): AnswerLevel {
  return t.obs ? t.level : 'unsure'
}

const RANK: Record<AnswerLevel, number> = { item: 2, kind: 1, maybe: 1, unsure: 0 }
/** 往上（更確定）馬上換；往下要等到真的掉到門檻的 STICKY 倍以下 */
function stickyLevel(t: Track): AnswerLevel {
  const raw = rawLevel(t)
  const prev = t.level
  if (RANK[raw] >= RANK[prev]) return raw
  if (prev === 'maybe' && t.guess && t.guessConf >= TRACKER.MAYBE_P * TRACKER.STICKY && t.nothing < t.guessConf) return 'maybe'
  if (prev === 'kind' && t.kind && t.kindConf >= TRACKER.KIND_P * TRACKER.STICKY && t.nothing < t.kindConf) return 'kind'
  return raw
}

function rawLevel(t: Track): AnswerLevel {
  if (t.label && t.nothing < t.conf) return 'item'
  if (t.obs < TRACKER.MIN_OBS) return 'unsure'
  if (t.kind && t.kindConf >= TRACKER.KIND_P && t.nothing < t.kindConf) return 'kind'
  if (t.guess && t.guessConf >= TRACKER.MAYBE_P && t.nothing < t.guessConf) return 'maybe'
  return 'unsure'
}

export function rankedOf(t: Track): { item: Item; p: number }[] {
  return [...t.probs.entries()]
    .map(([id, arr]) => ({ item: t.items.get(id)!, p: arr.reduce((a, b) => a + b, 0) / arr.length }))
    .sort((a, b) => b.p - a.p)
    .slice(0, 5)
}
