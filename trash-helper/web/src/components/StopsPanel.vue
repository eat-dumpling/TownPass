<script setup lang="ts">
// 附近的垃圾車停靠點（臺北市垃圾車點位路線資訊，data.taipei）。位置用台北通內建定位取得一次，只在手機上算，不保存。
// 拿不到位置時，改選行政區與里。
import { computed, onMounted, ref, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import AppIcon from './AppIcon.vue'
import { getLocation } from '@/bridge/flutter'
import { hhmm, loadStops, nearby, type StopRow } from '~/lib/stops'

const { t } = useI18n()
const all = shallowRef<StopRow[]>([])
const imported = ref('')
const list = shallowRef<(StopRow & { walkMin?: number })[]>([])
const state = ref<'idle' | 'locating' | 'done' | 'noloc'>('idle')
const district = ref('')
const li = ref('')
const districts = computed(() => [...new Set(all.value.map((s) => s.district))].sort())
const lis = computed(() => [...new Set(all.value.filter((s) => s.district === district.value).map((s) => s.li))].sort())

onMounted(async () => {
  const d = await loadStops()
  all.value = d.stops
  imported.value = d.imported
})
async function locate() {
  state.value = 'locating'
  const p = await getLocation()
  if (!p) { state.value = 'noloc'; return }
  list.value = nearby(all.value, { lat: p.latitude, lng: p.longitude }) // 座標只用在這一行
  state.value = 'done'
}
function pickLi() {
  const seen = new Set<string>()
  list.value = all.value
    .filter((s) => s.district === district.value && s.li === li.value)
    .sort((a, b) => a.arrive - b.arrive)
    .filter((s) => (seen.has(s.address + s.arrive) ? false : (seen.add(s.address + s.arrive), true)))
    .slice(0, 12)
  state.value = 'done'
}
</script>

<template>
  <div class="stack">
    <button class="btn primary block" :disabled="!all.length || state === 'locating'" @click="locate">
      <AppIcon name="CurrentLocation" /> {{ state === 'locating' ? '…' : t('stops_loc') }}
    </button>
    <div v-if="state === 'noloc' || state === 'idle'" class="pick">
      <p v-if="state === 'noloc'" class="muted">{{ t('stops_noloc') }}</p>
      <select v-model="district" :aria-label="t('stops_district')" @change="li = ''">
        <option value="" disabled>{{ t('stops_district') }}</option>
        <option v-for="d in districts" :key="d">{{ d }}</option>
      </select>
      <select v-if="district" v-model="li" :aria-label="t('stops_li')" @change="pickLi">
        <option value="" disabled>{{ t('stops_li') }}</option>
        <option v-for="l in lis" :key="l">{{ l }}</option>
      </select>
    </div>
    <template v-if="state === 'done'">
      <p v-if="!list.length" class="muted">{{ t('stops_none') }}</p>
      <ul class="stops">
        <li v-for="s in list" :key="s.address + s.arrive + s.route">
          <span class="time"><AppIcon name="Clock" :size="18" /> {{ hhmm(s.arrive) }}–{{ hhmm(s.leave) }}</span>
          <b lang="zh-Hant-TW">{{ s.address }}</b>
          <small>{{ s.route }} {{ s.trip }}<template v-if="s.walkMin"> · {{ t('stops_walk', { m: s.walkMin }) }}</template></small>
        </li>
      </ul>
      <button class="btn ghost" @click="state = 'idle'">{{ t('stops_district') }} / {{ t('stops_li') }}</button>
    </template>
    <p class="caption">{{ t('stops_live') }} {{ t('stops_src') }}{{ imported ? ` · ${imported}` : '' }}</p>
  </div>
</template>

<style scoped>
.pick { display: flex; flex-direction: column; gap: 8px; }
select { min-height: 52px; border-radius: 14px; border: 2px solid var(--gray-200); padding: 0 12px; font-size: var(--fs-h3); background: var(--white); }
.stops { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.stops li { background: var(--white); border-radius: 14px; padding: 10px 12px; box-shadow: var(--shadow); display: flex; flex-direction: column; gap: 2px; }
.time { color: var(--primary-700); font-weight: 800; font-size: var(--fs-title); display: inline-flex; align-items: center; gap: 4px; }
small { color: var(--gray-600); }
</style>
