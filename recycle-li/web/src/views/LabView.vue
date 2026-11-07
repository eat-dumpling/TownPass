<script setup lang="ts">
// 辨識測試室（給開發組，不給孩子）：#/lab
// 選多張「真實拍攝」的照片（不要用 emoji 或插圖），檔名開頭寫正確的品項 id（例如 pet_bottle_01.jpg）。
// 每張照片跑和即時掃描一樣的流程：物件偵測 → 每個框交給 CLIP（偵測器類別當先驗）→ 在照片上畫出 YOLO 風格的標註。
// 計分：主要物體（最大的框）第一名、前三名、分到對的桶；任一框命中；平均時間。可複製成 Markdown 貼進 README。
import { computed, onMounted, ref, shallowRef } from 'vue'
import TopBar from '@/components/TopBar.vue'
import AppIcon from '@/components/AppIcon.vue'
import { allItems, itemById, kindMeta } from '@/domain/catalog'
import { clipDevice, CONFIDENT_MASS, INPUT_SIZE, loadClip, MIN_TOP1, recognize, TEMPERATURE } from '@/vision/clip'
import { detect, loadDetector, squareCrop } from '@/vision/detector'
import { logPrior, PRIOR_MIN_SCORE } from '@/vision/prior'
import { salientBox } from '@/vision/saliency'
import { drawAnnotations, type Annotation } from '@/vision/annotate'

interface BoxResult { coco: string; top: { id: string; p: number }[]; area: number }
interface Row { name: string; img: string; expected?: string; boxes: BoxResult[]; ms: number }
const rows = shallowRef<Row[]>([])
const status = ref('載入模型…')
const device = ref('')
const running = ref(false)
let det: Awaited<ReturnType<typeof loadDetector>> | null = null

onMounted(async () => {
  try {
    await loadClip()
    device.value = (await clipDevice()) ?? ''
    det = await loadDetector('efficientdet_lite2').catch(() => null)
    status.value = ''
  } catch (e) {
    status.value = `模型載入失敗：${(e as Error).message}`
  }
})

const ids = allItems.map((i) => i.id).sort((a, b) => b.length - a.length)
const expectedFrom = (name: string) => ids.find((id) => name.toLowerCase().startsWith(id))
const crop = document.createElement('canvas')
crop.width = crop.height = INPUT_SIZE
let ts = 0

async function analyze(file: File) {
  const t0 = performance.now()
  const bmp = await createImageBitmap(file)
  const scale = Math.min(1, 900 / Math.max(bmp.width, bmp.height))
  const c = document.createElement('canvas')
  c.width = Math.round(bmp.width * scale)
  c.height = Math.round(bmp.height * scale)
  const g = c.getContext('2d')!
  g.drawImage(bmp, 0, 0, c.width, c.height)
  bmp.close()
  let dets = det ? detect(det, c, (ts += 100), c.width, c.height) : []
  if (!dets.length) { const sb = salientBox(c, c.width, c.height); if (sb) dets = [sb] }
  const regions = dets.length ? dets : [{ x: 0, y: 0, w: c.width, h: c.height, label: '', score: 0 }]
  const boxes: BoxResult[] = []
  const annos: Annotation[] = []
  for (const d of regions) {
    const r = squareCrop(d, c.width, c.height, dets.length ? 0.12 : 0)
    crop.getContext('2d')!.drawImage(c, r.sx, r.sy, r.side, r.side, 0, 0, INPUT_SIZE, INPUT_SIZE)
    const res = await recognize(crop, allItems, {}, d.score >= PRIOR_MIN_SCORE ? logPrior(d.label) : null)
    const top = res.top.slice(0, 3).map((t) => ({ id: t.item.id, p: t.p }))
    boxes.push({ coco: d.label, top, area: d.w * d.h })
    const it = res.top[0]?.item
    const nothing = (res.negative?.p ?? 0) > (res.top[0]?.p ?? 0)
    if (it) annos.push({
      x: d.x, y: d.y, w: d.w, h: d.h, color: nothing ? '#FFFFFF' : kindMeta[it.kind].color,
      title: nothing ? '不是垃圾' : it.name.zh, sub: nothing ? undefined : `${kindMeta[it.kind].label}${d.label ? ' · ' + d.label : ''}`,
      conf: nothing ? undefined : res.top[0].p, pending: false,
    })
  }
  drawAnnotations(g, annos, c.width)
  boxes.sort((a, b) => b.area - a.area)
  return { img: c.toDataURL('image/jpeg', 0.75), boxes, ms: performance.now() - t0 }
}

async function onFiles(e: Event) {
  const files = [...((e.target as HTMLInputElement).files ?? [])]
  running.value = true
  for (const f of files) {
    const r = await analyze(f)
    rows.value = [...rows.value, { name: f.name, expected: expectedFrom(f.name), ...r }]
  }
  running.value = false
}

const labeled = computed(() => rows.value.filter((r) => r.expected))
const pct = (n: number) => (labeled.value.length ? Math.round((n / labeled.value.length) * 100) : 0)
const kindOf = (id?: string) => (id ? itemById(id)?.kind : undefined)
const stats = computed(() => {
  const L = labeled.value
  const main = (r: Row) => r.boxes[0]
  const top1 = L.filter((r) => main(r)?.top[0]?.id === r.expected).length
  const top3 = L.filter((r) => main(r)?.top.some((t) => t.id === r.expected)).length
  const any = L.filter((r) => r.boxes.some((b) => b.top[0]?.id === r.expected)).length
  const kind = L.filter((r) => kindOf(main(r)?.top[0]?.id) === kindOf(r.expected)).length
  const ms = rows.value.length ? rows.value.reduce((s, r) => s + r.ms, 0) / rows.value.length : 0
  return { n: L.length, top1: pct(top1), top3: pct(top3), any: pct(any), kind: pct(kind), ms: Math.round(ms) }
})
const report = computed(() => {
  const s = stats.value
  const ua = navigator.userAgent.match(/\(([^)]+)\)/)?.[1] ?? ''
  const head = `| 張數 | 第一名 | 前三名 | 任一框命中 | 分到對的桶 | 平均每張 | 執行環境 |\n|---|---|---|---|---|---|---|\n| ${s.n} | ${s.top1}% | ${s.top3}% | ${s.any}% | ${s.kind}% | ${s.ms} ms | ${device.value}（${ua}） |`
  const params = `\n\n參數：TEMPERATURE=${TEMPERATURE}、CONFIDENT_MASS=${CONFIDENT_MASS}、MIN_TOP1=${MIN_TOP1}、偵測 EfficientDet-Lite2`
  const wrong = labeled.value
    .filter((r) => r.boxes[0]?.top[0]?.id !== r.expected)
    .map((r) => `- ${r.name}：猜 ${r.boxes[0]?.top.map((t) => `${t.id} ${Math.round(t.p * 100)}%`).join('、')}（偵測器：${r.boxes[0]?.coco || '沒有框'}）`)
    .join('\n')
  return head + params + (wrong ? `\n\n認錯的：\n${wrong}` : '')
})
const copy = () => navigator.clipboard?.writeText(report.value)
</script>

<template>
  <main class="page stack lab">
    <TopBar title="辨識測試室" back="/" :zy="false" />
    <p v-if="status" class="card" role="status">{{ status }}</p>
    <p class="muted">用真實拍攝的照片；檔名開頭寫品項 id（例如 <code>pet_bottle_01.jpg</code>）才會計分。照片只在這台裝置上處理。</p>
    <label class="btn primary block"><AppIcon name="Photo" /> 選測試照片<input class="sr-only" type="file" accept="image/*" multiple :disabled="!!status || running" @change="onFiles" /></label>
    <div v-if="rows.length" class="card">
      <p><b>{{ stats.n }}</b> 張計分・第一名 <b>{{ stats.top1 }}%</b>・前三名 <b>{{ stats.top3 }}%</b>・任一框 <b>{{ stats.any }}%</b>・對的桶 <b>{{ stats.kind }}%</b>・平均 <b>{{ stats.ms }} ms</b>（{{ device }}）</p>
      <div class="row"><button class="btn" @click="copy"><AppIcon name="Copy" /> 複製報告</button><button class="btn ghost" @click="rows = []">清除</button></div>
    </div>
    <div class="results">
      <figure v-for="r in rows" :key="r.name" :class="{ ok: r.expected && r.boxes[0]?.top[0]?.id === r.expected, bad: r.expected && r.boxes[0]?.top[0]?.id !== r.expected }">
        <img :src="r.img" :alt="r.name" />
        <figcaption>
          <b>{{ r.name }}</b>
          <span v-if="r.expected">正確：{{ itemById(r.expected)?.name.zh }}</span>
          <span>{{ r.boxes.length }} 個框・{{ Math.round(r.ms) }} ms</span>
        </figcaption>
      </figure>
    </div>
  </main>
</template>

<style scoped>
.lab { max-width: 960px; }
.results { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 12px; }
figure { margin: 0; background: var(--white); border-radius: 14px; overflow: hidden; box-shadow: var(--shadow); border: 3px solid transparent; }
figure.ok { border-color: #3E9B4F; }
figure.bad { border-color: var(--red-500); }
img { width: 100%; display: block; }
figcaption { padding: 8px 10px; display: flex; flex-direction: column; gap: 2px; font-size: var(--fs-caption); }
</style>
