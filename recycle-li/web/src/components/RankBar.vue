<script setup lang="ts">
// 等級條：Lv、稱號、離下一級還差幾顆星；右邊是手上可以用的星星。
import { computed } from 'vue'
import AppIcon from './AppIcon.vue'
import Zy from './Zy.vue'
import { useGame } from '@/stores/game'

withDefaults(defineProps<{ compact?: boolean }>(), { compact: false })
const game = useGame()
const r = computed(() => game.rank)
const pct = computed(() => (r.value.next ? Math.min(100, (r.value.into / r.value.span) * 100) : 100))
</script>

<template>
  <div class="rank card" :class="{ compact }">
    <span class="badge-lv" :aria-label="`等級 ${r.lv}`"><AppIcon :name="r.icon" :size="compact ? 22 : 28" :stroke="1.8" /><b>{{ r.lv }}</b></span>
    <div class="mid">
      <strong><Zy :text="r.title" /></strong>
      <div class="bar" role="progressbar" :aria-valuenow="Math.round(pct)" aria-valuemin="0" aria-valuemax="100"><i :style="{ width: pct + '%' }"></i></div>
      <small v-if="r.next && !compact" class="muted"><Zy :text="`再 ${r.span - r.into} 顆星升到 ${r.next.title}`" /></small>
    </div>
    <span class="wallet" :aria-label="`手上有 ${game.stars} 顆星`"><AppIcon name="Star" :size="compact ? 22 : 26" :stroke="2" /> {{ game.stars }}</span>
  </div>
</template>

<style scoped>
.rank { display: flex; align-items: center; gap: 12px; padding: 12px 14px; }
.badge-lv {
  position: relative; flex: none; width: 54px; height: 54px; border-radius: 16px; display: grid; place-items: center;
  background: linear-gradient(160deg, #FFE7A8, #F5BA4B); color: #7A4E0E; box-shadow: inset 0 -3px 0 rgba(0,0,0,.12);
}
.badge-lv b { position: absolute; right: -6px; bottom: -6px; background: var(--primary-700); color: #fff; border-radius: 999px; min-width: 24px; height: 24px; display: grid; place-items: center; font-size: .85rem; border: 2px solid #fff; }
.compact .badge-lv { width: 42px; height: 42px; border-radius: 12px; }
.mid { flex: 1; display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.mid strong { color: var(--primary-900); font-size: var(--fs-title); }
.bar i { background: linear-gradient(90deg, #F5BA4B, #E7A43C); }
.wallet { display: inline-flex; align-items: center; gap: 4px; font-weight: 800; font-size: var(--fs-h2); color: #AD7B2B; }
.wallet :deep(svg) { color: #E7A43C; fill: #FCE7B2; }
</style>
