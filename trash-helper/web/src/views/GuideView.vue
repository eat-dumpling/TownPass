<script setup lang="ts">
// 第一次倒垃圾：五個步驟，一次一頁。第三步用真實的垃圾車停靠點資料。
// 內容依據：臺北市環保局「垃圾費隨袋徵收」（專用垃圾袋、每公升 0.36 元）、資源回收分類方式（收運日）、
// 廢棄物清理法第 50 條（未依規定排出罰鍰 1,200–6,000 元）。上線前請再核對一次。
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import TopNav from '~/components/TopNav.vue'
import AppIcon from '~/components/AppIcon.vue'
import StepShell from '~/components/StepShell.vue'
import StopsPanel from '~/components/StopsPanel.vue'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const TOTAL = 5
const i = ref(Math.min(TOTAL - 1, Math.max(0, Number(route.query.step ?? 0) || 0)))
const go = (d: number) => {
  if (i.value + d >= TOTAL) { router.push('/'); return }
  i.value = Math.max(0, i.value + d)
}
const SIZES = [3, 5, 14, 25, 33, 76, 120]
</script>

<template>
  <main class="page stack">
    <TopNav :title="t('g_title')" back="/" />
    <StepShell :step="i" :total="TOTAL" :next-label="i === TOTAL - 1 ? t('done') : undefined" @next="go(1)" @prev="go(-1)">
      <template v-if="i === 0">
        <div class="hero center"><span class="bigic" style="background: #D2552A"><AppIcon name="ShoppingBag" :size="96" :stroke="1.5" /></span><h2>{{ t('g1_t') }}</h2></div>
        <ul class="pts">
          <li><AppIcon name="Trash" /> {{ t('g1_a') }}</li>
          <li><AppIcon name="BuildingStore" /> {{ t('g1_b') }}</li>
          <li><AppIcon name="Ruler2" /> {{ t('g1_c') }}</li>
          <li><AppIcon name="Recycle" /> {{ t('g1_d') }}</li>
        </ul>
        <ul class="sizes" aria-label="bag sizes"><li v-for="s in SIZES" :key="s">{{ s }} L</li></ul>
      </template>
      <template v-else-if="i === 1">
        <div class="hero center"><span class="bigic" style="background: var(--primary-500)"><AppIcon name="Home" :size="96" :stroke="1.5" /></span><h2>{{ t('g2_t') }}</h2></div>
        <ul class="three">
          <li style="--c: #D2552A"><AppIcon name="ShoppingBag" :size="36" /><b>{{ t('g2_a') }}</b></li>
          <li style="--c: #6E8B3D"><AppIcon name="Bucket" :size="36" /><b>{{ t('g2_b') }}</b></li>
          <li style="--c: #1F7A4D"><AppIcon name="Recycle" :size="36" /><b>{{ t('g2_c') }}</b></li>
        </ul>
      </template>
      <template v-else-if="i === 2">
        <h2 class="center">{{ t('g3_t') }}</h2>
        <p class="warnbox"><AppIcon name="CalendarOff" /> {{ t('g3_a') }}</p>
        <StopsPanel />
      </template>
      <template v-else-if="i === 3">
        <div class="hero center"><span class="bigic" style="background: var(--secondary-600)"><AppIcon name="Music" :size="96" :stroke="1.5" /></span><h2>{{ t('g4_t') }}</h2></div>
        <ul class="pts">
          <li><AppIcon name="Clock" /> {{ t('g4_a') }}</li>
          <li><AppIcon name="Music" /> {{ t('g4_b') }}</li>
          <li class="bad"><AppIcon name="AlertTriangle" /> {{ t('g4_c') }}</li>
        </ul>
      </template>
      <template v-else>
        <div class="hero center"><span class="bigic" style="background: #1F7A4D"><AppIcon name="Truck" :size="96" :stroke="1.5" /></span><h2>{{ t('g5_t') }}</h2></div>
        <ul class="three">
          <li style="--c: #D2552A"><AppIcon name="Truck" :size="36" /><b>{{ t('g5_a') }}</b></li>
          <li style="--c: #6E8B3D"><AppIcon name="Bucket" :size="36" /><b>{{ t('g5_b') }}</b></li>
          <li style="--c: #1F7A4D"><AppIcon name="Recycle" :size="36" /><b>{{ t('g5_c') }}</b></li>
        </ul>
      </template>
    </StepShell>
  </main>
</template>

<style scoped>
.hero { display: flex; flex-direction: column; align-items: center; gap: 10px; }
h2 { margin: 0; font-size: var(--fs-h2); }
.bigic { width: 150px; height: 150px; border-radius: 40px; display: grid; place-items: center; color: #fff; box-shadow: inset 0 0 0 5px rgba(255,255,255,.5), var(--shadow); }
.pts { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
.pts li { display: flex; gap: 10px; align-items: flex-start; background: var(--white); border-radius: 14px; padding: 12px; box-shadow: var(--shadow); font-size: var(--fs-h3); font-weight: 600; }
.pts li.bad { color: var(--orange-600); background: var(--orange-100); }
.sizes { list-style: none; display: flex; flex-wrap: wrap; gap: 6px; padding: 0; margin: 0; justify-content: center; }
.sizes li { background: #D2552A; color: #fff; border-radius: 8px; padding: 4px 10px; font-weight: 800; }
.three { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
.three li { display: flex; align-items: center; gap: 14px; background: var(--c); color: #fff; border-radius: 16px; padding: 14px; font-size: var(--fs-title); }
.warnbox { margin: 0; background: var(--secondary-50); color: var(--secondary-700); border-radius: 12px; padding: 10px 12px; font-weight: 800; display: flex; gap: 6px; align-items: center; }
</style>
