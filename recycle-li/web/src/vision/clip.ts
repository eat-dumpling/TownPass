// 裝置端 CLIP 辨識（競賽規範：AI 推論須於裝置端完成）。
// 模型：Xenova/clip-vit-base-patch32（OpenAI CLIP ViT-B/32 的 Transformers.js 版，MIT），只用影像模型的 q8 量化版。
// 文字向量在建置時算好（scripts/build-embeds.mjs → public/data/text_embeds.json），手機上不跑文字模型。
// 畫面只在記憶體中處理，不上傳、不存檔。
//
// 流程：影像 → 影像向量 → 與每個品項（＋「不是垃圾」背景類別）算 cosine → softmax → 品項機率
//       → 依「臺北類別」加總得到類別機率 → decide()：直接現身／問一題線索／改大圖卡／提示對準
// 模型只負責「認出是哪個品項」，類別一律查 items.json。
import type { Candidate } from '@/solvers/ask'
import { classCount } from '@/solvers/ask'
import type { CategoryId, Item } from '@/domain/types'

/** 影像模型（params.json 的 MODEL）。換模型時 text_embeds.json、class_weights.json、image_protos.json 要一起用 scripts/ 重建 */
export const VISION_MODELS = {
  clip: { id: 'Xenova/clip-vit-base-patch32', vision: 'CLIPVisionModelWithProjection', visionOut: 'image_embeds' },
  siglip: { id: 'Xenova/siglip-base-patch16-224', vision: 'SiglipVisionModel', visionOut: 'pooler_output' },
} as const
export type VisionModelName = keyof typeof VISION_MODELS
const ACTIVE = VISION_MODELS[((params as { MODEL?: VisionModelName }).MODEL ?? 'clip')]
export const MODEL_ID: string = ACTIVE.id
// 可調參數集中在 params.json：scripts/tune.mjs 用 TACO＋Wikimedia Commons 照片調好後寫回去（不要手改這裡）
import params from './params.json'
export const PARAMS = params as typeof params & { tuned?: unknown }
export const TEMPERATURE = PARAMS.TEMPERATURE // CLIP 的 logit scale（影響信心 %）
export const CONFIDENT_MASS = PARAMS.CONFIDENT_MASS // 候選都同一類別且累計機率 ≥ 這個值 → 直接現身
export const MIN_TOP1 = PARAMS.MIN_TOP1 // 最高機率低於這個值 → 改用大圖卡
export const KEEP_P = PARAMS.KEEP_P // 機率低於這個值的候選不進線索題
export const INPUT_SIZE = 224

export interface Embeds { model: string; dim: number; items: Record<string, number[]>; negatives?: Record<string, number[]> }
/** 範例向量（影像向量，不是照片）：品項 id → 多個 512 維向量。來源：開發組的測試照（建置時）＋孩子按「認錯了」時的修正（存在手機） */
export type Protos = Record<string, number[][]>
// Tip-Adapter 式的範例加分：logit += ALPHA × Σ exp(-BETA × (1 − cos))
export const PROTO_ALPHA = PARAMS.PROTO_ALPHA
export const PROTO_BETA = PARAMS.PROTO_BETA

/** image_protos.json 的壓縮格式（scripts/proto-codec.mjs）："<scale>:<base64 int8×512>" → 正規化的向量 */
export function decodeProto(p: string | number[]): number[] {
  if (Array.isArray(p)) return norm(p)
  const [sc, b64] = p.split(':')
  const scale = Number(sc)
  const bin = atob(b64)
  const out = new Array<number>(bin.length)
  for (let i = 0; i < bin.length; i++) {
    const b = bin.charCodeAt(i)
    out[i] = ((b > 127 ? b - 256 : b) / 127) * scale
  }
  return norm(out)
}
/** class_weights.json：用真實照片學到的每個品項分類向量（取代文字向量）。n＝長度、v＝方向（int8） */
export function decodeClassWeights(items: Record<string, { n: number; v: string }> | undefined): Record<string, number[]> {
  const out: Record<string, number[]> = {}
  for (const [id, { n, v }] of Object.entries(items ?? {})) out[id] = decodeProto(v).map((x) => x * n)
  return out
}
export function decodeProtos(items: Record<string, (string | number[])[]> | undefined): Protos {
  const out: Protos = {}
  for (const [id, list] of Object.entries(items ?? {})) out[id] = list.map(decodeProto)
  return out
}

export interface Scored {
  top: Candidate[] // 前 5 名品項（機率已含背景類別一起 softmax）
  byCategory: { category: CategoryId; p: number }[] // 依類別加總，由大到小
  negative: { id: string; p: number } | null // 最可能的背景類別
}

export type Decision =
  | { kind: 'reveal'; item: Item }
  | { kind: 'clue'; cands: Candidate[] }
  | { kind: 'picker' }
  | { kind: 'nothing' } // 看起來不是垃圾（人臉、空手、房間…）

const norm = (v: ArrayLike<number>) => {
  let s = 0
  for (let i = 0; i < v.length; i++) s += v[i] * v[i]
  const n = Math.sqrt(s) || 1
  return Array.from(v, (x) => x / n)
}
const dot = (a: number[], b: number[]) => {
  let s = 0
  for (let k = 0; k < a.length; k++) s += a[k] * b[k]
  return s
}

/** 純函式：影像向量 → 品項與類別機率（可單元測試，不需要模型） */
export function score(
  imageVec: ArrayLike<number>, embeds: Embeds, items: Item[], temperature = TEMPERATURE, protos: Protos = {},
  prior: ((itemId: string) => number) | null = null,
): Scored {
  const v = norm(imageVec)
  const entries: { item?: Item; neg?: string; logit: number }[] = []
  for (const item of items) {
    const t = embeds.items[item.id]
    if (!t) continue
    let logit = dot(v, t) * temperature
    for (const pv of protos[item.id] ?? []) logit += PROTO_ALPHA * Math.exp(-PROTO_BETA * (1 - dot(v, pv)))
    if (prior) logit += prior(item.id)
    entries.push({ item, logit })
  }
  // 偵測器已經很有把握框到一個物品（有類別先驗）時，不讓「人臉、手、房間」等背景類別投票：
  // 手拿瓶子靠近臉時，裁切會帶到臉，背景類別常常贏過瓶子
  if (!prior) for (const [neg, t] of Object.entries(embeds.negatives ?? {})) entries.push({ neg, logit: dot(v, t) * temperature })
  if (!entries.length) return { top: [], byCategory: [], negative: null }
  const mx = Math.max(...entries.map((e) => e.logit))
  const exps = entries.map((e) => Math.exp(e.logit - mx))
  const z = exps.reduce((a, b) => a + b, 0)
  const probs = entries.map((e, k) => ({ ...e, p: exps[k] / z }))
  const itemsP = probs.filter((e) => e.item).map((e) => ({ item: e.item!, p: e.p })).sort((a, b) => b.p - a.p)
  const negs = probs.filter((e) => e.neg).sort((a, b) => b.p - a.p)
  const cat = new Map<CategoryId, number>()
  for (const c of itemsP) cat.set(c.item.category, (cat.get(c.item.category) ?? 0) + c.p)
  return {
    top: itemsP.slice(0, 5),
    byCategory: [...cat.entries()].map(([category, p]) => ({ category, p })).sort((a, b) => b.p - a.p),
    negative: negs[0] ? { id: negs[0].neg!, p: negs[0].p } : null,
  }
}

/** 判定：同一類別且夠有把握 → 直接現身；分屬不同類別 → OR① 線索；太沒把握 → 大圖卡；背景最像 → 提示對準 */
export function decide(s: Scored): Decision {
  const top1 = s.top[0]
  if (s.negative && (!top1 || s.negative.p > top1.p)) return { kind: 'nothing' }
  if (!top1 || top1.p < MIN_TOP1) return { kind: 'picker' }
  const keep = s.top.filter((c) => c.p >= KEEP_P)
  const mass = keep.reduce((a, c) => a + c.p, 0)
  if (classCount(keep) === 1 && mass >= CONFIDENT_MASS) return { kind: 'reveal', item: keep[0].item }
  return { kind: 'clue', cands: keep }
}

// ── 載入模型（只載一次；第一次之後瀏覽器會快取） ─────────────────────────
// 優先放在 Web Worker（clip.worker.ts）跑，推論不會卡住相機畫面；不支援 Worker 時退回主執行緒。
type Embedder = (img: ImageData) => Promise<Float32Array>
type Loaded = { embed: Embedder; embeds: Embeds; shippedProtos: Protos; device: string; threads: number }
let loading: Promise<Loaded> | null = null
export const clipDevice = () => loading?.then((l) => `${l.device}${l.threads > 1 ? `×${l.threads}` : ''}`)

/** WASM 固定單執行緒。實測（speed.html，SigLIP q8，開發機）：
 *  - Worker 1 執行緒 約 640 ms／張（目前用這個，相機畫面不卡）
 *  - 主執行緒 4 執行緒 約 210 ms／張，但每次辨識主執行緒卡 0.2 秒，框和偵測會頓
 *  - Worker 裡或 onnxruntime 的 proxy Worker 開多執行緒：即使 crossOriginIsolated 也會卡在建立模型
 *  - WebGPU q8：輸出壞掉（不同圖的向量一樣）且更慢；q4f16 準確率掉約 3 個百分點 */
export const wasmThreads = () => 1

async function workerEmbedder(onProgress?: (pct: number) => void): Promise<{ embed: Embedder; threads: number }> {
  const w = new Worker(new URL('./clip.worker.ts', import.meta.url), { type: 'module' })
  const waiting = new Map<number, { ok: (v: Float32Array) => void; bad: (e: Error) => void }>()
  let nextId = 1
  const threads = await new Promise<number>((ok, bad) => {
    w.onmessage = (e) => {
      const m = e.data
      if (m.type === 'progress') onProgress?.(m.pct)
      else if (m.type === 'ready') ok(m.threads)
      else if (m.type === 'error' && m.id === -1) bad(new Error(m.message))
      else if (m.type === 'vec') { waiting.get(m.id)?.ok(m.vec); waiting.delete(m.id) }
      else if (m.type === 'error') { waiting.get(m.id)?.bad(new Error(m.message)); waiting.delete(m.id) }
    }
    w.onerror = (e) => bad(new Error(e.message))
    w.postMessage({ type: 'init', base: document.baseURI, allowRemote: import.meta.env.VITE_ALLOW_REMOTE_MODEL === 'true', model: ACTIVE.id, vision: ACTIVE.vision, visionOut: ACTIVE.visionOut, threads: wasmThreads() })
  })
  const embed: Embedder = (img) => new Promise((ok, bad) => {
    const id = nextId++
    waiting.set(id, { ok, bad })
    const buf = img.data.buffer.slice(0) as ArrayBuffer
    w.postMessage({ type: 'embed', id, data: buf, width: img.width, height: img.height }, [buf])
  })
  return { embed, threads }
}

async function mainThreadEmbedder(onProgress?: (pct: number) => void): Promise<{ embed: Embedder; threads: number }> {
  const T = await import('@huggingface/transformers')
  const base = document.baseURI
  T.env.allowLocalModels = true
  T.env.localModelPath = new URL('models/', base).href
  T.env.allowRemoteModels = import.meta.env.VITE_ALLOW_REMOTE_MODEL === 'true'
  if (T.env.backends.onnx.wasm) { T.env.backends.onnx.wasm.wasmPaths = new URL('ort/', base).href; T.env.backends.onnx.wasm.numThreads = wasmThreads() }
  const processor = (await T.AutoImageProcessor.from_pretrained(MODEL_ID)) as unknown as (i: unknown) => Promise<Record<string, unknown>>
  // 實測：q8 量化模型在 WebGPU 上輸出壞掉（任何兩張圖的 cosine ≈ 0.998），WASM 正常。固定 WASM。
  const model = (await (ACTIVE.vision === 'SiglipVisionModel' ? T.SiglipVisionModel : T.CLIPVisionModelWithProjection).from_pretrained(MODEL_ID, {
    dtype: 'q8', device: 'wasm',
    progress_callback: (p: { status: string; progress?: number }) => { if (p.status === 'progress' && p.progress != null) onProgress?.(p.progress) },
  })) as unknown as (i: Record<string, unknown>) => Promise<Record<string, { data: Float32Array }>>
  const embed: Embedder = async (img) => {
    const image = new T.RawImage(img.data, img.width, img.height, 4).rgb()
    return (await model(await processor(image)))[ACTIVE.visionOut].data
  }
  return { embed, threads: T.env.backends.onnx.wasm?.numThreads ?? 1 }
}

// 下載進度：預先載入（preload.ts）先開始時，之後進掃描頁的人也要看得到進度
const progressListeners = new Set<(pct: number) => void>()
let lastPct = 0
const emitProgress = (pct: number) => { lastPct = pct; progressListeners.forEach((f) => f(pct)) }

export function loadClip(onProgress?: (pct: number) => void): Promise<Loaded> {
  if (onProgress) { progressListeners.add(onProgress); if (lastPct) onProgress(lastPct) }
  if (loading) return loading
  loading = (async () => {
    const base = document.baseURI
    const res = await fetch(new URL('data/text_embeds.json', base))
    if (!res.ok) throw new Error('text_embeds.json 不存在，請先執行 npm run build:embeds')
    const embeds = (await res.json()) as Embeds
    // 有學到的分類向量（scripts/tune.mjs，PARAMS.CLASS_WEIGHTS）就取代文字向量；「不是垃圾」背景類別仍用文字向量
    if ((PARAMS as { CLASS_WEIGHTS?: boolean }).CLASS_WEIGHTS) {
      const cw = await fetch(new URL('data/class_weights.json', base)).then((r) => (r.ok ? r.json() : null)).catch(() => null)
      if (cw?.items) Object.assign(embeds.items, decodeClassWeights(cw.items))
    }
    // 開發組測試照算出的範例向量（scripts/build-protos.mjs）；沒有這個檔也能跑
    const shippedProtos = decodeProtos((await fetch(new URL('data/image_protos.json', base)).then((r) => (r.ok ? r.json() : { items: {} })).catch(() => ({ items: {} }))).items)
    let e: { embed: Embedder; threads: number }
    let device = 'wasm (worker)'
    try {
      e = await workerEmbedder(emitProgress)
    } catch (err) {
      console.warn('[clip] Worker 失敗，改在主執行緒', err)
      e = await mainThreadEmbedder(emitProgress)
      device = 'wasm'
    }
    return { embed: e.embed, embeds, shippedProtos, device, threads: e.threads }
  })()
  loading.catch(() => { loading = null })
  return loading
}

/** 從影片或圖片裁出中央正方形（瞄準框）畫到 224×224 canvas */
export function cropToCanvas(src: CanvasImageSource, w: number, h: number, frac = 1): HTMLCanvasElement {
  const side = Math.min(w, h) * frac
  const c = document.createElement('canvas')
  c.width = c.height = INPUT_SIZE
  c.getContext('2d')!.drawImage(src, (w - side) / 2, (h - side) / 2, side, side, 0, 0, INPUT_SIZE, INPUT_SIZE)
  return c
}

export async function fileToCanvas(file: Blob): Promise<HTMLCanvasElement> {
  const bmp = await createImageBitmap(file)
  const c = cropToCanvas(bmp, bmp.width, bmp.height, 1)
  bmp.close()
  return c
}

export async function embedImage(canvas: HTMLCanvasElement): Promise<Float32Array> {
  const clip = await loadClip()
  return clip.embed(canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height))
}

/** 辨識一張裁好的圖：回傳分數、判定、影像向量（給「認錯了」存範例用）與耗時。prior：偵測器類別的先驗（prior.ts） */
export async function recognize(
  canvas: HTMLCanvasElement, items: Item[], localProtos: Protos = {}, prior: ((id: string) => number) | null = null,
): Promise<Scored & { decision: Decision; ms: number; vec: number[] }> {
  const t0 = performance.now()
  const clip = await loadClip()
  const vec = norm(await embedImage(canvas))
  const s = score(vec, clip.embeds, items, TEMPERATURE, mergeProtos(clip.shippedProtos, localProtos), prior)
  return { ...s, decision: decide(s), ms: performance.now() - t0, vec }
}

export function mergeProtos(a: Protos, b: Protos): Protos {
  const out: Protos = { ...a }
  for (const [k, v] of Object.entries(b)) out[k] = [...(out[k] ?? []), ...v]
  return out
}

/**
 * 即時辨識的平滑器：每一幀的品項機率做指數移動平均，連續兩次第一名相同才算「穩定」，
 * 避免標籤在兩個品項之間跳來跳去。目標換了（框跳走）就 reset。
 */
export class Smoother {
  private p = new Map<string, number>()
  private items = new Map<string, Item>()
  private lastTop = ''
  private streak = 0
  negative = 0
  constructor(private alpha = 0.55) {}
  reset() { this.p.clear(); this.lastTop = ''; this.streak = 0; this.negative = 0 }
  push(s: Scored) {
    const seen = new Set<string>()
    for (const c of s.top) {
      this.items.set(c.item.id, c.item)
      this.p.set(c.item.id, (this.p.get(c.item.id) ?? 0) * (1 - this.alpha) + c.p * this.alpha)
      seen.add(c.item.id)
    }
    for (const [k, v] of this.p) if (!seen.has(k)) this.p.set(k, v * (1 - this.alpha))
    this.negative = this.negative * (1 - this.alpha) + (s.negative?.p ?? 0) * this.alpha
    const top = this.ranked()[0]
    if (top && top.item.id === this.lastTop) this.streak++
    else { this.streak = 1; this.lastTop = top?.item.id ?? '' }
  }
  ranked(): Candidate[] {
    return [...this.p.entries()].map(([id, p]) => ({ item: this.items.get(id)!, p })).sort((a, b) => b.p - a.p).slice(0, 5)
  }
  /** 給畫面用的目前結果 */
  current(): { top: Candidate | null; stable: boolean; decision: Decision } {
    const ranked = this.ranked()
    const scored: Scored = { top: ranked, byCategory: [], negative: this.negative ? { id: '_neg', p: this.negative } : null }
    return { top: ranked[0] ?? null, stable: this.streak >= 2, decision: decide(scored) }
  }
}
