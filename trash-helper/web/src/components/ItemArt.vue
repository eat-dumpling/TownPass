<script setup lang="ts">
// 品項圖（佔位）：回收標誌的類別色＋白色線條圖示。之後換成插圖。
import AppIcon from './AppIcon.vue'
import { kindMeta } from '@/domain/catalog'
import type { Item } from '@/domain/types'
withDefaults(defineProps<{ item: Item; size?: number }>(), { size: 96 })
</script>

<template>
  <span class="art" :style="{ width: size + 'px', height: size + 'px', background: kindMeta[item.kind].color, borderRadius: size * 0.24 + 'px' }">
    <AppIcon :name="item.icon" :size="size * 0.6" :stroke="1.6" color="#fff" />
  </span>
</template>

<style scoped>.art { display: inline-grid; place-items: center; box-shadow: inset 0 0 0 3px rgba(255,255,255,.55), var(--shadow); flex: none; }</style>
