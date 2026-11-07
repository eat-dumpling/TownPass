<script setup lang="ts">
// 把 iso.ts 的零件畫成 SVG（放在外層 <svg> 裡面用）。每組零件自己帶漸層定義，不靠別的 SVG。
import { computed } from 'vue'
import { gradId, type Grad, type Part } from './iso'
const props = defineProps<{ parts: Part[] }>()
const grads = computed(() => {
  const m = new Map<string, Grad>()
  for (const p of props.parts) if (p.grad) m.set(gradId(p.grad), p.grad)
  return [...m.entries()]
})
const fillOf = (p: Part) => (p.grad ? `url(#${gradId(p.grad)})` : p.fill)
const hasBlur = computed(() => props.parts.some((p) => p.blur))
</script>

<template>
  <defs>
    <template v-for="[id, g] in grads" :key="id">
      <linearGradient v-if="g.type === 'l'" :id="id" :x1="g.x1" :y1="g.y1" :x2="g.x2" :y2="g.y2">
        <stop v-for="(c, i) in g.stops" :key="i" :offset="g.stops.length === 1 ? 0 : i / (g.stops.length - 1)" :stop-color="c" />
      </linearGradient>
      <radialGradient v-else :id="id" :cx="g.cx" :cy="g.cy" :r="g.r">
        <stop v-for="(c, i) in g.stops" :key="i" :offset="g.stops.length === 1 ? 0 : i / (g.stops.length - 1)" :stop-color="c" />
      </radialGradient>
    </template>
    <filter v-if="hasBlur" id="isoBlur" x="-30%" y="-60%" width="160%" height="220%"><feGaussianBlur stdDeviation="2.6" /></filter>
  </defs>
  <template v-for="(p, i) in parts" :key="i">
    <polygon v-if="p.kind === 'poly'" :points="p.points" :fill="fillOf(p)" :stroke="p.stroke" :stroke-width="p.sw" :opacity="p.opacity" stroke-linejoin="round" />
    <path v-else-if="p.kind === 'path'" :d="p.d" :fill="fillOf(p)" :stroke="p.stroke" :stroke-width="p.sw" :opacity="p.opacity" :filter="p.blur ? 'url(#isoBlur)' : undefined" stroke-linejoin="round" />
    <circle v-else-if="p.kind === 'ball'" :cx="p.cx" :cy="p.cy" :r="p.r" :fill="fillOf(p)" :stroke="p.stroke" :stroke-width="p.sw" />
    <polyline v-else :points="p.points" fill="none" :stroke="p.stroke" :stroke-width="p.sw" stroke-linecap="round" stroke-linejoin="round" :opacity="p.opacity" />
  </template>
</template>
