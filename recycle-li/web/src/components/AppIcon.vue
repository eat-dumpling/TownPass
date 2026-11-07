<script setup lang="ts">
// Tabler Icons（MIT）。名稱寫在資料的 icon 欄位或 <AppIcon name="...">，由 scripts/gen-icons.mjs 收進 icons.gen.ts。
// 裝飾用的圖示預設 aria-hidden；有意義時給 label。找不到名稱時用 ICON('QuestionMark')（讓 gen-icons 收進來）。
import { computed } from 'vue'
import { icons } from './icons.gen'
const props = withDefaults(defineProps<{ name: string; size?: number | string; stroke?: number; label?: string }>(), { size: 24, stroke: 2 })
const comp = computed(() => (icons as Record<string, unknown>)[props.name] ?? icons.QuestionMark)
</script>

<template>
  <component :is="comp" :size="size" :stroke="stroke" :aria-hidden="label ? undefined : 'true'" :aria-label="label" :role="label ? 'img' : undefined" class="app-icon" />
</template>

<style scoped>.app-icon { flex: none; vertical-align: middle; }</style>
