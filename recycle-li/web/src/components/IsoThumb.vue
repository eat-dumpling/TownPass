<script setup lang="ts">
// 一個建築的小圖（建築卡、地圖裝飾用）：有插圖用插圖，沒有就用向量模型放在一塊草墊上
import { computed } from 'vue'
import { box, TW, TZ } from './iso/iso'
import { DECOR, MODELS, house } from './iso/models'
import { spriteOf } from './iso/sprites'
import IsoParts from './iso/IsoParts.vue'

const props = withDefaults(defineProps<{ id: string; size?: number; ground?: boolean; color?: string }>(), { size: 72, ground: true, color: '#C2332F' })
const sprite = computed(() => spriteOf(props.id === 'house' ? (props.color === '#356C77' ? 'house_blue' : 'house_red') : props.id))
const rotor = computed(() => (props.id === 'windmill' ? spriteOf('windmill_rotor') : null))
const parts = computed(() => [
  ...(props.ground ? box(0, 0, -0.12, 1, 1, 0.12, '#7FB86F', '#A3D893') : []),
  ...(sprite.value ? [] : props.id === 'house' ? house(props.color) : (MODELS[props.id] ?? DECOR[props.id])?.() ?? []),
])
</script>

<template>
  <span v-if="sprite" class="thumb" :style="{ width: size + 'px', height: size + 'px' }" aria-hidden="true">
    <img :src="sprite.url" alt="" />
    <img v-if="rotor" :src="rotor.url" alt="" class="rotor" />
  </span>
  <svg v-else :width="size" :height="size" :viewBox="`${-TW / 2 - 4} ${-1.95 * TZ} ${TW + 8} ${TW + 2 + 0.6 * TZ}`" aria-hidden="true">
    <IsoParts :parts="parts" />
  </svg>
</template>

<style scoped>
.thumb { position: relative; display: inline-grid; place-items: end center; }
.thumb img { max-width: 100%; max-height: 100%; object-fit: contain; filter: drop-shadow(0 4px 3px rgba(14, 42, 26, .2)); }
.rotor { position: absolute; width: 62%; top: 0; left: 50%; transform: translateX(-52%); animation: spin 6s linear infinite; filter: none; }
@keyframes spin { to { transform: translateX(-52%) rotate(360deg) } }
@media (prefers-reduced-motion: reduce) { .rotor { animation: none; } }
</style>
