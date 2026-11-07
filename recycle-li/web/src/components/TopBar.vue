<script setup lang="ts">
// 每頁一個標題（無障礙 ST）；返回鍵 48×48。
import Zy from '@/components/Zy.vue'
import { useRouter } from 'vue-router'
withDefaults(defineProps<{ title: string; back?: string | false; zy?: boolean }>(), { zy: true })
const router = useRouter()
</script>

<template>
  <header class="topbar">
    <button v-if="back !== false" class="btn ghost back" aria-label="返回" @click="back ? router.push(back) : router.back()">
      <span class="ico" aria-hidden="true">‹</span>
    </button>
    <h1><Zy v-if="zy" :text="title" /><template v-else>{{ title }}</template></h1>
    <slot />
  </header>
</template>

<style scoped>
.topbar { display: flex; align-items: center; gap: 4px; min-height: 56px; margin-bottom: 8px; }
h1 { font-size: var(--fs-h2); margin: 0; flex: 1; color: var(--primary-900); }
.back { padding: 0; width: var(--tap); }
.back .ico { font-size: 2.2rem; }
</style>
