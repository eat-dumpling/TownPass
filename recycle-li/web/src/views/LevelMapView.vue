<script setup lang="ts">
// 考考你破關地圖：一關一站，沿著里的小路走。過關（至少 1 顆星）才開下一關。
// 地圖是 2.5D：小路有厚度、每一站是一塊立體地台，旁邊有房子和樹。
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import TopBar from '@/components/TopBar.vue'
import Mascot from '@/components/Mascot.vue'
import AppIcon from '@/components/AppIcon.vue'
import Zy from '@/components/Zy.vue'
import IsoThumb from '@/components/IsoThumb.vue'
import IsoParts from '@/components/iso/IsoParts.vue'
import { box } from '@/components/iso/iso'
import { LEVELS } from '@/solvers/quiz'
import { useGame } from '@/stores/game'

const game = useGame()
const router = useRouter()
const W = 360
const STEP = 118
const TOP = 100
const H = TOP + LEVELS.length * STEP
const nodes = computed(() =>
  LEVELS.map((lv, i) => ({
    lv, i, x: i % 2 ? 240 : 120, y: TOP + i * STEP,
    open: game.levelOpen(lv.id), stars: game.levels[lv.id]?.stars ?? 0,
  })),
)
// 現在要打的關：第一個開了但還沒過的；都過了就停在最後一關
const current = computed(() => nodes.value.find((n) => n.open && !n.stars)?.lv.id ?? LEVELS[LEVELS.length - 1].id)
const road = computed(() =>
  nodes.value.reduce((d, n, i, a) => {
    if (!i) return `M ${n.x} ${n.y}`
    const p = a[i - 1]
    return `${d} C ${p.x} ${p.y + STEP * 0.55}, ${n.x} ${n.y - STEP * 0.55}, ${n.x} ${n.y}`
  }, ''),
)
// 地台：縮放 1.5 倍的立體方塊，顏色看狀態
const plat = (open: boolean, stars: number) => box(-0.5, -0.5, -0.32, 1, 1, 0.32, stars ? '#F5BA4B' : open ? '#5AB4C5' : '#CAD1D5')
const decos = [
  { id: 'house', color: '#C2332F' }, { id: 'tree' }, { id: 'house', color: '#356C77' }, { id: 'garden' },
  { id: 'tree' }, { id: 'library' }, { id: 'house', color: '#E6692C' }, { id: 'playground' },
]
const total = computed(() => Object.values(game.levels).reduce((s, l) => s + l.stars, 0))
function go(n: { lv: { id: number }; open: boolean }) {
  if (n.open) router.push(`/quiz/${n.lv.id}`)
}
</script>

<template>
  <main class="page stack">
    <TopBar title="考考你" back="/">
      <span class="total" :aria-label="`一共 ${total} 顆星`"><AppIcon name="Star" :size="22" /> {{ total }}</span>
    </TopBar>
    <Mascot :size="48" line="答對題目過關，拿星星蓋房子！" />

    <div class="map" :style="{ aspectRatio: `${W} / ${H}` }">
      <svg :viewBox="`0 0 ${W} ${H}`" class="bg" aria-hidden="true">
        <defs>
          <linearGradient id="grass" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#DDF2D6" /><stop offset="1" stop-color="#C5E8BB" /></linearGradient>
        </defs>
        <rect x="0" y="0" :width="W" :height="H" rx="24" fill="url(#grass)" />
        <!-- 小路：先畫深色的側面，再畫路面和中線，看起來有厚度 -->
        <path :d="road" fill="none" stroke="#B49F7A" stroke-width="34" stroke-linecap="round" transform="translate(0 6)" />
        <path :d="road" fill="none" stroke="#EFE3C8" stroke-width="30" stroke-linecap="round" />
        <path :d="road" fill="none" stroke="#fff" stroke-width="3" stroke-dasharray="8 10" stroke-linecap="round" opacity=".8" />
        <g v-for="n in nodes" :key="n.lv.id" :transform="`translate(${n.x} ${n.y + 6}) scale(1.5)`">
          <IsoParts :parts="plat(n.open, n.stars)" />
        </g>
      </svg>
      <!-- 裝飾：每一站旁邊一個小建築 -->
      <span v-for="n in nodes" :key="'d' + n.i" class="deco" :style="{ left: `${((n.i % 2 ? 52 : 308) / W) * 100}%`, top: `${((n.y - 6) / H) * 100}%` }">
        <IsoThumb :id="decos[n.i % decos.length].id" :color="decos[n.i % decos.length].color" :size="64" :ground="false" />
      </span>
      <!-- 關卡按鈕 -->
      <button
        v-for="n in nodes" :key="n.lv.id" class="node" :class="{ locked: !n.open, now: n.lv.id === current }"
        :style="{ left: `${(n.x / W) * 100}%`, top: `${(n.y / H) * 100}%` }"
        :aria-label="n.open ? `第 ${n.lv.id} 關 ${n.lv.title}，${n.stars} 顆星` : `第 ${n.lv.id} 關，還沒打開`" :aria-disabled="!n.open" @click="go(n)"
      >
        <span class="disc">
          <AppIcon v-if="n.open" :name="n.lv.icon" :size="30" :stroke="1.8" />
          <AppIcon v-else name="Lock" :size="26" />
        </span>
        <span class="stars"><AppIcon v-for="k in 3" :key="k" name="Star" :size="16" :class="{ on: k <= n.stars }" /></span>
        <span class="nm"><Zy :text="n.lv.title" /></span>
      </button>
    </div>
  </main>
</template>

<style scoped>
.total { display: inline-flex; align-items: center; gap: 4px; font-weight: 800; color: var(--secondary-700); font-size: var(--fs-title); }
.map { position: relative; width: 100%; max-width: 420px; margin: 0 auto; }
.bg { position: absolute; inset: 0; width: 100%; height: 100%; }
.deco { position: absolute; transform: translate(-50%, -60%); pointer-events: none; }
.node {
  position: absolute; transform: translate(-50%, -78%); background: none; border: 0; padding: 0;
  display: flex; flex-direction: column; align-items: center; gap: 2px; min-width: 88px; min-height: var(--tap);
}
.disc {
  width: 58px; height: 58px; border-radius: 50%; display: grid; place-items: center; background: var(--white); color: var(--primary-700);
  box-shadow: 0 5px 0 rgba(17, 38, 41, .18), var(--shadow); border: 3px solid var(--primary-500);
}
.now .disc { border-color: var(--secondary-500); color: var(--secondary-700); animation: bob 1.6s ease-in-out infinite; }
.locked .disc { color: var(--gray-500); border-color: var(--gray-300); background: var(--gray-50); }
.stars { display: flex; gap: 1px; color: var(--gray-200); }
.stars .on { color: var(--secondary-500); }
.nm { white-space: nowrap; background: rgba(255, 255, 255, .9); border-radius: 10px; padding: 2px 8px; font-weight: 800; color: var(--primary-900); font-size: var(--fs-body); }
.locked .nm { color: var(--gray-500); }
@keyframes bob { 50% { transform: translateY(-4px); } }
@media (prefers-reduced-motion: reduce) { .now .disc { animation: none; } }
</style>
