<script setup lang="ts">
// 相機：即時框出畫面上的每個東西並標上名字（全部在手機上算，畫面不上傳、不存檔）。
// 共用辨識模組：MediaPipe 物件偵測 → 顯著物體框補位 → 追蹤 → CLIP（Web Worker）→ 每個框各自穩定的名字。
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import TopNav from '~/components/TopNav.vue'
import AppIcon from '~/components/AppIcon.vue'
import ItemArt from '~/components/ItemArt.vue'
import { kindMeta } from '@/domain/catalog'
import { INPUT_SIZE, loadClip, recognize } from '@/vision/clip'
import { detect, loadDetector, squareCrop } from '@/vision/detector'
import { observe, Tracker, type Track } from '@/vision/tracker'
import { logPrior, PRIOR_MIN_SCORE } from '@/vision/prior'
import { salientBox } from '@/vision/saliency'
import { coverTransform, drawAnnotations, type Annotation } from '@/vision/annotate'
import { itemName, items } from '~/lib/rules'
import type { LangId } from '~/i18n'

const { t, locale } = useI18n()
const lang = computed(() => locale.value as LangId)
const router = useRouter()
const video = ref<HTMLVideoElement>()
const overlay = ref<HTMLCanvasElement>()
const cam = ref<'starting' | 'on' | 'off'>('starting')
const ready = ref(false)
const tick = ref(0)
const list = items()
const tracker = new Tracker()
let detector: Awaited<ReturnType<typeof loadDetector>> | null = null
let running = true
let stream: MediaStream | null = null

const active = () => tracker.visible().filter((tr) => tr.misses <= 3)
const shown = (tr: Track) => !!tr.label && tr.nothing < tr.conf
const found = computed(() => { void tick.value; return active().filter(shown).sort((a, b) => b.w * b.h - a.w * a.h) })
const line = computed(() => {
  void tick.value
  if (!ready.value) return t('scan_loading')
  if (found.value.length) return t('scan_tap')
  return active().length ? t('scan_looking') : t('scan_none')
})

onMounted(async () => {
  loadClip().then(() => { ready.value = true; loop() }).catch((e) => console.warn(e))
  loadDetector('efficientdet_lite2').catch(() => loadDetector('efficientdet_lite0')).then((d) => (detector = d)).catch(() => {})
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false })
    if (video.value) { video.value.srcObject = stream; await video.value.play() }
    cam.value = 'on'
    requestAnimationFrame(frame)
  } catch { cam.value = 'off' }
})
onBeforeUnmount(() => { running = false; stream?.getTracks().forEach((x) => x.stop()) })

let last = 0
function frame(ts: number) {
  if (!running) return
  const v = video.value
  if (v && v.readyState >= 2 && v.videoWidth && ts - last > 80) {
    last = ts
    let dets = detector ? detect(detector, v, ts, v.videoWidth, v.videoHeight) : []
    if (!dets.length) { const sb = salientBox(v, v.videoWidth, v.videoHeight); if (sb) dets = [sb] }
    tracker.update(dets)
    draw(v)
  }
  requestAnimationFrame(frame)
}
let annos: (Annotation & { tr: Track })[] = []
function draw(v: HTMLVideoElement) {
  const c = overlay.value
  if (!c) return
  const W = c.clientWidth, H = c.clientHeight, dpr = window.devicePixelRatio || 1
  if (c.width !== Math.round(W * dpr)) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr) }
  const g = c.getContext('2d')!
  g.setTransform(dpr, 0, 0, dpr, 0, 0)
  g.clearRect(0, 0, W, H)
  const { s, ox, oy } = coverTransform(v.videoWidth, v.videoHeight, W, H)
  annos = active().filter((tr) => shown(tr) || tr.obs < 2).map((tr) => {
    const ok = shown(tr)
    const k = ok ? kindMeta[tr.label!.kind] : null
    return { tr, x: tr.x * s + ox, y: tr.y * s + oy, w: tr.w * s, h: tr.h * s, color: k?.color ?? '#fff',
      title: ok ? itemName(tr.label!, lang.value) : undefined, sub: ok ? t(`kinds.${tr.label!.kind}`) : undefined, conf: ok ? tr.conf : undefined, pending: !ok }
  })
  drawAnnotations(g, annos, W)
}
const crop = document.createElement('canvas')
crop.width = crop.height = INPUT_SIZE
async function loop() {
  while (running) {
    const v = video.value
    const tr = v && v.readyState >= 2 ? tracker.nextToClassify(v.videoWidth, v.videoHeight) : null
    if (v && tr) {
      const r = squareCrop(tr, v.videoWidth, v.videoHeight, 0.12)
      crop.getContext('2d')!.drawImage(v, r.sx, r.sy, r.side, r.side, 0, 0, INPUT_SIZE, INPUT_SIZE)
      const res = await recognize(crop, list, {}, logPrior(tr.cocoScore >= PRIOR_MIN_SCORE ? tr.coco : null))
      observe(tr, res.top, res.negative?.p ?? 0)
      tick.value++
    } else await new Promise((ok) => setTimeout(ok, 120))
  }
}
function onTap(e: PointerEvent) {
  const r = overlay.value!.getBoundingClientRect()
  const x = e.clientX - r.left, y = e.clientY - r.top
  const hit = annos.find((a) => x >= a.x && x <= a.x + a.w && y >= a.y - 48 && y <= a.y + a.h && shown(a.tr))
  if (hit) router.push(`/item/${hit.tr.label!.id}`)
}
</script>

<template>
  <main class="page stack">
    <TopNav :title="t('scan_title')" back="/identify" />
    <div class="cam">
      <video v-show="cam === 'on'" ref="video" playsinline muted aria-hidden="true"></video>
      <canvas v-show="cam === 'on'" ref="overlay" class="ov" aria-hidden="true" @pointerup="onTap"></canvas>
      <div v-if="cam === 'off'" class="nocam"><AppIcon name="CameraOff" :size="56" /><p>{{ t('scan_nocam') }}</p></div>
    </div>
    <p class="hint" aria-live="polite">{{ line }}</p>
    <ul class="found">
      <li v-for="tr in found" :key="tr.id">
        <router-link :to="`/item/${tr.label!.id}`" class="row" :style="{ borderLeftColor: kindMeta[tr.label!.kind].color }">
          <ItemArt :item="tr.label!" :size="44" />
          <span class="txt"><b>{{ itemName(tr.label!, lang) }}</b><small :style="{ color: kindMeta[tr.label!.kind].color }">{{ t(`kinds.${tr.label!.kind}`) }}</small></span>
          <AppIcon name="ChevronRight" />
        </router-link>
      </li>
    </ul>
    <router-link :to="cam === 'off' ? '/identify' : '/browse'" class="btn block"><AppIcon name="LayoutGrid" /> {{ t('id_browse') }}</router-link>
  </main>
</template>

<style scoped>
.cam { position: relative; border-radius: var(--radius); overflow: hidden; background: var(--gray-900); aspect-ratio: 3 / 4; }
video, .ov { position: absolute; inset: 0; width: 100%; height: 100%; }
video { object-fit: cover; }
.nocam { position: absolute; inset: 0; display: grid; place-content: center; justify-items: center; color: var(--gray-200); text-align: center; }
.hint { margin: 0; text-align: center; font-weight: 800; font-size: var(--fs-title); color: var(--primary-800); }
.found { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.row { display: flex; align-items: center; gap: 12px; background: var(--white); border-radius: 14px; border-left: 8px solid; padding: 8px 12px; box-shadow: var(--shadow); text-decoration: none; color: var(--gray-900); min-height: 60px; }
.txt { flex: 1; display: flex; flex-direction: column; }
.txt small { font-weight: 700; }
</style>
