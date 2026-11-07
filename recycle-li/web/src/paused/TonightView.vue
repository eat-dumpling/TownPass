<script setup lang="ts">
// 12 今晚要倒嗎 → 13 今晚任務（現實）。
// 用定位找到「我家的那班車」只存編號；停靠前排程通知；錯過了就追車；完成後家長確認。
// 規則：週三、週日停收；只派孩子分對過且安全的類別；一天最多一件；任務卡寫「請和大人一起下樓」。
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import TopBar from '@/components/TopBar.vue'
import Mascot from '@/components/Mascot.vue'
import { categoryMeta } from '@/domain/catalog'
import { loadStops } from '@/domain/stops'
import type { CategoryId, Stop } from '@/domain/types'
import { getLocation, scheduleNotify } from '@/bridge/flutter'
import { chase, type ChaseResult } from '@/solvers/chase'
import { findMyTrip, hhmm, tripStops } from '@/solvers/geo'
import { isCollectionDay, tonightCategories } from '@/solvers/schedule'
import { today, useGame } from '@/stores/game'

const game = useGame()
const { t, locale } = useI18n()
const now = new Date()
const collect = isCollectionDay(now)
const weekday = '日一二三四五六'[now.getDay()]
const cats = computed(() => tonightCategories(now, game.learnedCategories))
const chosen = ref<CategoryId[]>(game.tonight?.date === today() ? game.tonight.bags : [])
const all = ref<Stop[]>([])
const msg = ref('')
const chaseRes = ref<ChaseResult | null | undefined>(undefined)

const myStop = computed(() => all.value.find((s) => s.id === game.settings.myTrip?.stopId))
const trip = computed(() => (game.settings.myTrip ? tripStops(all.value, game.settings.myTrip.route, game.settings.myTrip.trip) : []))
const assigned = computed(() => game.tonight?.date === today() && game.tonight.bags.length > 0)

onMounted(async () => {
  try { all.value = (await loadStops(game.settings.li?.district ?? '士林區')).stops } catch (e) { msg.value = String(e) }
})

async function locate() {
  msg.value = '📍 找你家的垃圾車…'
  const p = await getLocation()
  if (!p) { msg.value = '拿不到位置，請在下面直接選'; return }
  const mt = findMyTrip(all.value, { lat: p.latitude, lng: p.longitude }) // 座標只用在這一行，不保存
  if (!mt) { msg.value = '附近 500 公尺內找不到停靠點，請在下面直接選'; return }
  game.settings.myTrip = mt
  msg.value = ''
}
function pickStop(id: string) {
  const s = all.value.find((x) => x.id === id)
  if (s) game.settings.myTrip = { route: s.route, trip: s.trip, stopId: s.id }
}
function toggle(c: CategoryId) {
  chosen.value = chosen.value.includes(c) ? chosen.value.filter((x) => x !== c) : [...chosen.value, c]
}
async function assign() {
  const s = myStop.value
  if (!s || !chosen.value.length) return
  const id = Number(today().replace(/-/g, '').slice(2)) // 一天一件，同一天重派會覆蓋
  game.tonight = { date: today(), bags: [...chosen.value], notifyId: id, stopId: s.id, done: false }
  const at = `${today()}T${hhmm(s.arrive - 10)}:00+08:00` // 停靠前 10 分鐘（臺北時間）
  const scheduled = await scheduleNotify({ id, title: '今晚的尖兵任務', content: `${hhmm(s.arrive)} ${s.name}，帶${chosen.value.map((c) => categoryMeta[c].short).join('、')}`, at })
  game.say('⏰', scheduled ? '停靠前 10 分鐘會提醒你' : '已通知（App 尚未支援排程提醒）')
}
async function missed() {
  const p = await getLocation()
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes()
  if (!p) { chaseRes.value = null; return }
  chaseRes.value = chase(trip.value, { lat: p.latitude, lng: p.longitude }, nowMin)
}
const bagNames = computed(() => (game.tonight?.bags ?? []).map((c) => categoryMeta[c].label).join('、'))
</script>

<template>
  <main class="page stack">
    <TopBar :title="assigned && myStop ? `${hhmm(myStop.arrive)} ${myStop.name}` : '今晚要倒嗎？'" back="/" />

    <template v-if="!collect">
      <Mascot mood="think" :line="`今天週${weekday}停收，明天再一起努力`" />
      <p class="caption">都追不上或停收日的限時收受點：待接資料（見 TODO）</p>
    </template>

    <template v-else-if="!game.settings.myTrip">
      <Mascot mood="think" line="先找到你家的垃圾車" />
      <button class="btn primary block" @click="locate"><span class="ico" aria-hidden="true">📍</span> 用定位找</button>
      <p v-if="msg" class="muted" role="status">{{ msg }}</p>
      <label class="stack">
        <span class="muted">或直接選家附近的停靠點</span>
        <select class="sel" @change="pickStop(($event.target as HTMLSelectElement).value)">
          <option value="">—</option>
          <option v-for="s in all" :key="s.id" :value="s.id">{{ s.name }}（{{ hhmm(s.arrive) }}，車次 {{ s.trip }}）</option>
        </select>
      </label>
      <p class="caption">只存停靠點編號，位置用完就丟。</p>
    </template>

    <template v-else-if="!assigned">
      <Mascot :line="cats.length ? '今晚要帶哪幾袋？' : '先學會分類，才能派任務'" />
      <div class="grid2">
        <button v-for="c in cats" :key="c" class="tile" :class="{ gold: chosen.includes(c) }" :aria-pressed="chosen.includes(c)" @click="toggle(c)">
          <span class="art" aria-hidden="true">🛍️{{ categoryMeta[c].bin }}</span>{{ categoryMeta[c].label }}
        </button>
      </div>
      <button class="btn primary block" :disabled="!chosen.length || !myStop" @click="assign">🌙 派任務</button>
      <p class="caption">只派你分對過的類別；不派廚餘、玻璃、電池、燈管。</p>
    </template>

    <template v-else>
      <div class="card tonight stack center">
        <span class="art" aria-hidden="true">🚛🌙</span>
        <p class="big">{{ myStop ? hhmm(myStop.arrive) : '' }}</p>
        <p class="place">📍 {{ myStop?.name }}</p>
        <p class="bags">🛍️ {{ bagNames }}</p>
        <p class="badge tag-adult">👨‍👧 請和大人一起下樓</p>
      </div>
      <div v-if="locale !== 'zh'" class="card parent" :lang="locale">
        <strong>{{ t('tonightTitle') }}</strong>
        <p>{{ t('at', { time: myStop ? hhmm(myStop.arrive) : '', place: myStop?.name }) }}</p>
        <p>{{ t('withAdult') }}</p>
      </div>
      <div class="grid2">
        <button class="btn" @click="missed">🏃 我沒趕上</button>
        <router-link to="/parent" class="btn secondary">✅ 倒完了</router-link>
      </div>
      <div v-if="chaseRes !== undefined" class="card" role="status">
        <template v-if="chaseRes">垃圾車 {{ hhmm(chaseRes.stop.arrive) }} 會到 {{ chaseRes.stop.name }}，走過去約 {{ Math.ceil(chaseRes.walkMin) }} 分鐘。</template>
        <template v-else>追不上了，改天再一起努力（限時收受點：待接資料）</template>
      </div>
      <p class="caption center">時間是清潔隊的排定時間，不是即時位置。</p>
    </template>
  </main>
</template>

<style scoped>
.sel { min-height: var(--tap); border-radius: 14px; font-size: var(--fs-h3); padding: 0 10px; }
.tonight { background: linear-gradient(170deg, var(--primary-800), var(--primary-600)); color: var(--white); }
.tonight p { margin: 0; }
.art { font-size: 3rem; }
.big { font-size: 3rem; font-weight: 800; }
.place, .bags { font-size: var(--fs-title); font-weight: 700; }
.parent p { margin: 4px 0 0; }
</style>
