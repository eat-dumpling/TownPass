// 即時物件偵測（裝置端）：MediaPipe Object Detector + EfficientDet（int8，Apache-2.0）。
// 只負責「東西在畫面的哪裡、大概是什麼形狀」（COCO 80 類：bottle、cup、bowl、book、scissors…）。框不到時由 saliency.ts 補，
// 框內區域再交給 CLIP 判斷是臺北的哪個品項；偵測器的類別當作 CLIP 的先驗（prior.ts）。
//
// 模型：即時掃描用 EfficientDet-Lite0（CPU 約 60 ms／幀，開發機），辨識測試室用 Lite2（較準，約 150 ms）。
// 平均一幀超過 SLOW_MS 時呼叫端可以降低偵測頻率或換模型。
import { FilesetResolver, ObjectDetector } from '@mediapipe/tasks-vision'
import type { Det } from './tracker'
import { BIG_CLASSES } from './pipeline'

export type { Det }
export type DetModel = 'efficientdet_lite2' | 'efficientdet_lite0'
export const SLOW_MS = 140

// 這些是人、動物、交通工具或固定設備，不當成要丟的東西
const IGNORE = new Set([
  'person', 'sink', 'car', 'bus', 'truck', 'motorcycle', 'train', 'potted plant', 'cat', 'dog', 'bird', 'horse',
  // 身上穿戴的（掛繩常被當成 tie）不是要丟的東西
  'tie', 'backpack', 'umbrella',
])

let fileset: Awaited<ReturnType<typeof FilesetResolver.forVisionTasks>> | null = null
const loading = new Map<DetModel, Promise<ObjectDetector>>()

export function loadDetector(model: DetModel = 'efficientdet_lite2'): Promise<ObjectDetector> {
  const hit = loading.get(model)
  if (hit) return hit
  const p = (async () => {
    const base = document.baseURI
    fileset ??= await FilesetResolver.forVisionTasks(new URL('mediapipe/', base).href)
    const modelAssetPath = new URL(`models/mediapipe/${model}.tflite`, base).href
    const opts = (delegate: 'CPU') => ({
      baseOptions: { modelAssetPath, delegate },
      runningMode: 'VIDEO' as const,
      // 門檻放低：類別不重要（CLIP 會命名），重要的是把東西框到；誤框由追蹤（出現兩次才畫）與「不是垃圾」類別過濾
      scoreThreshold: 0.12,
      maxResults: 8,
    })
    // 實測：int8 模型在 GPU delegate 上輸出壞掉（每張圖都回傳一樣的「bed 0.29」），CPU 正常（寶特瓶 bottle 0.69）。固定 CPU。
    const det = await ObjectDetector.createFromOptions(fileset, opts('CPU'))
    // 暖機：第一次推論要編譯 GPU 程式（實測約 3 秒），先用空白畫面跑一次，孩子對準時就不會卡
    const warm = document.createElement('canvas')
    warm.width = warm.height = 64
    det.detectForVideo(warm, nextTs(performance.now()))
    return det
  })()
  p.catch(() => loading.delete(model))
  loading.set(model, p)
  return p
}

// VIDEO 模式要求時間戳嚴格遞增（暖機用的時間可能比下一個 rAF 時間晚）
let lastTs = 0
const nextTs = (ts: number) => (lastTs = Math.max(ts, lastTs + 1))

export function detect(det: ObjectDetector, source: TexImageSource, ts: number, vw: number, vh: number): Det[] {
  const r = det.detectForVideo(source, nextTs(ts))
  const out: Det[] = []
  for (const d of r.detections) {
    const b = d.boundingBox
    if (!b) continue
    const label = d.categories[0]?.categoryName ?? ''
    if (IGNORE.has(label)) continue
    // 太小（不到畫面 1.5%）或幾乎佔滿整個畫面（通常是桌面）的不要；大型家具家電（BIG_CLASSES）靠近拍時本來就會佔滿畫面
    const frac = (b.width * b.height) / (vw * vh)
    if (frac < 0.015 || (frac > 0.92 && !BIG_CLASSES.has(label))) continue
    out.push({ x: b.originX, y: b.originY, w: b.width, h: b.height, label, score: d.categories[0]?.score ?? 0 })
  }
  return nms(out, 0.6)
}

/** 不分類別的非極大值抑制：同一個東西被框成 cup 又框成 bottle 時只留分數高的 */
export function nms(dets: Det[], thr: number): Det[] {
  const sorted = [...dets].sort((a, b) => b.score - a.score)
  const keep: Det[] = []
  for (const d of sorted) {
    if (keep.every((k) => overlap(k, d) < thr)) keep.push(d)
  }
  return keep
}
function overlap(a: Det, b: Det) {
  const x1 = Math.max(a.x, b.x), y1 = Math.max(a.y, b.y)
  const x2 = Math.min(a.x + a.w, b.x + b.w), y2 = Math.min(a.y + a.h, b.y + b.h)
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1)
  return inter / (Math.min(a.w * a.h, b.w * b.h) || 1) // 小框被大框包住也算重疊
}

/** 框外擴成正方形（CLIP 的輸入是正方形），並限制在畫面內 */
export function squareCrop(b: { x: number; y: number; w: number; h: number }, vw: number, vh: number, pad = 0.12) {
  const side = Math.min(Math.max(b.w, b.h) * (1 + pad * 2), vw, vh)
  const cx = b.x + b.w / 2
  const cy = b.y + b.h / 2
  const sx = Math.min(Math.max(0, cx - side / 2), vw - side)
  const sy = Math.min(Math.max(0, cy - side / 2), vh - side)
  return { sx, sy, side }
}

/** 偵測耗時的移動平均，給自動降級用 */
export class DetTimer {
  avg = 0
  n = 0
  push(ms: number) { this.n++; this.avg = this.n === 1 ? ms : this.avg * 0.9 + ms * 0.1 }
  get slow() { return this.n > 20 && this.avg > SLOW_MS }
}
