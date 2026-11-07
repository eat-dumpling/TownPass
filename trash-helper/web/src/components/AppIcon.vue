<script setup lang="ts">
// Tabler Icons（MIT）。名稱要寫成字面字串（或放在資料的 icon 欄位），scripts/gen-icons.mjs 才收得到。
import { computed } from 'vue'
import { icons } from './icons.gen'
const props = withDefaults(defineProps<{ name: string; size?: number | string; stroke?: number; label?: string }>(), { size: 24, stroke: 2 })
const comp = computed(() => (icons as Record<string, unknown>)[props.name] ?? icons.QuestionMark)
</script>

<template>
  <component :is="comp" :size="size" :stroke="stroke" :aria-hidden="label ? undefined : 'true'" :aria-label="label" :role="label ? 'img' : undefined" style="flex: none; vertical-align: middle" />
</template>
