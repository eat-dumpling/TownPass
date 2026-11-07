<script setup lang="ts">
// 我的里（2.5D 插圖、可以隨處蓋）：一大片浮在空中的小島，草地是一整片（平常看不到格子），
// 只有在「放置模式」才會出現可以蓋的位置框線。水、路、石頭不能蓋。
// 建築用插圖（src/assets/li/*.webp，開發時用影像生成做的，見 README）；沒有插圖的用向量模型。
// 動畫：雲飄過去、樹在搖、風車在轉、水面閃、燈塔在亮、新蓋的建築掉下來＋揚起灰塵和星星。
// 裝置設定「減少動態」時全部關掉。全部依前後順序畫（x+y 小的先畫）。
import { computed } from 'vue'
import { buildings, lis } from '@/domain/catalog'
import type { LiArea } from '@/domain/types'
import { box, flat, place, proj, seg, shade, shadow, TH, TW, TZ, type Part } from './iso/iso'
import { DECOR, MODELS } from './iso/models'
import { spriteOf, SPRITE_SCALE } from './iso/sprites'
import IsoParts from './iso/IsoParts.vue'

const props = withDefaults(defineProps<{
  slots: (string | null)[]; li?: LiArea; pop?: number | null; label?: string; mini?: boolean
  /** 放置模式：可以蓋的位置會出現框線，點了送出 cell 事件 */
  placing?: boolean
  /** 被選起來（準備搬家）的那一格 */
  selected?: number | null
}>(), { pop: null, label: '我的里', mini: false, placing: false, selected: null })
const emit = defineEmits<{ cell: [index: number] }>()

const area = computed(() => props.li ?? lis[0])
const M = 0.62
const cols = computed(() => area.value.cols)
const rows = computed(() => area.value.rows)
const X = computed(() => 2 * M + cols.value)
const Y = computed(() => 2 * M + rows.value)
const cellXY = (i: number): [number, number] => [M + (i % cols.value), M + Math.floor(i / cols.value)]
const terrainOf = (i: number) => {
  const t = area.value.terrain
  return t.water?.includes(i) ? 'water' : t.rock?.includes(i) ? 'rock' : t.road?.includes(i) ? 'road' : null
}
const rnd = (seed: string, k: number) => {
  let h = 2166136261
  for (const c of seed + k) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
  return ((h >>> 0) % 1000) / 1000
}
const ballAt = (p: [number, number, number]) => { const [cx, cy] = proj(p); return { cx, cy } }
const diamond = (gx: number, gy: number, inset = 0) => [[gx + inset, gy + inset], [gx + 1 - inset, gy + inset], [gx + 1 - inset, gy + 1 - inset], [gx + inset, gy + 1 - inset]]
  .map(([x, y]) => proj([x, y, 0]).map((v) => v.toFixed(1)).join(',')).join(' ')

// ── 地面：土、一整片草地（不分格） ──
const ground = computed<Part[]>(() => {
  const g = area.value.ground, id = area.value.id, x = X.value, y = Y.value
  const [lx] = proj([0, y, -0.6]), [rx] = proj([x, 0, -0.6]), [, by] = proj([x, y, -0.6])
  const cx = (lx + rx) / 2, rr = (rx - lx) * 0.42
  const parts: Part[] = [
    { kind: 'path', d: `M ${cx - rr} ${by + 16} A ${rr} 13 0 1 0 ${cx + rr} ${by + 16} A ${rr} 13 0 1 0 ${cx - rr} ${by + 16} Z`, fill: '#0E2A1A', opacity: 0.15, blur: true },
    ...box(0, 0, -0.62, x, y, 0.5, '#A8754A', '#A8754A'),
    ...box(0, 0, -0.12, x, y, 0.12, shade(g, -0.12), g),
    // 草地的光影：左上亮、右下暗，一整片
    flat(0, 0, 0.001, x, y, g, 1, { type: 'r', cx: 0.3, cy: 0.25, r: 0.9, stops: [shade(g, 0.16), g, shade(g, -0.06)] }),
  ]
  for (let k = 0; k < 14; k++) {
    const t = rnd(id, k)
    parts.push(k % 2 ? { kind: 'ball', ...ballAt([t * x, y, -0.3 - rnd(id, k + 20) * 0.24]), r: 1.6 + t * 1.6, fill: '#8A5D38' } : { kind: 'ball', ...ballAt([x, t * y, -0.3 - rnd(id, k + 30) * 0.26]), r: 1.4 + t * 1.4, fill: '#6F4A2C' })
  }
  return parts
})

// ── 地形與草地上的小花草 ──
const terrain = computed<Part[]>(() => {
  const parts: Part[] = []
  const id = area.value.id
  props.slots.forEach((b, i) => {
    const [gx, gy] = cellXY(i)
    const t = terrainOf(i)
    if (t === 'water') parts.push(flat(gx - 0.02, gy - 0.02, 0.003, 1.04, 1.04, '#4FA9C4', undefined, { type: 'l', x1: 0, y1: 0, x2: 1, y2: 1, stops: ['#8ED6E8', '#3E97B6'] }))
    else if (t === 'road') parts.push(flat(gx - 0.01, gy - 0.01, 0.003, 1.02, 1.02, '#6E7A82'), seg([[gx + 0.3, gy + 0.5, 0.006], [gx + 0.7, gy + 0.5, 0.006]], '#FFFFFF', 1.4))
    else if (!b && !props.mini && rnd(id, i + 99) > 0.74) {
      // 小花、小草叢（不擋路，可以直接蓋在上面）
      const fx = gx + 0.2 + rnd(id, i) * 0.6, fy = gy + 0.2 + rnd(id, i + 7) * 0.6
      if (rnd(id, i + 5) > 0.5) parts.push({ kind: 'ball', ...ballAt([fx, fy, 0.02]), r: 1.8, fill: rnd(id, i + 3) > 0.5 ? '#F5BA4B' : '#F08AB0' }, { kind: 'ball', ...ballAt([fx + 0.08, fy - 0.05, 0.02]), r: 1.5, fill: '#FFF6C9' })
      else parts.push(seg([[fx, fy, 0], [fx - 0.03, fy, 0.09]], shade(area.value.ground, -0.3), 1.1), seg([[fx, fy, 0], [fx + 0.04, fy, 0.1]], shade(area.value.ground, -0.3), 1.1))
    }
  })
  return parts
})
const ripples = computed(() =>
  props.slots.map((_, i) => i).filter((i) => terrainOf(i) === 'water').map((i) => {
    const [gx, gy] = cellXY(i)
    return { i, a: [proj([gx + 0.2, gy + 0.35, 0.01]), proj([gx + 0.5, gy + 0.68, 0.01])] }
  }),
)

// ── 建築與裝飾（依前後順序） ──
interface Obj { key: number; slot?: number; id: string; parts: Part[]; sprite?: { href: string; x: number; y: number; w: number; h: number }; sway?: boolean }
const SWAY = new Set(['tree', 'treehouse', 'garden', 'pine', 'bush', 'tree_s', 'tree_y'])
function makeObj(id: string, gx: number, gy: number, key: number, slot?: number, scale = 1): Obj {
  const sp = spriteOf(id)
  const [cx, cy] = proj([gx + 0.5, gy + 0.5, 0])
  const k = (SPRITE_SCALE[id] ?? 1) * scale
  if (sp) {
    const w = TW * k
    const h = (w * sp.h) / sp.w
    return { key, slot, id, parts: place([shadow(0.5, 0.5, 0.42 * k)], gx, gy), sprite: { href: sp.url, x: cx - w / 2, y: cy + TH * 0.34 * k - h, w, h }, sway: SWAY.has(id) }
  }
  const model = MODELS[id] ?? DECOR[id]
  return { key, slot, id, parts: model ? place(model(), gx, gy) : [], sway: SWAY.has(id) }
}
const objects = computed(() => {
  const list: Obj[] = []
  props.slots.forEach((b, i) => {
    const [gx, gy] = cellXY(i)
    if (terrainOf(i) === 'rock') list.push(makeObj('rock', gx, gy, gx + gy + 0.5))
    if (b) list.push(makeObj(b, gx, gy, gx + gy + 0.5, i))
  })
  if (!props.mini) {
    const back = ['pine', 'house_red', 'tree_s', 'lamp', 'house_blue', 'pine', 'tree_s', 'bush']
    const front = ['bush', 'lamp', 'bush', 'rock', 'flowers_p', 'bush']
    const id = area.value.id
    let k = 0
    for (let t = 0.25; t < X.value - 0.6; t += 1.15, k++) list.push(makeObj(back[Math.floor(rnd(id, k) * back.length)], t - 0.2, -0.3, t - 0.5, undefined, 0.72))
    for (let t = 1.2; t < Y.value - 0.6; t += 1.2, k++) list.push(makeObj(back[Math.floor(rnd(id, k) * back.length)], -0.3, t - 0.2, t - 0.5, undefined, 0.72))
    for (let t = 0.6; t < X.value - 0.4; t += 1.6, k++) list.push(makeObj(front[Math.floor(rnd(id, k) * front.length)], t - 0.2, Y.value - 0.66, t + Y.value, undefined, 0.6))
    for (let t = 0.6; t < Y.value - 1.2; t += 1.7, k++) list.push(makeObj(front[Math.floor(rnd(id, k) * front.length)], X.value - 0.66, t - 0.2, t + X.value, undefined, 0.6))
  }
  return list.sort((a, b) => a.key - b.key)
})
const rotorOf = (o: Obj) => {
  const r = spriteOf('windmill_rotor')
  if (o.id !== 'windmill' || !o.sprite || !r) return null
  const w = o.sprite.w * 1.25
  return { href: r.url, w, h: (w * r.h) / r.w, cx: o.sprite.x + o.sprite.w * 0.5, cy: o.sprite.y + o.sprite.h * 0.33 }
}
const glowOf = (o: Obj) => (o.id === 'lighthouse' && o.sprite ? { cx: o.sprite.x + o.sprite.w * 0.5, cy: o.sprite.y + o.sprite.h * 0.16, r: o.sprite.w * 0.38 } : null)

// ── 放置與點選 ──
const cells = computed(() =>
  props.slots.map((b, i) => {
    const [gx, gy] = cellXY(i)
    return { i, pts: diamond(gx, gy), inner: diamond(gx, gy, 0.1), free: !b && !terrainOf(i), has: !!b }
  }),
)
const sparkle = computed(() => {
  if (props.pop === null) return null
  const [gx, gy] = cellXY(props.pop)
  const [cx, cy] = proj([gx + 0.5, gy + 0.5, 0])
  return { cx, cy }
})

const names = computed(() => props.slots.map((id) => buildings.find((b) => b.id === id)?.name).filter(Boolean).join('、'))
const vb = computed(() => {
  const left = proj([0, Y.value, 0])[0], right = proj([X.value, 0, 0])[0]
  const top = proj([0, 0, 0])[1] - (props.mini ? 1.3 : 2.2) * TZ
  const bottom = proj([X.value, Y.value, -0.62])[1] + 26
  return { str: `${left - 6} ${top} ${right - left + 12} ${bottom - top}`, left, top, width: right - left + 12 }
})
</script>

<template>
  <svg class="iso" :viewBox="vb.str" role="img" :aria-label="names ? `${label}：${names}` : `${label}：還是空地`">
    <defs>
      <radialGradient id="liGlow"><stop offset="0" stop-color="#FFE07A" stop-opacity=".9" /><stop offset="1" stop-color="#FFE07A" stop-opacity="0" /></radialGradient>
    </defs>
    <!-- 雲 -->
    <g v-if="!mini" aria-hidden="true">
      <g class="cloud c1"><ellipse :cx="vb.left + 40" :cy="vb.top + 26" rx="22" ry="9" fill="#fff" opacity=".85" /><ellipse :cx="vb.left + 56" :cy="vb.top + 21" rx="16" ry="10" fill="#fff" opacity=".85" /></g>
      <g class="cloud c2"><ellipse :cx="vb.left + vb.width * 0.55" :cy="vb.top + 14" rx="18" ry="7" fill="#fff" opacity=".7" /><ellipse :cx="vb.left + vb.width * 0.55 + 14" :cy="vb.top + 10" rx="12" ry="8" fill="#fff" opacity=".7" /></g>
    </g>
    <IsoParts :parts="ground" />
    <IsoParts :parts="terrain" />
    <g v-for="r in ripples" :key="'r' + r.i" class="ripple" aria-hidden="true">
      <path :d="`M ${r.a[0][0]} ${r.a[0][1]} q 4 -3 8 0 t 8 0`" fill="none" stroke="#E6F8FC" stroke-width="1.2" stroke-linecap="round" />
      <path :d="`M ${r.a[1][0]} ${r.a[1][1]} q 4 -3 8 0 t 8 0`" fill="none" stroke="#E6F8FC" stroke-width="1.2" stroke-linecap="round" />
    </g>

    <!-- 只有放置模式才出現：可以蓋的位置框線 -->
    <g v-if="placing" aria-hidden="true">
      <polygon v-for="c in cells.filter((c) => c.free)" :key="'f' + c.i" :points="c.inner" class="free" />
    </g>
    <polygon v-if="selected !== null && cells[selected]" :points="cells[selected].pts" class="sel" aria-hidden="true" />

    <g v-for="(o, k) in objects" :key="k + o.id" :class="{ drop: o.slot !== undefined && o.slot === pop }">
      <IsoParts :parts="o.parts" />
      <g v-if="o.sprite" :class="{ sway: o.sway }" :style="{ transformOrigin: `${o.sprite.x + o.sprite.w / 2}px ${o.sprite.y + o.sprite.h}px`, animationDelay: `${(k % 5) * -0.7}s` }">
        <image :href="o.sprite.href" :x="o.sprite.x" :y="o.sprite.y" :width="o.sprite.w" :height="o.sprite.h" preserveAspectRatio="none" />
      </g>
      <g v-if="rotorOf(o)" class="spin" :style="{ transformOrigin: `${rotorOf(o)!.cx}px ${rotorOf(o)!.cy}px` }">
        <image :href="rotorOf(o)!.href" :x="rotorOf(o)!.cx - rotorOf(o)!.w / 2" :y="rotorOf(o)!.cy - rotorOf(o)!.h / 2" :width="rotorOf(o)!.w" :height="rotorOf(o)!.h" />
      </g>
      <circle v-if="glowOf(o)" class="glow" :cx="glowOf(o)!.cx" :cy="glowOf(o)!.cy" :r="glowOf(o)!.r" fill="url(#liGlow)" />
    </g>

    <!-- 剛蓋好：灰塵圈＋星星 -->
    <g v-if="sparkle" :key="'s' + pop" aria-hidden="true">
      <ellipse class="dust" :cx="sparkle.cx" :cy="sparkle.cy + 4" rx="26" ry="11" fill="none" stroke="#fff" stroke-width="3" />
      <path v-for="(d, n) in [[-22, -30], [20, -38], [4, -54]]" :key="n" class="spark" :style="{ animationDelay: `${n * 0.08}s` }"
        :d="`M ${sparkle.cx + d[0]} ${sparkle.cy + d[1] - 6} l 2 4 4 2 -4 2 -2 4 -2 -4 -4 -2 4 -2 z`" fill="#FCD56B" stroke="#E7A43C" stroke-width=".8" />
    </g>

    <!-- 點選區：每一格一塊透明菱形（看不到，只用來點） -->
    <g v-if="!mini">
      <polygon
        v-for="c in cells" :key="'h' + c.i" :points="c.pts" class="hit" :class="{ can: placing ? c.free : c.has }"
        :aria-label="c.has ? `第 ${c.i + 1} 格的建築` : c.free ? `第 ${c.i + 1} 格空地` : `第 ${c.i + 1} 格不能蓋`"
        @click="emit('cell', c.i)"
      />
    </g>
  </svg>
</template>

<style scoped>
.iso { display: block; width: 100%; height: auto; overflow: visible; touch-action: manipulation; }
.hit { fill: transparent; }
.hit.can { cursor: pointer; }
.free { fill: #FFFFFF; opacity: .3; stroke: #FFFFFF; stroke-width: 1.2; stroke-dasharray: 4 3; animation: breathe 1.4s ease-in-out infinite; }
.sel { fill: rgba(245, 186, 75, .35); stroke: #E7A43C; stroke-width: 2; }
.sway { animation: sway 4.2s ease-in-out infinite; }
.spin { animation: spin 6s linear infinite; }
.glow { animation: glow 2.4s ease-in-out infinite; }
.ripple path { animation: shimmer 2.8s ease-in-out infinite; }
.ripple path + path { animation-delay: -1.4s; }
.cloud { animation: drift 38s linear infinite; }
.cloud.c2 { animation-duration: 52s; animation-delay: -20s; }
.drop { animation: drop .6s cubic-bezier(.2, 1.5, .4, 1); }
.dust { transform-box: fill-box; transform-origin: center; animation: dust .7s ease-out forwards; }
.spark { transform-box: fill-box; transform-origin: center; animation: spark .9s ease-out forwards; opacity: 0; }
@keyframes sway { 0%, 100% { transform: rotate(-1.4deg) } 50% { transform: rotate(1.4deg) } }
@keyframes spin { to { transform: rotate(360deg) } }
@keyframes glow { 0%, 100% { opacity: .35 } 50% { opacity: .95 } }
@keyframes shimmer { 0%, 100% { opacity: .2; transform: translateX(-2px) } 50% { opacity: .9; transform: translateX(2px) } }
@keyframes drift { from { transform: translateX(-80px) } to { transform: translateX(420px) } }
@keyframes breathe { 0%, 100% { opacity: .2 } 50% { opacity: .5 } }
@keyframes drop { 0% { transform: translateY(-60px); opacity: 0 } 60% { opacity: 1 } 100% { transform: none } }
@keyframes dust { from { transform: scale(.4); opacity: .9 } to { transform: scale(1.6); opacity: 0 } }
@keyframes spark { 0% { opacity: 0; transform: translateY(6px) scale(.4) } 30% { opacity: 1 } 100% { opacity: 0; transform: translateY(-14px) scale(1.1) } }
@media (prefers-reduced-motion: reduce) {
  .sway, .spin, .glow, .ripple path, .cloud, .drop, .dust, .free { animation: none; }
  .spark { animation: none; opacity: 0; }
}
</style>
