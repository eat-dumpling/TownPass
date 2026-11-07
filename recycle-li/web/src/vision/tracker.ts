// 多物件追蹤（像 YOLO 的即時框選）：每個偵測框配一個追蹤 id，跨幀保留、平滑移動，各自累積自己的辨識結果。
//
// 為什麼要追蹤：單看每一幀，框會抖、偶爾漏框、CLIP 每次看到的裁切都不一樣 → 標籤一直跳。
// 追蹤後：框用指數平滑；漏幾幀不會消失；每個追蹤目標把多次辨識的機率平均起來（等於免費的多次取樣），
// 標籤換人需要連續兩次明顯勝出（遲滯），所以畫面上的名字很穩定。
import type { Item, KindId } from '@/domain/types'
import params from './params.json'
import { COCO_TO_ITEMS, PRIOR_MIN_SCORE } from './prior'

export interface Det { x: number; y: number; w: number; h: number; label: string; score: number }

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
}

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
      t.hits++; t.misses = 0
    }
    for (const t of this.tracks) { t.age++; if (!usedT.has(t)) t.misses++ }
    this.tracks = this.tracks.filter((t) => t.misses <= TRACKER.MAX_MISSES)
    for (const d of dets) if (!usedD.has(d)) this.tracks.push(newTrack(this.nextId++, d))
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
      const cx = (t.x + t.w / 2) / vw - 0.5, cy = (t.y + t.h / 2) / vh - 0.5
      const center = 1 - Math.min(1, Math.hypot(cx, cy) * 1.5)
      const area = Math.min(1, (t.w * t.h) / (vw * vh) / 0.2)
      const wait = Math.min(3, (now - t.lastClassified) / 1000)
      const s = (t.label ? 0 : 2) + wait + center + area
      if (s > bestScore) { bestScore = s; best = t }
    }
    return best
  }

  clear() { this.tracks = [] }
}

export function newTrack(id: number, d: Det): Track {
  return {
    id, x: d.x, y: d.y, w: d.w, h: d.h, coco: d.label, cocoScore: d.score, hits: 1, misses: 0, age: 0,
    probs: new Map(), items: new Map(), obs: 0, lastClassified: 0, label: null, conf: 0,
    challenger: null, challengerStreak: 0, nothing: 0, kind: null, kindConf: 0, guess: null, guessConf: 0, fast: false,
  }
}

/** 把一次辨識結果（前幾名品項機率、背景機率）加進追蹤目標，更新有遲滯的標籤 */
export function observe(t: Track, top: { item: Item; p: number }[], nothingP: number) {
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
  t.kind = bk
  t.kindConf = bm
  t.guess = best.item
  t.guessConf = best.p
  if (!t.label) {
    if (t.obs >= TRACKER.MIN_OBS && isClear(best.p, ranked[1]?.p ?? 0)) { t.label = best.item; t.conf = best.p }
    else if (t.obs === 1 && isFast(t, best.item.id, best.p, nothingP)) { t.label = best.item; t.conf = best.p; t.fast = true }
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
export const isFast = (t: Pick<Track, 'coco' | 'cocoScore'>, itemId: string, p: number, nothingP: number) =>
  nothingP < p && (p >= TRACKER.FAST_P || (detectorAgrees(t, itemId) && p >= TRACKER.FAST_P_AGREE))

/** 品項夠不夠確定（和 scripts/tune.mjs 的 itemRule 相同） */
export const isClear = (p1: number, p2: number) =>
  p1 >= TRACKER.SHOW_P || (p1 >= TRACKER.SHOW_P_MIN && p1 >= TRACKER.SHOW_RATIO * p2)

/** 畫面要怎麼回答：品項名稱、「可能是 X？」、只說桶子、或不回答 */
export function answerLevel(t: Track): 'item' | 'maybe' | 'kind' | 'unsure' {
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
