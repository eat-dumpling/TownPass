<script setup lang="ts">
// 即時多物件掃描（YOLO 風格）：畫面上每個東西各有一個框和名字，例如「寶特瓶 86%・塑膠類」。全部在手機上算，畫面不上傳、不存檔。
//   每一幀：MediaPipe 物件偵測（EfficientDet-Lite0，CPU）→ 追蹤器（同一個東西跨幀同一個 id、框平滑）
//   背景（Web Worker）：輪流把每個追蹤框的區域交給 CLIP，偵測器類別當先驗 → 每個框各自累積機率、有遲滯的標籤
//   偵測器框不到任何東西時，找畫面中央「跟背景不一樣」的那一塊並框住它（saliency.ts）——框永遠貼著物品，沒有固定框
//   點框或下方的卡片 → 指引頁；「不對」→ 選正確的，存一個範例向量（只存數字）讓下次更準
import Zy from '@/components/Zy.vue'
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import { useRouter } from 'vue-router'
import TopBar from '@/components/TopBar.vue'
import Mascot from '@/components/Mascot.vue'
import AppIcon from '@/components/AppIcon.vue'
import ItemArt from '@/components/ItemArt.vue'
import { binMetaFor, kindMeta, visibleItems } from '@/domain/catalog'
import { useGame } from '@/stores/game'
import type { Item } from '@/domain/types'
import { clipDevice, fileToCanvas, INPUT_SIZE, loadClip, recognize, type Decision, type Protos } from '@/vision/clip'
import { detect, DetTimer, loadDetector, squareCrop, type DetModel } from '@/vision/detector'
import { answerLevel, observe, rankedOf, Tracker, TRACKER, type Track } from '@/vision/tracker'
import { centerBox, chooseBoxes, drawMode, primaryOf } from '@/vision/pipeline'
import { salientBox } from '@/vision/saliency'
import { logPrior, PRIOR_MIN_SCORE } from '@/vision/prior'
import { coverTransform, drawAnnotations, type Annotation } from '@/vision/annotate'
import { addLocalProto, loadLocalProtos } from '@/vision/protos'

const router = useRouter()
const game = useGame()
const video = ref<HTMLVideoElement>()
const overlay = ref<HTMLCanvasElement>()
const fileIn = ref<HTMLInputElement>()
const cam = ref<'starting' | 'on' | 'off'>('starting')
const model = ref<'loading' | 'ready' | 'error'>('loading')
const detModel = ref<DetModel | null>(null)
const device = ref('')
const pct = ref(0)
const items = visibleItems()

const tracker = new Tracker()
const vecs = new Map<number, number[]>() // 追蹤 id → 最近一次的影像向量（給「不對」存範例用）
const tick = ref(0) // 辨識結果更新時 +1，讓下方卡片重新計算
const fixing = shallowRef<Track | null>(null)
let running = true
let stream: MediaStream | null = null
let detector: Awaited<ReturnType<typeof loadDetector>> | null = null
const timer = new DetTimer()
let localProtos: Protos = {}

/** 目前畫面上的目標（偵測框或顯著物體框，都貼著物品） */
const activeTracks = (): Track[] => tracker.visible().filter((t) => t.misses <= 3)
// 回答分三層（門檻由真實照片調出來，見 params.json）：品項名稱／只說桶子／不回答
const shown = (t: Track) => answerLevel(t) === 'item' || answerLevel(t) === 'maybe'
const kindOnly = (t: Track) => answerLevel(t) === 'kind'
const sure = (t: Track) => answerLevel(t) === 'item'
/** 畫面上說的品項：有把握的標籤，或「可能是」的猜測 */
const itemOf = (t: Track) => (sure(t) ? t.label! : t.guess!)
const confOf = (t: Track) => (sure(t) ? t.conf : t.guessConf)
const labeled = computed(() => {
  void tick.value
  return activeTracks().filter(shown).sort((a, b) => b.w * b.h - a.w * a.h)
})
const line = computed(() => {
  void tick.value
  if (model.value === 'loading') return '準備眼睛…'
  const n = labeled.value.length
  if (n === 1) return sure(labeled.value[0]) ? `這是${itemOf(labeled.value[0]).name.zh}！` : `可能是${itemOf(labeled.value[0]).name.zh}，對嗎？`
  if (n > 1) return `看到 ${n} 個東西，點一個看看`
  const k = activeTracks().find(kindOnly)
  if (k) return `應該是${kindMeta[k.kind!].label}，靠近一點讓我看清楚`
  const boxed = activeTracks().filter((t) => !t.center) // 畫面中央框沒認出東西時，當作還沒對準東西
  if (boxed.some((t) => t.obs >= TRACKER.MIN_OBS)) return '看不清楚，換個角度試試'
  return boxed.length ? '讓我看看…' : '把要丟的東西放進框框裡'
})

onMounted(async () => {
  localProtos = await loadLocalProtos()
  loadClip((p) => (pct.value = Math.round(p)))
    .then(async () => { model.value = 'ready'; device.value = (await clipDevice()) ?? ''; clipLoop() })
    .catch((e) => { console.warn(e); model.value = 'error' })
  // 即時用 Lite0（CPU 跑得動）；Lite2 較準但一幀約 150 ms，只在辨識測試室用
  loadDetector('efficientdet_lite0')
    .then((d) => { detector = d; detModel.value = 'efficientdet_lite0' })
    .catch((e) => console.warn('[detector]', e))
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false })
    if (video.value) { video.value.srcObject = stream; await video.value.play() }
    cam.value = 'on'
    requestAnimationFrame(frame)
  } catch {
    cam.value = 'off' // 台北通 WebView 沒有允許相機時走這裡 → 用相簿
  }
})
// 釋放相機與迴圈（入門指引：切換頁面時釋放 WebView 資源）
onBeforeUnmount(() => { running = false; stream?.getTracks().forEach((t) => t.stop()) })

// ── 每一幀：偵測 → 追蹤 → 畫框 ───────────────────────────────
let lastDetect = 0
function frame(ts: number) {
  if (!running) return
  const v = video.value
  if (v && v.readyState >= 2 && !document.hidden && v.videoWidth) {
    const vw = v.videoWidth, vh = v.videoHeight
    const interval = Math.max(66, timer.avg * 1.3) // 偵測太慢就自動降低頻率
    if (detector && ts - lastDetect > interval) {
      lastDetect = ts
      try {
        const t0 = performance.now()
        // 只框偵測分數夠高的（掛繩、手、衣服的誤框分數多半很低），最多 3 個；
        // 偵測器框不到 → 找畫面中央跟背景不一樣的那一塊；再框不到 → 畫面中央一大塊（東西拿很近、佔滿畫面時）
        const raw = detect(detector, v, ts, vw, vh)
        timer.push(performance.now() - t0)
        tracker.update(chooseBoxes(raw, () => salientBox(v, vw, vh), vw, vh))
        if (timer.slow && detModel.value === 'efficientdet_lite2') downgrade()
      } catch (e) { console.warn('[detector]', e); detector = null }
    } else if (!detector && ts - lastDetect > 120) {
      // 偵測器還沒載好或不能用：只用顯著物體框
      lastDetect = ts
      const sb = salientBox(v, vw, vh)
      tracker.update([sb ?? centerBox(vw, vh)])
    }
    draw(v)
  }
  requestAnimationFrame(frame)
}
function downgrade() {
  detModel.value = 'efficientdet_lite0'
  loadDetector('efficientdet_lite0').then((d) => { detector = d; timer.n = 0 }).catch(() => {})
}

let annos: (Annotation & { track: Track })[] = []
function draw(v: HTMLVideoElement) {
  const c = overlay.value
  if (!c) return
  const W = c.clientWidth, H = c.clientHeight
  const dpr = window.devicePixelRatio || 1
  if (c.width !== Math.round(W * dpr)) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr) }
  const g = c.getContext('2d')!
  g.setTransform(dpr, 0, 0, dpr, 0, 0)
  g.clearRect(0, 0, W, H)
  const { s, ox, oy } = coverTransform(v.videoWidth, v.videoHeight, W, H)
  // 每個追蹤到的物品都要有框（還沒確定名字時是白色虛線「辨識中」）；
  // 只有顯著物體框（偵測器沒給類別）而且很像背景時才不畫
  // 規則在 pipeline.ts（和驗證工具共用）：沒把握時只畫主要那一個框、不寫字；其他沒把握的框不畫
  const tracks = activeTracks()
  const primary = (lastPrimary = primaryOf(tracks, v.videoWidth, v.videoHeight, lastPrimary))
  annos = tracks
    .map((t) => ({ t, mode: drawMode(t, t === primary) }))
    .filter(({ mode }) => mode !== 'hide')
    .map(({ t, mode: level }) => {
      const base = { track: t, x: t.x * s + ox, y: t.y * s + oy, w: t.w * s, h: t.h * s, selected: fixing.value === t }
      if (level === 'item') {
        const k = binMetaFor(t.label!, game.age)
        return { ...base, color: k.color, title: t.label!.name.zh, sub: k.label, conf: t.conf, pending: false }
      }
      if (level === 'maybe') {
        const k = binMetaFor(t.guess!, game.age)
        return { ...base, color: k.color, title: `可能是${t.guess!.name.zh}？`, sub: k.label, conf: t.guessConf, pending: false }
      }
      if (level === 'kind') {
        // 不確定是哪個品項，但很確定是哪個桶：只說桶子
        const k = kindMeta[t.kind!]
        return { ...base, color: k.color, title: k.label, sub: '換個角度看看是哪一個', conf: t.kindConf, pending: false }
      }
      // 沒把握：只有主要的框，白色虛線，不寫字（下方小里長會說要怎麼做）
      return { ...base, color: '#FFFFFF', title: '', pending: true }
    })
  drawAnnotations(g, annos, W)
}

// ── 背景：輪流辨識每個框（CLIP 在 Web Worker 裡） ─────────────────
const crop = document.createElement('canvas')
crop.width = crop.height = INPUT_SIZE
let lastPrimary: Track | null = null // 主要的框有遲滯（pipeline.ts 的 primaryOf）
async function clipLoop() {
  while (running) {
    const v = video.value
    const t = v && v.readyState >= 2 && !document.hidden && !fixing.value
      ? tracker.nextToClassify(v.videoWidth, v.videoHeight)
      : null
    if (v && t) {
      const r = squareCrop(t, v.videoWidth, v.videoHeight, 0.12)
      crop.getContext('2d')!.drawImage(v, r.sx, r.sy, r.side, r.side, 0, 0, INPUT_SIZE, INPUT_SIZE)
      try {
        const res = await recognize(crop, items, localProtos, logPrior(t.cocoScore >= PRIOR_MIN_SCORE ? t.coco : null))
        observe(t, res.top, res.negative?.p ?? 0, res.vec)
        vecs.set(t.id, res.vec)
        tick.value++
      } catch (e) {
        console.warn(e)
        model.value = 'error'
        return
      }
    } else {
      await new Promise((ok) => setTimeout(ok, 120))
    }
  }
}

// ── 點框、點卡片、修正 ─────────────────────────────────────
function onTap(e: PointerEvent) {
  const c = overlay.value
  if (!c) return
  const rect = c.getBoundingClientRect()
  const x = e.clientX - rect.left, y = e.clientY - rect.top
  const hit = annos
    .filter((a) => x >= a.x && x <= a.x + a.w && y >= a.y - 48 && y <= a.y + a.h)
    .sort((a, b) => a.w * a.h - b.w * b.h)[0]
  if (hit && shown(hit.track)) open(itemOf(hit.track))
}
const open = (it: Item) => router.replace(`/catch/${it.id}`)
async function fix(t: Track, it: Item) {
  const v = vecs.get(t.id)
  if (v) await addLocalProto(it.id, v) // 只存向量，不存照片
  fixing.value = null
  open(it)
}
function go(d: Decision) {
  if (d.kind === 'reveal') router.replace(`/catch/${d.item.id}`)
  else if (d.kind === 'clue') router.replace({ path: '/pick', query: { c: d.cands.map((x) => `${x.item.id}:${x.p.toFixed(3)}`).join(',') } })
  else router.replace('/pick')
}
async function fromFile(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  ;(e.target as HTMLInputElement).value = ''
  if (!f) return
  go((await recognize(await fileToCanvas(f), items, localProtos)).decision)
}
const pctOf = (t: Track) => Math.round(confOf(t) * 100)
</script>

<template>
  <main class="page stack">
    <TopBar title="對準它" back="/" />
    <div class="cam">
      <video v-show="cam === 'on'" ref="video" playsinline muted aria-hidden="true"></video>
      <canvas v-show="cam === 'on'" ref="overlay" class="overlay" aria-hidden="true" @pointerup="onTap"></canvas>
      <div v-if="cam === 'off'" class="nocam"><AppIcon name="CameraOff" :size="56" /><p><Zy text="相機打不開" /></p></div>
      <p v-if="model === 'loading'" class="over"><Zy :text="`準備眼睛… ${pct ? pct + '%' : ''}`" /></p>
      <span v-if="cam === 'on'" class="det">{{ detModel === 'efficientdet_lite2' ? 'Lite2' : detModel ? 'Lite0' : '顯著物體' }}{{ device ? ' · ' + device : '' }}</span>
    </div>

    <p class="sr-only" aria-live="polite">{{ line }}</p>
    <Mascot :mood="labeled.length ? 'cheer' : 'think'" :size="48" :line="line" />

    <!-- 看到的東西（像 YOLO 的圖例），點了看怎麼丟 -->
    <ul v-if="labeled.length && !fixing" class="found" aria-label="看到的東西">
      <li v-for="t in labeled" :key="t.id" :style="{ '--k': binMetaFor(itemOf(t), game.age).color }">
        <button class="main" @click="open(itemOf(t))">
          <ItemArt :item="itemOf(t)" :size="44" />
          <span class="txt"><b><Zy :text="`${sure(t) ? '' : '可能是'}${itemOf(t).name.zh}${sure(t) ? '' : '？'}`" /></b><small><Zy :text="binMetaFor(itemOf(t), game.age).label" /></small></span>
          <AppIcon name="ChevronRight" />
        </button>
        <button class="no" :aria-label="`${itemOf(t).name.zh} 認錯了`" @click="fixing = t"><Zy text="不對" /></button>
      </li>
    </ul>

    <section v-if="fixing" class="card stack">
      <strong><Zy text="它是哪一個？" /></strong>
      <div class="grid3">
        <button v-for="c in rankedOf(fixing)" :key="c.item.id" class="tile" @click="fix(fixing!, c.item)">
          <ItemArt :item="c.item" :size="48" /><Zy :text="c.item.name.zh" />
        </button>
      </div>
      <div class="grid2">
        <router-link to="/pick" replace class="btn"><AppIcon name="HandClick" /> <Zy text="都不是，用選的" /></router-link>
        <button class="btn ghost" @click="fixing = null"><Zy text="繼續掃" /></button>
      </div>
    </section>

    <input ref="fileIn" class="sr-only" type="file" accept="image/*" capture="environment" @change="fromFile" />
    <div class="grid2">
      <button class="btn" :class="{ primary: cam === 'off' }" :disabled="model !== 'ready'" @click="fileIn?.click()">
        <AppIcon name="Photo" /> <Zy :text="cam === 'off' ? '拍照或選照片' : '從相簿選'" />
      </button>
      <router-link to="/pick" replace class="btn ghost"><AppIcon name="HandClick" /> <Zy text="用選的" /></router-link>
    </div>
  </main>
</template>

<style scoped>
.cam { position: relative; border-radius: var(--radius); overflow: hidden; background: var(--gray-900); aspect-ratio: 3 / 4; }
video, .overlay { position: absolute; inset: 0; width: 100%; height: 100%; }
video { object-fit: cover; }
.overlay { touch-action: manipulation; }
.nocam { position: absolute; inset: 0; display: grid; place-content: center; justify-items: center; text-align: center; color: var(--gray-200); }
.nocam p { font-size: var(--fs-title); margin: 8px 0 0; }
.over { position: absolute; inset: auto 0 16px; text-align: center; color: var(--white); font-weight: 700; margin: 0; }
.det { position: absolute; top: 8px; right: 8px; color: #fff; background: rgba(0,0,0,.45); border-radius: 999px; padding: 2px 8px; font-size: 11px; }
.found { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 8px; }
.found li { display: flex; gap: 6px; }
.found .main { flex: 1; display: flex; align-items: center; gap: 10px; border: 0; border-left: 8px solid var(--k); background: var(--white); border-radius: 14px; padding: 8px 10px; box-shadow: var(--shadow); min-height: var(--tap); text-align: left; }
.found .txt { flex: 1; display: flex; flex-direction: column; }
.found small { color: var(--k); font-weight: 700; }
.found .no { border: 0; background: var(--white); border-radius: 14px; padding: 0 12px; box-shadow: var(--shadow); font-weight: 700; color: var(--gray-600); min-width: var(--tap); }
</style>
