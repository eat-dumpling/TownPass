<script setup lang="ts">
// 結果：一次只做一步。
//   這是什麼（分類） → 處理步驟（每個步驟一頁） → 用什麼裝 → 什麼時候丟（今天可不可以） → 交給誰 → 完成
// 規則全部來自共用的分類表（臺北市環保局資源回收分類方式＋回收一點通）。
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import TopNav from '~/components/TopNav.vue'
import AppIcon from '~/components/AppIcon.vue'
import ItemArt from '~/components/ItemArt.vue'
import StepShell from '~/components/StepShell.vue'
import { kindMeta, prepMeta, whereMeta } from '@/domain/catalog'
import { sendApp } from '@/bridge/flutter'
import { bagKey, itemById, itemName, itemNote, nextDay, taipeiDow, whenOf } from '~/lib/rules'
import type { LangId } from '~/i18n'

const { t, locale } = useI18n()
const route = useRoute()
const router = useRouter()
const item = computed(() => itemById(route.params.id as string)!)
const lang = computed(() => locale.value as LangId)
const alts = computed(() => String(route.query.alt ?? '').split(',').map(itemById).filter(Boolean))
const kind = computed(() => kindMeta[item.value.kind])
const bag = computed(() => bagKey(item.value))
const when = computed(() => whenOf(item.value))
const today = taipeiDow()
const next = computed(() => (when.value.mode === 'days' ? nextDay(when.value.days, today) : null))
const note = computed(() => itemNote(item.value, lang.value))
const noTouch = computed(() => item.value.safety === 'no_touch')

type Step = { k: 'what' } | { k: 'prep'; p: string; n: number } | { k: 'bag' } | { k: 'when' } | { k: 'where' } | { k: 'done' }
const steps = computed<Step[]>(() => {
  const s: Step[] = [{ k: 'what' }]
  if (!noTouch.value) item.value.steps.forEach((p, i) => s.push({ k: 'prep', p, n: i + 1 }))
  if (bag.value !== 'unknown') s.push({ k: 'bag' })
  s.push({ k: 'when' }, { k: 'where' }, { k: 'done' })
  return s
})
const i = ref(0)
const cur = computed(() => steps.value[i.value])
const go = (d: number) => { i.value = Math.max(0, Math.min(steps.value.length - 1, i.value + d)) }

const BAG_ICON: Record<string, string> = { general: 'ShoppingBag', food: 'Bucket', recycle: 'Recycle', hazard: 'AlertTriangle', bulky: 'Phone', special: 'BuildingHospital', unknown: 'Phone' }
const otherName = computed(() => (lang.value === 'zh' ? item.value.name.en : item.value.name.zh))
const call1999 = () => sendApp('phone_call', '1999')
</script>

<template>
  <main class="page stack" v-if="item">
    <TopNav :title="itemName(item, lang)" back="/identify" />
    <StepShell :step="i" :total="steps.length" :hide-next="cur.k === 'done'" @next="go(1)" @prev="go(-1)">
      <!-- 1 這是什麼 -->
      <template v-if="cur.k === 'what'">
        <p class="label">{{ t('steps.what') }}</p>
        <div class="hero center">
          <ItemArt :item="item" :size="132" />
          <h2>{{ itemName(item, lang) }}</h2>
          <p class="other" lang="zh-Hant-TW" v-if="lang !== 'zh'">{{ otherName }}</p>
          <span class="pill" :style="{ background: kind.color }"><AppIcon :name="kind.icon" :size="20" /> {{ t(`kinds.${item.kind}`) }}</span>
          <p class="muted">{{ t(`cats.${item.category}`) }}<template v-if="item.sub && item.sub !== 'non_recyclable'"> · {{ t(`subs.${item.sub}`) }}</template></p>
        </div>
        <p v-if="item.safety !== 'none'" class="warn"><AppIcon name="AlertTriangle" /> {{ t(`safety.${item.safety}`) }}</p>
        <p v-if="bag === 'unknown'" class="note"><AppIcon name="InfoCircle" /> {{ note ?? t('not_sure') }}</p>
        <div v-if="alts.length" class="alts">
          <span class="muted">{{ t('notThis') }}?</span>
          <router-link v-for="a in alts" :key="a!.id" :to="`/item/${a!.id}`" class="chip">{{ itemName(a!, lang) }}</router-link>
          <router-link to="/browse" class="chip"><AppIcon name="LayoutGrid" :size="16" /></router-link>
        </div>
      </template>

      <!-- 2 處理（每個步驟一頁） -->
      <template v-else-if="cur.k === 'prep'">
        <p class="label">{{ t('steps.prep', { n: cur.n }) }}</p>
        <div class="hero center">
          <span class="bigic" :style="{ background: kind.color }"><AppIcon :name="prepMeta[cur.p as keyof typeof prepMeta].icon" :size="96" :stroke="1.5" /></span>
          <h2>{{ t(`prep.${cur.p}`) }}</h2>
        </div>
      </template>

      <!-- 3 用什麼裝 -->
      <template v-else-if="cur.k === 'bag'">
        <p class="label">{{ t('steps.bag') }}</p>
        <div class="hero center">
          <span class="bigic" :style="{ background: bag === 'general' ? '#D2552A' : kind.color }"><AppIcon :name="BAG_ICON[bag]" :size="96" :stroke="1.5" /></span>
          <h2>{{ t(`bag.${bag}`) }}</h2>
          <p v-if="bag === 'general'" class="muted">{{ t('g1_b') }} {{ t('g1_c') }}</p>
        </div>
      </template>

      <!-- 4 什麼時候丟 -->
      <template v-else-if="cur.k === 'when'">
        <p class="label">{{ t('steps.when') }}</p>
        <div class="hero center">
          <template v-if="when.mode === 'days'">
            <span class="bigic" :style="{ background: next?.inDays === 0 ? '#2F7A3A' : '#AD7B2B' }">
              <AppIcon :name="next?.inDays === 0 ? 'CircleCheck' : 'CalendarTime'" :size="96" :stroke="1.5" />
            </span>
            <h2>{{ next?.inDays === 0 ? t('today_yes') : t('today_no') }}</h2>
            <p v-if="next && next.inDays > 0" class="big">{{ t('today_next', { day: t(`days.${next.dow}`) }) }}</p>
            <ul class="week" aria-label="days">
              <li v-for="d in 7" :key="d" :class="{ on: when.days.includes((d) % 7), today: (d % 7) === today }">{{ t(`days_short.${d % 7}`) }}</li>
            </ul>
            <p class="muted">{{ t('today_evening') }}</p>
          </template>
          <template v-else>
            <span class="bigic" style="background: #475259"><AppIcon :name="when.mode === 'book' ? 'Phone' : when.mode === 'clinic' ? 'BuildingHospital' : 'QuestionMark'" :size="96" :stroke="1.5" /></span>
            <h2>{{ when.mode === 'book' ? t('today_book') : when.mode === 'clinic' ? t('today_clinic') : t('today_ask') }}</h2>
          </template>
        </div>
      </template>

      <!-- 5 交給誰 -->
      <template v-else-if="cur.k === 'where'">
        <p class="label">{{ t('steps.where') }}</p>
        <ul class="where">
          <li v-for="w in item.where" :key="w"><AppIcon :name="whereMeta[w].icon" :size="40" :stroke="1.6" /><b>{{ t(`where.${w}`) }}</b></li>
          <li v-if="!item.where.length"><AppIcon name="Phone" :size="40" /><b>{{ t('not_sure') }}</b></li>
        </ul>
        <p v-if="note && bag !== 'unknown'" class="note"><AppIcon name="InfoCircle" /> {{ note }}</p>
        <button v-if="when.mode === 'book' || when.mode === 'ask'" class="btn block" @click="call1999"><AppIcon name="Phone" /> {{ t('call1999') }}</button>
        <router-link v-if="item.where.includes('garbage_truck') || item.where.includes('recycle_truck') || item.where.includes('food_bin')" to="/first-time?step=2" class="btn block">
          <AppIcon name="MapPin" /> {{ t('stops_near') }}
        </router-link>
      </template>

      <!-- 完成 -->
      <template v-else>
        <div class="hero center">
          <span class="bigic" style="background: #2F7A3A"><AppIcon name="Check" :size="96" :stroke="2" /></span>
          <h2>{{ t('steps.done') }}</h2>
        </div>
        <router-link to="/identify" class="btn primary block"><AppIcon name="Camera" /> {{ t('home_sort') }}</router-link>
        <button class="btn block" @click="router.push('/')"><AppIcon name="Home" /> {{ t('home') }}</button>
      </template>
    </StepShell>
    <p class="caption">{{ t('prototype') }}</p>
  </main>
</template>

<style scoped>
.label { margin: 0; color: var(--gray-600); font-weight: 700; text-align: center; }
.hero { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 8px 0; }
h2 { margin: 0; font-size: var(--fs-h2); line-height: 1.3; }
.other { margin: -4px 0 0; color: var(--gray-600); font-size: var(--fs-title); }
.bigic { width: 160px; height: 160px; border-radius: 40px; display: grid; place-items: center; color: #fff; box-shadow: inset 0 0 0 5px rgba(255,255,255,.5), var(--shadow); }
.big { font-size: var(--fs-title); font-weight: 800; margin: 0; }
.warn { background: var(--orange-100); color: var(--orange-600); font-weight: 800; border-radius: 12px; padding: 10px 12px; margin: 0; display: flex; gap: 6px; align-items: center; }
.note { background: var(--secondary-50); border-radius: 12px; padding: 12px; margin: 0; font-weight: 600; display: flex; gap: 8px; }
.alts { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.chip { background: var(--white); border-radius: 999px; padding: 8px 12px; min-height: 40px; display: inline-flex; align-items: center; box-shadow: var(--shadow); text-decoration: none; color: var(--primary-700); font-weight: 700; }
.week { list-style: none; display: flex; gap: 6px; padding: 0; margin: 4px 0; }
.week li { width: 40px; height: 40px; border-radius: 10px; display: grid; place-items: center; background: var(--gray-100); color: var(--gray-500); font-weight: 700; font-size: var(--fs-body); }
.week li.on { background: #2F7A3A; color: #fff; }
.week li.today { outline: 3px solid var(--secondary-500); }
.where { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
.where li { display: flex; align-items: center; gap: 14px; background: var(--white); border-radius: 16px; padding: 14px; box-shadow: var(--shadow); font-size: var(--fs-title); color: var(--primary-800); }
</style>
