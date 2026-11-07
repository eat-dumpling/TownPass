<script setup lang="ts">
// 處理步驟用圖示排成小漫畫（1 → 2 → 3）
import Zy from '@/components/Zy.vue'
import AppIcon from './AppIcon.vue'
import { prepMeta } from '@/domain/catalog'
import type { PrepId } from '@/domain/types'
defineProps<{ steps: PrepId[]; color?: string }>()
</script>

<template>
  <ol v-if="steps.length" class="strip" aria-label="處理步驟">
    <li v-for="(s, i) in steps" :key="s" class="step pop" :style="{ animationDelay: i * 0.12 + 's' }">
      <span class="num" :style="color ? { background: color } : {}">{{ i + 1 }}</span>
      <AppIcon :name="prepMeta[s].icon" :size="34" :stroke="1.8" />
      <span><Zy :text="prepMeta[s].label" /></span>
    </li>
  </ol>
</template>

<style scoped>
.strip { list-style: none; display: flex; gap: 10px; padding: 0; margin: 0; justify-content: center; flex-wrap: wrap; }
.step { background: var(--white); border-radius: 16px; padding: 10px 10px 8px; min-width: 80px; display: flex; flex-direction: column; align-items: center; gap: 4px; box-shadow: var(--shadow); font-weight: 700; position: relative; color: var(--gray-800); }
.num { position: absolute; top: -8px; left: -8px; background: var(--secondary-500); color: var(--white); border-radius: 999px; width: 24px; height: 24px; font-size: 13px; display: grid; place-items: center; }
</style>
