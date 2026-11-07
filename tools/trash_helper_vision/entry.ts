// SPDX-License-Identifier: AGPL-3.0-or-later
// Trash Helper ← 回收小里長 recognition (recycle-li/web/src/vision on the develop branch).
//
// Same live pipeline as recycle-li's ScanView, without its Vue / game layer:
//   camera frame → MediaPipe EfficientDet-Lite0 boxes (or a salient / centre box) → tracker
//   → each box cropped to 224×224 → SigLIP image model in a Web Worker → 107 item scores
//   (+ detector-class prior, example vectors, learned class vectors) → per-box smoothed label.
// Everything runs on the phone; the camera picture is never uploaded or saved.
//
// Built by tools/trash_helper_vision/build.sh into microservices/trash_helper/vendor/recycle-vision/.
import { allItems, kindMeta } from '@/domain/catalog'
import type { Item } from '@/domain/types'
import { fileToCanvas, INPUT_SIZE, loadClip, recognize } from '@/vision/clip'
import { detect, DetTimer, loadDetector, squareCrop } from '@/vision/detector'
import { answerLevel, observe, Tracker, type Track } from '@/vision/tracker'
import { centerBox, chooseBoxes, drawMode, primaryOf } from '@/vision/pipeline'
import { salientBox } from '@/vision/saliency'
import { logPrior, PRIOR_MIN_SCORE } from '@/vision/prior'
import { coverTransform, drawAnnotations, type Annotation } from '@/vision/annotate'

type Lang = 'zh' | 'en'
export interface Found {
  id: string // recycle-li item id
  name: string
  kind: string
  kindLabel: string
  color: string
  conf: number
  sure: boolean // false = 「可能是…？」
}
export interface ScannerOptions {
  video: HTMLVideoElement
  canvas: HTMLCanvasElement
  lang: Lang
  onStatus?: (s: { camera: 'starting' | 'on' | 'off'; model: 'loading' | 'ready' | 'error'; pct: number; hint: string }) => void
  onFound?: (found: Found[]) => void
  onTap?: (f: Found) => void
}

const items: Item[] = allItems // map onto Trash Helper's own rule table, so every item may be recognised
const kindLabel = (kind: string, lang: Lang) => {
  const k = kindMeta[kind as keyof typeof kindMeta]
  return k ? (lang === 'en' ? k.en : k.label) : kind
}
const T = {
  zh: { loading: '準備辨識…', aim: '把要丟的東西放進畫面', looking: '讓我看看…', closer: '看不清楚，換個角度試試', many: '看到 {n} 個東西，點一個看看',
    one: '這是{name}', maybe: '可能是{name}？', kindOnly: '應該是{kind}，靠近一點', retry: '換個角度看看' },
  en: { loading: 'Getting ready…', aim: 'Point the camera at one item', looking: 'Looking…', closer: "Can't tell — try another angle", many: '{n} items — tap one',
    one: 'This is {name}', maybe: 'Maybe {name}?', kindOnly: 'Looks like {kind} — move closer', retry: 'Try another angle' },
}
const fmt = (s: string, v: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k) => String(v[k] ?? ''))

/** Start loading the models in the background (call when the app opens the scan page or earlier). */
export function preload() {
  loadDetector('efficientdet_lite0').catch(() => {})
  return loadClip()
}

/** Live scanner on a <video> + overlay <canvas>. Returns stop(). */
export async function startScanner(o: ScannerOptions): Promise<{ stop: () => void }> {
  const lang = o.lang
  const tr = T[lang]
  const tracker = new Tracker()
  const timer = new DetTimer()
  let running = true
  let stream: MediaStream | null = null
  let detector: Awaited<ReturnType<typeof loadDetector>> | null = null
  let camera: 'starting' | 'on' | 'off' = 'starting'
  let model: 'loading' | 'ready' | 'error' = 'loading'
  let pct = 0
  let lastPrimary: Track | null = null
  let annos: (Annotation & { found?: Found })[] = []

  const active = () => tracker.visible().filter((t) => t.misses <= 3)
  const toFound = (t: Track): Found | null => {
    const level = answerLevel(t)
    if (level !== 'item' && level !== 'maybe') return null
    const it = level === 'item' ? t.label! : t.guess!
    const k = kindMeta[it.kind]
    return { id: it.id, name: it.name[lang] ?? it.name.zh, kind: it.kind, kindLabel: kindLabel(it.kind, lang), color: k?.color ?? '#5AB4C5',
      conf: level === 'item' ? t.conf : t.guessConf, sure: level === 'item' }
  }
  const found = () => active().map(toFound).filter((f): f is Found => !!f)
  const hint = () => {
    if (model === 'loading') return tr.loading + (pct ? ` ${pct}%` : '')
    const f = found()
    if (f.length === 1) return fmt(f[0].sure ? tr.one : tr.maybe, { name: f[0].name })
    if (f.length > 1) return fmt(tr.many, { n: f.length })
    const k = active().find((t) => answerLevel(t) === 'kind')
    if (k?.kind) return fmt(tr.kindOnly, { kind: kindLabel(k.kind, lang) })
    const boxed = active().filter((t) => !t.center)
    if (boxed.some((t) => t.obs >= 2)) return tr.closer
    return boxed.length ? tr.looking : tr.aim
  }
  const status = () => o.onStatus?.({ camera, model, pct, hint: hint() })
  let lastFoundKey = ''
  const report = () => {
    const f = found()
    const key = f.map((x) => `${x.id}:${x.sure}`).join(',')
    if (key !== lastFoundKey) { lastFoundKey = key; o.onFound?.(f) }
    status()
  }

  loadClip((p) => { pct = Math.round(p); status() })
    .then(() => { model = 'ready'; status(); clipLoop() })
    .catch((e) => { console.warn('[recycle-vision] model', e); model = 'error'; status() })
  loadDetector('efficientdet_lite0').then((d) => { detector = d }).catch((e) => console.warn('[recycle-vision] detector', e))

  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false })
    o.video.srcObject = stream
    o.video.setAttribute('playsinline', '')
    o.video.muted = true
    await o.video.play()
    camera = 'on'
    requestAnimationFrame(frame)
  } catch (e) {
    console.warn('[recycle-vision] camera', e)
    camera = 'off'
  }
  status()

  let lastDetect = 0
  function frame(ts: number) {
    if (!running) return
    const v = o.video
    if (v.readyState >= 2 && !document.hidden && v.videoWidth) {
      const vw = v.videoWidth, vh = v.videoHeight
      const interval = Math.max(66, timer.avg * 1.3)
      if (detector && ts - lastDetect > interval) {
        lastDetect = ts
        try {
          const t0 = performance.now()
          const raw = detect(detector, v, ts, vw, vh)
          timer.push(performance.now() - t0)
          tracker.update(chooseBoxes(raw, () => salientBox(v, vw, vh), vw, vh))
        } catch (e) { console.warn('[recycle-vision] detect', e); detector = null }
      } else if (!detector && ts - lastDetect > 120) {
        lastDetect = ts
        tracker.update([salientBox(v, vw, vh) ?? centerBox(vw, vh)])
      }
      draw(v)
    }
    requestAnimationFrame(frame)
  }

  function draw(v: HTMLVideoElement) {
    const c = o.canvas
    const W = c.clientWidth, H = c.clientHeight, dpr = window.devicePixelRatio || 1
    if (c.width !== Math.round(W * dpr)) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr) }
    const g = c.getContext('2d')!
    g.setTransform(dpr, 0, 0, dpr, 0, 0)
    g.clearRect(0, 0, W, H)
    const { s, ox, oy } = coverTransform(v.videoWidth, v.videoHeight, W, H)
    const tracks = active()
    const primary = (lastPrimary = primaryOf(tracks, v.videoWidth, v.videoHeight, lastPrimary))
    annos = tracks.map((t) => ({ t, mode: drawMode(t, t === primary) })).filter(({ mode }) => mode !== 'hide').map(({ t, mode }) => {
      const base = { x: t.x * s + ox, y: t.y * s + oy, w: t.w * s, h: t.h * s }
      const f = toFound(t)
      if (f && mode === 'item') return { ...base, color: f.color, title: f.name, sub: f.kindLabel, conf: f.conf, found: f }
      if (f && mode === 'maybe') return { ...base, color: f.color, title: fmt(tr.maybe, { name: f.name }), sub: f.kindLabel, conf: f.conf, found: f }
      if (mode === 'kind' && t.kind) {
        const k = kindMeta[t.kind]
        return { ...base, color: k?.color ?? '#fff', title: kindLabel(t.kind, lang), sub: tr.retry, conf: t.kindConf }
      }
      return { ...base, color: '#FFFFFF', title: '', pending: true }
    })
    drawAnnotations(g, annos, W)
  }

  const crop = document.createElement('canvas')
  crop.width = crop.height = INPUT_SIZE
  async function clipLoop() {
    while (running) {
      const v = o.video
      const t = v.readyState >= 2 && !document.hidden ? tracker.nextToClassify(v.videoWidth, v.videoHeight) : null
      if (t) {
        const r = squareCrop(t, v.videoWidth, v.videoHeight, 0.12)
        crop.getContext('2d')!.drawImage(v, r.sx, r.sy, r.side, r.side, 0, 0, INPUT_SIZE, INPUT_SIZE)
        try {
          const res = await recognize(crop, items, {}, logPrior(t.cocoScore >= PRIOR_MIN_SCORE ? t.coco : null))
          observe(t, res.top, res.negative?.p ?? 0, res.vec)
          report()
        } catch (e) { console.warn('[recycle-vision] recognize', e); model = 'error'; status(); return }
      } else await new Promise((ok) => setTimeout(ok, 120))
    }
  }

  const onPointer = (e: PointerEvent) => {
    const r = o.canvas.getBoundingClientRect()
    const x = e.clientX - r.left, y = e.clientY - r.top
    const hit = annos.find((a) => a.found && x >= a.x && x <= a.x + a.w && y >= a.y - 48 && y <= a.y + a.h)
    if (hit?.found) o.onTap?.(hit.found)
  }
  o.canvas.addEventListener('pointerup', onPointer)

  return {
    stop() {
      running = false
      o.canvas.removeEventListener('pointerup', onPointer)
      stream?.getTracks().forEach((t) => t.stop())
      o.video.srcObject = null
    },
  }
}

/** One photo from the album (no live camera): the five best items. */
export async function recognizeFile(file: Blob, lang: Lang): Promise<{ id: string; name: string; kindLabel: string; p: number }[]> {
  const c = await fileToCanvas(file)
  const res = await recognize(c, items)
  if (res.negative && (!res.top[0] || res.negative.p > res.top[0].p)) return []
  return res.top.map((x) => ({ id: x.item.id, name: x.item.name[lang] ?? x.item.name.zh, kindLabel: kindLabel(x.item.kind, lang), p: x.p }))
}
