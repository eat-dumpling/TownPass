<script setup lang="ts">
// 一次一個步驟：上方進度點、中間一個主要內容、下方「上一步／下一步」。
import { useI18n } from 'vue-i18n'
import AppIcon from './AppIcon.vue'
defineProps<{ step: number; total: number; nextLabel?: string; hideNext?: boolean }>()
const emit = defineEmits<{ next: []; prev: [] }>()
const { t } = useI18n()
</script>

<template>
  <section class="shell">
    <ol class="dots" :aria-label="t('g_step', { n: step + 1, m: total })">
      <li v-for="k in total" :key="k" :class="{ on: k - 1 === step, done: k - 1 < step }"></li>
    </ol>
    <div class="body slide" :key="step"><slot /></div>
    <footer class="foot">
      <button v-if="step > 0" class="btn" @click="emit('prev')"><AppIcon name="ChevronLeft" /> {{ t('back') }}</button>
      <span v-else></span>
      <button v-if="!hideNext" class="btn primary" @click="emit('next')">{{ nextLabel ?? t('next') }} <AppIcon name="ChevronRight" /></button>
    </footer>
  </section>
</template>

<style scoped>
.shell { display: flex; flex-direction: column; gap: 16px; min-height: calc(100vh - 120px); }
.dots { list-style: none; display: flex; gap: 6px; padding: 0; margin: 0; justify-content: center; }
.dots li { width: 10px; height: 10px; border-radius: 999px; background: var(--gray-200); }
.dots li.done { background: var(--primary-300); }
.dots li.on { background: var(--primary-500); width: 26px; }
.body { flex: 1; display: flex; flex-direction: column; gap: 14px; }
/* 換步驟時只滑動、不從透明淡入（動畫被暫停時內容也看得到） */
@keyframes slide { from { transform: translateX(16px) } to { transform: none } }
.slide { animation: slide .25s ease-out; }
@media (prefers-reduced-motion: reduce) { .slide { animation: none } }
.foot { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; position: sticky; bottom: 0; padding: 8px 0 calc(8px + env(safe-area-inset-bottom)); background: linear-gradient(transparent, var(--primary-50) 30%); }
.foot .btn { min-height: 56px; }
</style>
