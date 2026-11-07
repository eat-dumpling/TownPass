<script setup lang="ts">
// 品項插圖的佔位版：類別顏色的圓角方塊＋白色線條圖示（參考回收標誌的風格）。M6 換成 monster_{id}.webp。
import { computed } from 'vue'
import AppIcon from './AppIcon.vue'
import { kindMeta } from '@/domain/catalog'
import type { Item } from '@/domain/types'
const props = withDefaults(defineProps<{ item: Item; size?: number; dim?: boolean }>(), { size: 96 })
const color = computed(() => (props.dim ? '#CAD1D5' : kindMeta[props.item.kind].color))
</script>

<template>
  <span class="art" :style="{ width: size + 'px', height: size + 'px', background: color, borderRadius: size * 0.24 + 'px' }">
    <AppIcon :name="item.icon" :size="size * 0.6" :stroke="1.6" color="#fff" />
  </span>
</template>

<style scoped>
.art { display: inline-grid; place-items: center; box-shadow: inset 0 0 0 3px rgba(255,255,255,.55), var(--shadow); flex: none; }
</style>
