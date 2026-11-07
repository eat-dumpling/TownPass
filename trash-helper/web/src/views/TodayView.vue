<script setup lang="ts">
// 今天能不能丟：依臺北市環保局的收運規則（官方 CSV 的回收時間；一般垃圾與廚餘週三、週日停收）。
import { useI18n } from 'vue-i18n'
import TopNav from '~/components/TopNav.vue'
import AppIcon from '~/components/AppIcon.vue'
import { kindMeta } from '@/domain/catalog'
import { nextDay, taipeiDow, TODAY_GROUPS } from '~/lib/rules'

const { t } = useI18n()
const today = taipeiDow()
const off = today === 0 || today === 3
const LABEL: Record<string, string> = { general: 'kinds.general', food: 'kinds.food', r3d: 'cats.recycle_3d', rflat: 'cats.recycle_flat', other: 'kinds.hazard' }
const rows = TODAY_GROUPS.map((g) => ({ ...g, next: nextDay(g.days, today)! }))
</script>

<template>
  <main class="page stack">
    <TopNav :title="t('today_title')" back="/" />
    <div class="day card center" :class="{ off }">
      <AppIcon :name="off ? 'CalendarOff' : 'CalendarCheck'" :size="56" :stroke="1.6" />
      <p class="big">{{ t('today_is', { day: t(`days.${today}`) }) }}</p>
      <p v-if="off" class="offtxt">{{ t('today_off') }}</p>
    </div>
    <h2 class="h2">{{ t('today_cats') }}</h2>
    <ul class="rows">
      <li v-for="r in rows" :key="r.key" :class="{ yes: r.next.inDays === 0 }">
        <span class="ic" :style="{ background: kindMeta[r.kind].color }"><AppIcon :name="kindMeta[r.kind].icon" :size="28" /></span>
        <span class="txt"><b>{{ t(LABEL[r.key]) }}</b>
          <small>{{ r.days.map((d) => t(`days_short.${d}`)).join(' · ') }}</small></span>
        <span class="verdict">
          <template v-if="r.next.inDays === 0"><AppIcon name="CircleCheck" :size="28" /><span class="sr-only">{{ t('today_yes') }}</span></template>
          <template v-else><small>{{ t('today_next', { day: t(`days_short.${r.next.dow}`) }) }}</small></template>
        </span>
      </li>
    </ul>
    <p class="muted">{{ t('today_evening') }}</p>
    <router-link to="/identify" class="btn primary block"><AppIcon name="Camera" /> {{ t('home_sort') }}</router-link>
    <router-link to="/first-time?step=2" class="btn block"><AppIcon name="MapPin" /> {{ t('stops_near') }}</router-link>
  </main>
</template>

<style scoped>
.day { display: flex; flex-direction: column; align-items: center; gap: 4px; color: #2F7A3A; }
.day.off { color: var(--secondary-700); background: var(--secondary-50); }
.big { margin: 0; font-size: var(--fs-h2); font-weight: 800; color: var(--primary-900); }
.offtxt { margin: 0; font-weight: 800; font-size: var(--fs-title); }
.h2 { font-size: var(--fs-title); margin: 4px 0 0; }
.rows { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.rows li { display: flex; align-items: center; gap: 12px; background: var(--white); border-radius: 14px; padding: 10px 12px; box-shadow: var(--shadow); opacity: .75; }
.rows li.yes { opacity: 1; outline: 3px solid #2F7A3A; }
.ic { width: 48px; height: 48px; border-radius: 12px; display: grid; place-items: center; color: #fff; flex: none; }
.txt { flex: 1; display: flex; flex-direction: column; }
.txt small { color: var(--gray-600); }
.verdict { color: #2F7A3A; font-weight: 800; text-align: right; }
.verdict small { color: var(--secondary-700); }
</style>
